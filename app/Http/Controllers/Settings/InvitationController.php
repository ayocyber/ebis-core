<?php

namespace App\Http\Controllers\Settings;

use App\Enums\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Notifications\TenantInvitation;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

class InvitationController extends Controller
{
    public function store(Request $request, CurrentTenant $current): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tenant = $current->require();

        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'role' => ['required', Rule::enum(TenantRole::class)],
        ]);
        $email = strtolower($data['email']);

        if ($tenant->members()->where('email', $email)->exists()) {
            return back()->withErrors(['email' => 'This person is already a member.']);
        }

        // One live invitation per email: re-inviting replaces the old link.
        Invitation::pending()->where('email', $email)->delete();

        $token = Invitation::newToken();
        Invitation::create([
            'email' => $email,
            'role' => $data['role'],
            'token_hash' => Invitation::hashToken($token),
            'invited_by' => $request->user()->getKey(),
            'expires_at' => now()->addDays(Invitation::VALID_DAYS),
        ]);

        Notification::route('mail', $email)
            ->notify(new TenantInvitation($tenant->name, $request->user()->name, $token));

        return back()->with('success', "Invitation sent to {$email}.");
    }

    public function destroy(string $invitation): RedirectResponse
    {
        Gate::authorize('manage-tenant');

        // Scoped to the current tenant by BelongsToTenant: other companies' invitations 404.
        Invitation::findOrFail($invitation)->delete();

        return back()->with('success', 'Invitation cancelled.');
    }
}
