<?php

use App\Enums\TenantRole;
use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\CompanyProfile;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create(['name' => 'Emma Richardson']);
    $this->tenant = Tenant::factory()->ownedBy($this->owner)->create();
    $this->profile = forTheCompany($this->tenant, fn () => CompanyProfile::factory()->create([
        'legal_name' => 'Bluewave Networks Ltd',
        'company_number' => '08412345',
        'incorporated_at' => '2013-03-14',
        'insurance' => [['label' => 'Employer’s liability', 'cover' => 10_000_000]],
    ]));
    $this->actingAs($this->owner);
});

function forTheCompany(Tenant $tenant, callable $fn): mixed
{
    return app(CurrentTenant::class)->runAs($tenant, $fn);
}

function uploadToVault(object $test, UploadedFile $file, array $details): VaultDocument
{
    $test->post('/vault/documents', ['file' => $file, 'category' => 'insurance', ...$details])->assertSessionHasNoErrors();

    return forTheCompany($test->tenant, fn () => VaultDocument::latest('created_at')->latest('id')->firstOrFail());
}

/** @return list<string> */
function warnings(VaultDocument $doc): array
{
    return collect($doc->check_notes)->where('level', 'warn')->pluck('text')->all();
}

it('passes a document that matches what was entered', function () {
    $pdf = TenderFiles::pdf('EL certificate.pdf', [
        'Certificate of Employer’s Liability Insurance. Policyholder: Bluewave Networks Limited. '
        .'Limit of indemnity: GBP 10,000,000 any one occurrence. Expiry date: 12 March 2027.',
    ]);
    $doc = uploadToVault($this, $pdf, ['title' => 'Employer’s liability insurance', 'expires_at' => '2027-03-12']);

    expect($doc->check_status)->toBe('passed')
        ->and(warnings($doc))->toBe([])
        ->and(collect($doc->check_notes)->pluck('text')->all())->toContain(
            'Looks like an employer’s liability certificate.',
            'Your company name appears in it.',
            'The expiry date you entered (12 Mar 2027) is in the document.',
            'The cover in your profile (£10,000,000) appears in it.',
        );
    $this->get('/vault')->assertSessionHasNoErrors();
});

it('flags the wrong document uploaded under an insurance title', function () {
    $cv = TenderFiles::pdf('CV.pdf', ['Curriculum vitae of Sarah Whitfield, project manager with ten years in network delivery.']);

    $this->post('/vault/documents', [
        'file' => $cv, 'title' => 'Employer’s liability insurance', 'category' => 'insurance', 'expires_at' => '2027-03-12',
    ])->assertSessionHas('success', fn (string $m) => str_contains($m, '4 things to look at'));

    $doc = forTheCompany($this->tenant, fn () => VaultDocument::sole());
    expect($doc->check_status)->toBe('warnings')
        ->and(warnings($doc))->toBe([
            'Doesn’t look like an employer’s liability certificate: none of the usual wording was found. Is it the right file?',
            'Your company name (Bluewave Networks Ltd) isn’t in it. Is it another company’s document?',
            'The expiry date you entered (12 Mar 2027) isn’t in the document. Check it.',
            'The cover in your profile (£10,000,000) isn’t in it. Check the amount.',
        ]);
});

it('spots an expiry date that was not entered, and a mismatched ISO standard', function () {
    $doc = uploadToVault($this, TenderFiles::pdf('Cert.pdf', ['ISO 14001 certificate issued to Bluewave Networks Ltd. Valid until 31/01/2027.']), [
        'title' => 'ISO 9001', 'category' => 'certificate',
    ]);

    expect(warnings($doc))->toBe([
        'Doesn’t look like an ISO 9001 certificate: none of the usual wording was found. Is it the right file?',
        'The document seems to expire on 31 Jan 2027. Add the expiry date so you are reminded to renew it.',
    ]);
});

it('checks the company number on company documents', function () {
    $good = uploadToVault($this, TenderFiles::pdf('Inc.pdf', ['Certificate of Incorporation of a Private Limited Company. Company number 8412345. BLUEWAVE NETWORKS LIMITED. Companies House.']), [
        'title' => 'Certificate of incorporation', 'category' => 'company',
    ]);
    expect($good->check_status)->toBe('passed');

    $other = uploadToVault($this, TenderFiles::pdf('Inc2.pdf', ['Certificate of Incorporation. Company number 99999999. Bluewave Networks Ltd. Companies House.']), [
        'title' => 'Certificate of incorporation (old)', 'category' => 'company',
    ]);
    expect(warnings($other))->toBe(['Your company number (08412345) isn’t in it.']);
});

it('says when a document can’t be read instead of passing it', function () {
    $doc = uploadToVault($this, UploadedFile::fake()->image('scan.jpg'), ['title' => 'Public liability insurance']);
    expect($doc->check_status)->toBe('unreadable');

    $scan = uploadToVault($this, TenderFiles::pdf('scan.pdf', ['']), ['title' => 'Public liability insurance (scan)']);
    expect($scan->check_status)->toBe('unreadable')
        ->and(warnings($scan)[0])->toContain('looks like a scan');
});

