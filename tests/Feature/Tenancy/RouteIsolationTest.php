<?php

/*
| SEC-01, the pen-test sweep: a full tender is built for one company, then a
| member of another company calls every route that takes an ID with that
| company's IDs. Each call must be refused (403 or 404) and change nothing.
| A route added later with an ID must be listed here, or the last test fails.
*/

use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\BidSection;
use App\Models\BidSectionVersion;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\Gap;
use App\Models\Invitation;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\Support\TenderFiles;

beforeEach(function () {
    Storage::fake('local');
    $this->alice = User::factory()->create();
    $this->acme = Tenant::factory()->ownedBy($this->alice)->create();
    $this->bob = User::factory()->create();
    $this->globex = Tenant::factory()->ownedBy($this->bob)->create();

    $as = fn (callable $fn) => app(CurrentTenant::class)->runAs($this->acme, $fn);
    $as(fn () => CompanyProfile::factory()->create());

    // Alice builds a tender all the way to the documents checklist.
    $this->actingAs($this->alice)->post('/tenders', [
        'files' => [TenderFiles::pdf('ITT.pdf', ['The supplier must hold ISO 9001 certification.'])],
        'title' => 'Network services', 'buyer_name' => 'Eastbrook City Council', 'buyer_type' => 'local',
        'deadline' => now()->addWeeks(6)->toDateTimeString(),
    ]);
    $tender = $as(fn () => Tender::sole());
    $as(fn () => Requirement::create([
        'tender_id' => $tender->id, 'code' => 'M-01', 'title' => 'ISO 9001', 'text' => 'ISO 9001', 'category' => 'mandatory',
        'topic' => 'certification', 'check_rule' => ['type' => 'certification', 'name' => 'ISO 9001'], 'origin' => 'manual', 'confirmed_at' => now(),
    ]));
    $this->post("/tenders/{$tender->id}/eligibility");
    $this->post("/tenders/{$tender->id}/decision", ['outcome' => 'proceed', 'acknowledged_blockers' => $as(fn () => Gap::pluck('id')->all())]);
    $this->get("/tenders/{$tender->id}/documents");
    $section = $as(fn () => BidSection::first());
    $this->postJson("/tenders/{$tender->id}/sections/{$section->id}/versions", ['label' => 'Edited', 'body' => 'Draft.']);
    $this->post('/vault/documents', [
        'file' => UploadedFile::fake()->create('ISO 9001.pdf', 40, 'application/pdf'), 'title' => 'ISO 9001', 'category' => 'certificate',
        'expires_at' => now()->addYear()->toDateString(), 'fact_keys' => [],
    ]);
    $this->post('/settings/invitations', ['email' => 'new@example.com', 'role' => 'editor']);

    $this->ids = $as(fn () => [
        'tender' => $tender->id,
        'document' => TenderDocument::first()->id,
        'requirement' => Requirement::first()->id,
        'assessment' => Assessment::first()->id,
        'gap' => Gap::first()?->id,
        'section' => $section->id,
        'version' => BidSectionVersion::first()->id,
        'item' => ChecklistItem::first()->id,
        'invitation' => Invitation::first()->id,
    ]);
    $this->ids['vault'] = $as(fn () => VaultDocument::first()->id);
    $this->ids['user'] = $this->alice->id;
    $this->ids['tenant'] = $this->acme->id;
    $this->auditCount = $as(fn () => AuditEvent::count());
});

