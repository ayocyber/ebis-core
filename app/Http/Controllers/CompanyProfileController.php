<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Http\Requests\UpdateCompanyProfileRequest;
use App\Models\CompanyProfile;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\CompaniesHouse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

/** PRF-01: the company's core facts, versioned on every save. */
class CompanyProfileController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('company/profile', [
            'profile' => CompanyProfile::current()->toFrontend(),
            'companiesHouseEnabled' => CompaniesHouse::enabled(),
        ]);
    }

    /** Check the company number, name, status and incorporation date against the official register. */
    public function verify(Request $request, CompaniesHouse $register): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        if (! CompaniesHouse::enabled()) {
            return back()->with('error', 'The Companies House check isn’t set up yet. Ask your administrator to add the API key.');
        }

        $profile = CompanyProfile::current();
        if (! $profile->company_number) {
            return back()->with('error', 'Add your company number first.');
        }

        try {
            $entry = $register->company($profile->company_number);
        } catch (RuntimeException $e) {
            report($e);

            return back()->with('error', 'Companies House couldn’t be reached. Try again in a few minutes.');
        }

        $result = $entry === null
            ? ['found' => false, 'checkedAt' => now()->toIso8601ZuluString(), 'number' => $profile->company_number]
            : [
                ...$entry,
                'found' => true,
                'checkedAt' => now()->toIso8601ZuluString(),
                'nameMatches' => CompaniesHouse::sameName($entry['name'], $profile->legal_name),
                'dateMatches' => $entry['incorporatedOn'] !== null && $profile->incorporated_at?->toDateString() === $entry['incorporatedOn'],
                'active' => $entry['status'] === 'active',
            ];
        // The register check is not a profile edit, so it doesn't make a new profile version.
        $profile->forceFill(['companies_house' => $result])->saveQuietly();

        $problems = $entry === null ? ['no company has that number'] : array_keys(array_filter([
            'the name is different' => ! $result['nameMatches'],
            'the incorporation date is different' => ! $result['dateMatches'],
            "the company is {$entry['status']}" => ! $result['active'],
        ]));
        AuditLog::record(AuditCategory::Profile, 'checked the company with Companies House', $profile->legal_name ?? 'Company',
            $problems === [] ? 'Everything matches' : ucfirst(implode('; ', $problems)), $profile, $request->user());

        return back()->with($problems === [] ? 'success' : 'error', $problems === []
            ? 'Confirmed with Companies House: name, status and incorporation date all match.'
            : 'Companies House check: '.implode('; ', $problems).'. See the details on this page.');
    }

    public function update(UpdateCompanyProfileRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $profile = CompanyProfile::current();
        $diff = $profile->saveVersion($request->columns(), $user);

        if ($diff !== []) {
            AuditLog::record(
                AuditCategory::Profile,
                'updated the company profile',
                implode(', ', array_map(fn ($f) => CompanyProfile::LABELS[$f], array_keys($diff))),
                detail: self::describe($diff)." · version {$profile->version}",
                subject: $profile,
                actor: $user,
            );
        }

        return back()->with('success', $diff === [] ? 'No changes to save.' : 'Company profile saved.');
    }

    /**
     * "Employees 38 → 42" for short scalar changes; just the field name for long text and lists.
     *
     * @param  array<string, array{0: mixed, 1: mixed}>  $diff
     */
    private static function describe(array $diff): string
    {
        $parts = [];
        foreach ($diff as $field => [$old, $new]) {
            $show = fn ($v) => $v instanceof \DateTimeInterface ? $v->format('j M Y') : (string) $v;
            $parts[] = is_scalar($new) && mb_strlen((string) $new) <= 40 && ! is_array($old)
                ? CompanyProfile::LABELS[$field].' '.($show($old) === '' ? '(empty)' : $show($old)).' → '.$show($new)
                : CompanyProfile::LABELS[$field].' changed';
        }

        return implode(' · ', $parts);
    }
}
