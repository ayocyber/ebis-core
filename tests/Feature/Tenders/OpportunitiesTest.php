<?php

use App\Enums\TenantRole;
use App\Models\CompanyProfile;
use App\Models\Opportunity;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Support\Opportunities\OpportunityFeed;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    OpportunityFeed::$pauseMs = 0;
    $this->owner = User::factory()->create();
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
    withinCompany($this->tenant, fn () => CompanyProfile::current()->forceFill(['sector' => 'IT and network services'])->save());
    $this->actingAs($this->owner);
});

function withinCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

/** A minimal OCDS release, as both government feeds publish them. */
function release(array $tender = [], array $extra = []): array
{
    static $n = 0;
    $n++;

    return array_replace_recursive([
        'ocid' => "ocds-test-{$n}",
        'id' => "{$n}-2026",
        'date' => now()->subDay()->toIso8601ZuluString(),
        'tag' => ['tender'],
        'buyer' => ['name' => 'Royal Borough of Greenwich'],
        'parties' => [['name' => 'Royal Borough of Greenwich', 'roles' => ['buyer'], 'details' => ['classifications' => [['scheme' => 'TED_CA_TYPE', 'id' => 'REGIONAL_AUTHORITY']]]]],
        'tender' => [
            'title' => 'Managed Network Services',
            'status' => 'active',
            'description' => 'The council requires a managed wide area network and Wi-Fi for 40 sites.',
            'value' => ['amount' => 1600000, 'currency' => 'GBP'],
            'tenderPeriod' => ['endDate' => now()->addWeeks(4)->toIso8601ZuluString()],
            'classification' => ['scheme' => 'CPV', 'id' => '72700000', 'description' => 'Computer network services'],
            'items' => [['deliveryAddresses' => [['region' => 'UKI42']]]],
            'submissionMethodDetails' => 'https://www.delta-esourcing.com/tenders/123',
            'selectionCriteria' => ['criteria' => [[
                'minimum' => "Employer's Liability Insurance: 10 Million GBP (Mandatory)\nPublic Liability: 5 Million GBP (Mandatory)",
            ]]],
            'lots' => [['id' => '1', 'awardCriteria' => ['criteria' => [
                ['name' => 'Technical approach', 'type' => 'quality', 'description' => '40'],
                ['type' => 'price', 'description' => '60'],
            ]]]],
        ],
    ], $extra, ['tender' => $tender]);
}

function fakeFeeds(array $fts, array $cf = []): void
{
    Http::fake([
        'www.find-tender.service.gov.uk/api/*' => Http::response(['releases' => $fts, 'links' => []]),
        'www.contractsfinder.service.gov.uk/Published/*' => Http::response(['releases' => $cf, 'links' => []]),
    ]);
}

it('pulls open tenders from both feeds and keeps only the ones still open', function () {
    fakeFeeds([
        release(),
        release(['title' => 'Closed already', 'tenderPeriod' => ['endDate' => now()->subDay()->toIso8601ZuluString()]]),
        release(['title' => 'Contract awarded', 'status' => 'complete']),
    ], [
        // The same tender on Contracts Finder is listed once.
        release(['title' => 'Managed network services'], ['ocid' => 'ocds-cf-twin']),
        release(['title' => 'School IT support', 'suitability' => ['sme' => true]], ['buyer' => ['name' => 'Oak Academy Trust']]),
    ]);

    app(OpportunityFeed::class)->fetch();

    expect(Opportunity::orderBy('title')->pluck('title')->all())->toBe(['Managed Network Services', 'School IT support']);

    $o = Opportunity::where('title', 'Managed Network Services')->sole();
    expect($o->source)->toBe('fts')
        ->and($o->buyer_type->value)->toBe('local')
        ->and($o->value)->toBe(1600000)
        ->and($o->regions)->toBe(['London'])
        ->and($o->url)->toContain('find-tender.service.gov.uk/Notice/')
        ->and($o->award_criteria)->toBe([
            ['name' => 'Technical approach', 'type' => 'quality', 'weight' => 40],
            ['name' => 'Price', 'type' => 'price', 'weight' => 60],
        ]);
    expect(Opportunity::where('title', 'School IT support')->sole())
        ->buyer_type->value->toBe('education')
        ->sme_suitable->toBeTrue();
});

