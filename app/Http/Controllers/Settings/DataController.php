<?php

namespace App\Http\Controllers\Settings;

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\AuditEvent;
use App\Models\Tenant;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Privacy\CompanyData;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

/** SEC-02 (GDPR): download or delete a company's data, or your own. */
class DataController extends Controller
{
    /** Owners: every record and file the company has, in one ZIP. */
    public function exportCompany(Request $request, CurrentTenant $current, CompanyData $data): BinaryFileResponse
    {
        Gate::authorize('manage-tenant');
        $tenant = $current->require();
        $export = $data->export($tenant);
        AuditLog::record(AuditCategory::Profile, 'downloaded all company data', $tenant->name, null, $tenant, $request->user());

        return response()->download($export['path'], $export['name'], ['Content-Type' => 'application/zip'])->deleteFileAfterSend();
    }

    /**
     * Owners: delete the company and everything in it, now and for good. The
     * owner types the company name and their password, so it is never an accident.
     */
    public function destroyCompany(Request $request, CurrentTenant $current, CompanyData $data): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tenant = $current->require();
        $request->validate([
            'password' => ['required', 'current_password'],
            'confirm_name' => ['required', 'string'],
        ]);
        if (trim((string) $request->input('confirm_name')) !== $tenant->name) {
            throw ValidationException::withMessages(['confirm_name' => "Type the company name exactly: {$tenant->name}"]);
        }

        $name = $tenant->name;
        $data->erase($tenant);
        $current->set(null);
        Log::info('Company deleted at its owner’s request (GDPR).', ['tenant' => $tenant->getKey(), 'by' => $request->user()?->getKey()]);

        return redirect()->route('dashboard')->with('success', "{$name} and all its data have been deleted.");
    }

    /** Anyone: what ProcurPilot holds about you, as JSON. */
    public function exportMine(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $companies = $user->tenants()->get();

        $activity = $companies->mapWithKeys(fn (Tenant $t) => [
            $t->name => app(CurrentTenant::class)->runAs($t, fn () => AuditEvent::where('actor_id', $user->id)->orderBy('created_at')->get()
                ->map(fn (AuditEvent $e) => $e->only(['created_at', 'category', 'action', 'target', 'detail']))),
        ]);

        $body = json_encode([
            'exported_at' => now()->toIso8601String(),
            'account' => $user->only(['name', 'email', 'email_verified_at', 'created_at', 'updated_at']),
            'companies' => $companies->map(fn (Tenant $t) => ['name' => $t->name, 'role' => $t->pivot->role, 'joined_at' => $t->pivot->joined_at]),
            'activity' => $activity,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return response((string) $body, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="ProcurPilot-my-data_'.now()->format('Y-m-d').'.json"',
        ]);
    }

    /**
     * Delete your own account. Not while you are the only Owner of a company that
     * has other members: they would be left with nobody in charge. A company you
     * are the only member of is deleted with you, so nothing is left behind.
     */
    public function destroyMine(Request $request, CompanyData $data): RedirectResponse
    {
        $request->validate(['password' => ['required', 'current_password']]);
        /** @var User $user */
        $user = $request->user();

        $alone = [];
        foreach ($user->tenants()->get() as $tenant) {
            $members = $tenant->members()->count();
            if ($members === 1) {
                $alone[] = $tenant;
            } elseif ($tenant->pivot->role === TenantRole::Owner && $tenant->ownersCount() === 1) {
                throw ValidationException::withMessages([
                    'password' => "You are the only Owner of {$tenant->name}. Make someone else an Owner in Settings → Members first, or delete the company.",
                ]);
            }
        }

        foreach ($alone as $tenant) {
            $data->erase($tenant);
        }

        Auth::logout();
        $user->delete();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