/** Every route that takes the ID of something a company owns, with the IDs to try. */
function ownedRoutes(array $ids): array
{
    $t = $ids['tender'];

    return [
        ['POST', "tenants/{$ids['tenant']}/switch"],
        ['GET', "vault/documents/{$ids['vault']}/download"],
        ['DELETE', "vault/documents/{$ids['vault']}"],
        ['POST', "vault/documents/{$ids['vault']}/check"],
        ['PATCH', "settings/members/{$ids['user']}"],
        ['DELETE', "settings/members/{$ids['user']}"],
        ['DELETE', "settings/invitations/{$ids['invitation']}"],
        ['GET', "tenders/{$t}"],
        ['PATCH', "tenders/{$t}"],
        ['DELETE', "tenders/{$t}"],
        ['POST', "tenders/{$t}/documents"],
        ['GET', "tenders/{$t}/documents/{$ids['document']}/download"],
        ['DELETE', "tenders/{$t}/documents/{$ids['document']}"],
        ['POST', "tenders/{$t}/documents/{$ids['document']}/retry"],
        ['GET', "tenders/{$t}/requirements"],
        ['POST', "tenders/{$t}/requirements"],
        ['POST', "tenders/{$t}/requirements/confirm"],
        ['POST', "tenders/{$t}/requirements/confirm/{$ids['requirement']}"],
        ['PATCH', "tenders/{$t}/requirements/{$ids['requirement']}"],
        ['DELETE', "tenders/{$t}/requirements/{$ids['requirement']}"],
        ['GET', "tenders/{$t}/eligibility"],
        ['POST', "tenders/{$t}/eligibility"],
        ['POST', "tenders/{$t}/assessments/{$ids['assessment']}/override"],
        ['POST', "tenders/{$t}/assessments/{$ids['assessment']}/review"],
        ['GET', "tenders/{$t}/gaps"],
        ...($ids['gap'] ? [['PATCH', "tenders/{$t}/gaps/{$ids['gap']}"]] : []),
        ['GET', "tenders/{$t}/decision"],
        ['POST', "tenders/{$t}/decision"],
        ['GET', "tenders/{$t}/compliance"],
        ['POST', "tenders/{$t}/compliance/map"],
        ['GET', "tenders/{$t}/bid"],
        ['POST', "tenders/{$t}/sections"],
        ['PATCH', "tenders/{$t}/sections/{$ids['section']}"],
        ['DELETE', "tenders/{$t}/sections/{$ids['section']}"],
        ['POST', "tenders/{$t}/sections/{$ids['section']}/versions"],
        ['POST', "tenders/{$t}/sections/{$ids['section']}/versions/{$ids['version']}/restore"],
        ['GET', "tenders/{$t}/documents"],
        ['PATCH', "tenders/{$t}/checklist/{$ids['item']}"],
        ['POST', "tenders/{$t}/checklist/{$ids['item']}/file"],
        ['GET', "tenders/{$t}/checklist/{$ids['item']}/file"],
        ['POST', "tenders/{$t}/checklist/{$ids['item']}/form"],
        ['GET', "tenders/{$t}/validation"],
        ['POST', "tenders/{$t}/readiness"],
        ['POST', "tenders/{$t}/signoff"],
        ['DELETE', "tenders/{$t}/signoff"],
        ['GET', "tenders/{$t}/pack"],
    ];
}

it('refuses every route to another company, and changes nothing', function () {
    $this->actingAs($this->bob);
    $routes = ownedRoutes($this->ids);

    foreach ($routes as [$method, $uri]) {
        $status = $this->json($method, "/{$uri}", ['progress' => ['notApplicable' => true], 'outcome' => 'proceed', 'title' => 'x', 'body' => 'x', 'score' => 1, 'critical' => 0, 'role' => 'owner'])->status();
        expect(in_array($status, [403, 404], true))->toBeTrue("{$method} /{$uri} returned {$status} to another company");
    }

    // Nothing of Alice's was changed or deleted.
    app(CurrentTenant::class)->runAs($this->acme, function () {
        expect(Tender::count())->toBe(1)
            ->and(VaultDocument::count())->toBe(1)
            ->and(BidSection::count())->toBeGreaterThan(0)
            ->and(ChecklistItem::whereNotNull('progress')->count())->toBe(0)
            ->and(AuditEvent::count())->toBe($this->auditCount);
    });
    expect($this->alice->fresh()->roleIn($this->acme)?->value)->toBe('owner')
        ->and($this->bob->fresh()->current_tenant_id)->toBe($this->globex->id);
});

it('has a case for every route that takes an ID', function () {
    $public = ['invitations/{token}', 'invitations/{token}/accept', 'reset-password/{token}', 'verify-email/{id}/{hash}', 'tenders/find/{opportunity}/bid'];
    $covered = collect(ownedRoutes($this->ids))
        ->map(fn ($r) => preg_replace('/[0-9a-f]{8}-[0-9a-f-]{27}|\b\d+\b/', '{}', $r[1]))
        ->unique()->values();

    $missing = collect(Route::getRoutes()->getRoutes())
        ->map(fn ($r) => $r->uri())
        ->filter(fn ($uri) => str_contains($uri, '{') && ! in_array($uri, $public, true) && ! str_starts_with($uri, 'storage/'))
        ->map(fn ($uri) => preg_replace('/\{[^}]+\}/', '{}', str_replace('{requirement?}', '{requirement}', $uri)))
        ->unique()
        ->reject(fn ($uri) => $covered->contains($uri) || $uri === 'tenders/{}/{}') // the stage pages are listed one by one
        ->values()->all();

    expect($missing)->toBe([]);
});