it('checks again on request, e.g. after fixing the profile', function () {
    $doc = uploadToVault($this, TenderFiles::pdf('EL.pdf', ['Employer’s liability insurance for Bluewave Networks Ltd, cover 5,000,000.']), [
        'title' => 'Employer’s liability insurance',
    ]);
    expect(warnings($doc))->toContain('The cover in your profile (£10,000,000) isn’t in it. Check the amount.');

    forTheCompany($this->tenant, fn () => $this->profile->forceFill(['insurance' => [['label' => 'Employer’s liability', 'cover' => 5_000_000]]])->save());
    $this->post("/vault/documents/{$doc->id}/check")->assertSessionHas('success', fn (string $m) => str_contains($m, 'matches'));
    expect($doc->fresh()->check_status)->toBe('passed');
});

it('shows document warnings in the eligibility evidence', function () {
    uploadToVault($this, TenderFiles::pdf('x.pdf', ['A completely unrelated letter about office parking for Bluewave Networks Ltd.']), [
        'title' => 'Cyber Essentials Plus', 'category' => 'certificate',
    ]);
    $tender = forTheCompany($this->tenant, function () {
        $t = Tender::factory()->create();
        Requirement::create([
            'tender_id' => $t->id, 'code' => 'M-01', 'title' => 'CE+', 'text' => 'CE+', 'category' => 'mandatory', 'topic' => 'certification',
            'check_rule' => ['type' => 'certification', 'name' => 'Cyber Essentials Plus'], 'origin' => 'manual', 'confirmed_at' => now(),
        ]);

        return $t;
    });

    $this->post("/tenders/{$tender->id}/eligibility");
    $a = forTheCompany($this->tenant, fn () => Assessment::sole());
    expect($a->status->value)->toBe('met') // warnings don't block…
        ->and($a->reasoning)->toContain('ProcurPilot’s check of this document found: Doesn’t look like a Cyber Essentials Plus certificate'); // …but stay visible
});

/* Companies House ----------------------------------------------------- */

function fakeRegister(array $company, int $status = 200): void
{
    config(['services.companies_house.key' => 'test-key']);
    Http::fake(['api.company-information.service.gov.uk/*' => Http::response($company, $status)]);
}

it('says the Companies House check is not set up without a key', function () {
    config(['services.companies_house.key' => null]);
    $this->get('/company')->assertInertia(fn ($page) => $page->where('companiesHouseEnabled', false));
    $this->post('/company/verify')->assertSessionHas('error', fn (string $m) => str_contains($m, 'isn’t set up'));
});

it('confirms the company with Companies House and uses it in the eligibility check', function () {
    fakeRegister(['company_number' => '08412345', 'company_name' => 'BLUEWAVE NETWORKS LIMITED', 'company_status' => 'active', 'date_of_creation' => '2013-03-14']);

    $this->post('/company/verify')->assertSessionHas('success', 'Confirmed with Companies House: name, status and incorporation date all match.');
    Http::assertSent(fn ($r) => str_ends_with($r->url(), '/company/08412345') && $r->hasHeader('Authorization'));

    $ch = $this->profile->fresh()->companies_house;
    expect($ch['nameMatches'])->toBeTrue()->and($ch['dateMatches'])->toBeTrue()->and($ch['active'])->toBeTrue()
        // Checking is not a profile edit.
        ->and($this->profile->fresh()->version)->toBe($this->profile->version);

    $tender = forTheCompany($this->tenant, function () {
        $t = Tender::factory()->create();
        Requirement::create([
            'tender_id' => $t->id, 'code' => 'M-01', 'title' => '3 years', 'text' => '3 years', 'category' => 'mandatory', 'topic' => 'financial',
            'check_rule' => ['type' => 'years_trading', 'years' => 3], 'origin' => 'manual', 'confirmed_at' => now(),
        ]);

        return $t;
    });
    $this->post("/tenders/{$tender->id}/eligibility");
    expect(forTheCompany($this->tenant, fn () => Assessment::sole()->reasoning))->toEndWith('Confirmed with Companies House.');
});

it('reports a different name, a dissolved company, or an unknown number', function () {
    config(['services.companies_house.key' => 'test-key']);
    Http::fake(['api.company-information.service.gov.uk/*' => Http::sequence()
        ->push(['company_number' => '08412345', 'company_name' => 'BLUEWAVE HOLDINGS LIMITED', 'company_status' => 'dissolved', 'date_of_creation' => '2013-03-14'])
        ->push(['errors' => [['error' => 'company-profile-not-found']]], 404)]);

    $this->post('/company/verify')->assertSessionHas('error', 'Companies House check: the name is different; the company is dissolved. See the details on this page.');
    expect(forTheCompany($this->tenant, fn () => AuditEvent::latest('id')->first()->action))->toBe('checked the company with Companies House');

    $this->post('/company/verify')->assertSessionHas('error', fn (string $m) => str_contains($m, 'no company has that number'));
    expect($this->profile->fresh()->companies_house['found'])->toBeFalse();
});

it('copes when Companies House can’t be reached', function () {
    fakeRegister([], 503);
    $this->post('/company/verify')->assertSessionHas('error', 'Companies House couldn’t be reached. Try again in a few minutes.');
});

it('lets viewers see the result but not run checks', function () {
    fakeRegister(['company_name' => 'BLUEWAVE NETWORKS LIMITED', 'company_status' => 'active', 'date_of_creation' => '2013-03-14']);
    $viewer = User::factory()->create();
    $this->tenant->addMember($viewer, TenantRole::Viewer);
    $viewer->switchTenant($this->tenant);

    $this->actingAs($viewer)->post('/company/verify')->assertForbidden();
    $doc = forTheCompany($this->tenant, fn () => VaultDocument::factory()->create());
    $this->post("/vault/documents/{$doc->id}/check")->assertForbidden();
});