it('carries on from where it stopped when a feed rate-limits', function () {
    Http::fake([
        'www.find-tender.service.gov.uk/api/*' => Http::sequence()
            ->push(['releases' => [release()], 'links' => ['next' => 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?cursor=page2']])
            ->push('Rate limit exceeded', 429)
            ->push(['releases' => [release(['title' => 'Page two tender'])], 'links' => []]),
        'www.contractsfinder.service.gov.uk/*' => Http::response(['releases' => [], 'links' => []]),
    ]);

    $first = app(OpportunityFeed::class)->fetch();
    expect($first['fts']['error'])->toBe('rate limited, carries on next run')
        ->and(Cache::get('opportunities:fts:since:resume')['url'])->toContain('cursor=page2');

    app(OpportunityFeed::class)->fetch();
    expect(Opportunity::pluck('title')->sort()->values()->all())->toBe(['Managed Network Services', 'Page two tender'])
        ->and(Cache::has('opportunities:fts:since:resume'))->toBeFalse();
});

it('shows the tenders that match the company, and says why', function () {
    fakeFeeds([
        release(),
        release(['title' => 'Grounds maintenance', 'description' => 'Grass cutting with ride-on mowers.', 'classification' => ['description' => 'Landscaping']]),
    ]);
    app(OpportunityFeed::class)->fetch();
    Cache::put('opportunities:fetched_at', now()->toIso8601String());

    $this->get('/tenders/find')->assertInertia(fn (Assert $page) => $page
        ->component('tenders/find')
        ->where('keywords', ['network', 'IT services', 'IT support', 'software', 'digital', 'cyber'])
        ->where('keywordsAreDefault', true)
        ->where('total', 1)
        ->where('results.0.title', 'Managed Network Services')
        ->where('results.0.matched', ['network'])
        ->where('openCount', 2));

    // "Show all" ignores the search words; a one-off search replaces them.
    $this->get('/tenders/find?all=1')->assertInertia(fn (Assert $page) => $page->where('total', 2));
    $this->get('/tenders/find?q=mowers')->assertInertia(fn (Assert $page) => $page->where('total', 1)->where('results.0.title', 'Grounds maintenance'));
    $this->get('/tenders/find?all=1&region=Scotland')->assertInertia(fn (Assert $page) => $page->where('total', 0));

    // Whole words only: "it" inside "with" is not a match.
    $this->put('/tenders/find/keywords', ['keywords' => ['grass']])->assertSessionHasNoErrors();
    $this->get('/tenders/find')->assertInertia(fn (Assert $page) => $page->where('keywords', ['grass'])->where('keywordsAreDefault', false)->where('total', 1));
    $this->put('/tenders/find/keywords', ['keywords' => ['it']])->assertSessionHasErrors('keywords.0');
});

it('starts a tender from an opportunity, reading the notice and its attachments', function () {
    $pdf = TenderFiles::pdf('Specification.pdf', ['Specification. The supplier must provide 24/7 monitoring of all network devices.']);
    Http::fake([
        'www.find-tender.service.gov.uk/api/*' => Http::response(['releases' => [release(['documents' => [
            ['title' => 'Specification', 'url' => 'https://www.contractsfinder.service.gov.uk/Notice/Attachment/abc', 'format' => 'application/pdf'],
            ['title' => 'Full pack', 'url' => 'https://www.delta-esourcing.com/pack.zip'],
        ]])], 'links' => []]),
        'www.contractsfinder.service.gov.uk/Published/*' => Http::response(['releases' => [], 'links' => []]),
        'www.contractsfinder.service.gov.uk/Notice/Attachment/*' => Http::response((string) file_get_contents($pdf->getRealPath()), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="Specification.pdf"',
        ]),
    ]);
    app(OpportunityFeed::class)->fetch();
    $o = Opportunity::sole();

    $this->post("/tenders/find/{$o->id}/bid")->assertRedirect()->assertSessionHas('success');

    withinCompany($this->tenant, function () use ($o) {
        $tender = Tender::with('documents')->sole();
        expect($tender->title)->toBe('Managed Network Services')
            ->and($tender->buyer_name)->toBe('Royal Borough of Greenwich')
            ->and($tender->estimated_value)->toBe(1600000)
            ->and($tender->source_url)->toBe($o->url)
            ->and($tender->portal_url)->toBe('https://www.delta-esourcing.com/tenders/123')
            ->and($tender->documents->pluck('name')->sort()->values()->all())->toBe(['Specification.pdf', 'Tender notice - Find a Tender.docx'])
            ->and($tender->documents->firstWhere('name', 'Tender notice - Find a Tender.docx')->role)->toBe('Published notice');

        $found = Requirement::where('tender_id', $tender->id)->get();
        // From the notice: both insurance levels, and the scored criterion with its weight.
        expect($found->pluck('check_rule')->filter()->pluck('amount')->sort()->values()->all())->toContain(5_000_000, 10_000_000)
            ->and($found->firstWhere('weight', 40)?->category->value)->toBe('scored')
            // From the attached specification.
            ->and($found->pluck('text')->implode(' '))->toContain('24/7 monitoring');
    });

    // Picking it again opens the same tender.
    $this->post("/tenders/find/{$o->id}/bid")->assertRedirect();
    expect(withinCompany($this->tenant, fn () => Tender::count()))->toBe(1);
    $this->get('/tenders/find?all=1')->assertInertia(fn (Assert $page) => $page->whereNot('results.0.tenderId', null));
});

it('lets viewers browse but not start a bid or change the search words', function () {
    fakeFeeds([release()]);
    app(OpportunityFeed::class)->fetch();
    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);

    $this->actingAs($viewer)->get('/tenders/find')->assertOk();
    $this->actingAs($viewer)->post('/tenders/find/'.Opportunity::sole()->id.'/bid')->assertForbidden();
    $this->actingAs($viewer)->put('/tenders/find/keywords', ['keywords' => ['network']])->assertForbidden();
});

it('does not suggest a notice line that only points to the tender pack', function () {
    fakeFeeds([release(['selectionCriteria' => ['criteria' => [['description' => 'As detailed in the quotation pack.', 'minimum' => null]]], 'lots' => []])]);
    app(OpportunityFeed::class)->fetch();

    expect(Opportunity::sole()->selection)->toBe([]);

    $this->post('/tenders/find/'.Opportunity::sole()->id.'/bid')->assertRedirect();
    withinCompany($this->tenant, fn () => expect(Requirement::pluck('text')->implode(' '))->not->toContain('quotation pack'));
});

it('lists a picked tender with the others, on the tenders page and the dashboard', function () {
    fakeFeeds([release()]);
    app(OpportunityFeed::class)->fetch();
    $this->post('/tenders/find/'.Opportunity::sole()->id.'/bid')->assertRedirect();
    $id = withinCompany($this->tenant, fn () => Tender::sole()->id);

    foreach (['/tenders', '/dashboard', "/tenders/{$id}", "/tenders/{$id}/requirements", "/tenders/{$id}/eligibility"] as $url) {
        $this->get($url)->assertOk();
    }
});
