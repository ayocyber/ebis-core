<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Http\Requests\UpdateCompanyProfileRequest;
use App\Models\CompanyProfile;
use App\Models\User;
use App\Support\AuditLog;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** PRF-01: the company's core facts, versioned on every save. */
class CompanyProfileController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('company/profile', [
            'profile' => CompanyProfile::current()->toFrontend(),
        ]);
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
