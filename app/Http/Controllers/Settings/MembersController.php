<?php

namespace App\Http\Controllers\Settings;

use App\Enums\TenantRole;
use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings > Members: who is in the company, their roles, pending invitations.
 */
class MembersController extends Controller
{
    public function index(Request $request, CurrentTenant $current): Response
    {
        $tenant = $current->require();

        return Inertia::render('settings/members', [
            'members' => $tenant->members()->orderBy('name')->get()->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->pivot->role->value,
                'isYou' => $u->is($request->user()),
            ]),
            'invitations' => Invitation::pending()->latest()->get()->map(fn (Invitation $i) => [
                'id' => $i->id,
                'email' => $i->email,
                'role' => $i->role->value,
                'expiresAt' => $i->expires_at->toIso8601String(),
            ]),
            'roles' => collect(TenantRole::cases())->map(fn ($r) => ['value' => $r->value, 'label' => $r->label()]),
            'canManage' => Gate::allows('manage-tenant'),
        ]);
    }

    public function update(Request $request, CurrentTenant $current, int $user): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tenant = $current->require();

        $data = $request->validate(['role' => ['required', Rule::enum(TenantRole::class)]]);
        $member = $tenant->members()->whereKey($user)->firstOrFail();

        $newRole = TenantRole::from($data['role']);
        $leavingOwner = $member->pivot->role === TenantRole::Owner && $newRole !== TenantRole::Owner;

        if ($leavingOwner && $tenant->ownersCount() === 1) {
            return back()->with('error', 'A company needs at least one Owner.');
        }

        $tenant->members()->updateExistingPivot($member->getKey(), ['role' => $newRole->value]);

        return back()->with('success', "{$member->name} is now {$newRole->label()}.");
    }

    public function destroy(CurrentTenant $current, int $user): RedirectResponse
    {
        Gate::authorize('manage-tenant');
        $tenant = $current->require();

        $member = $tenant->members()->whereKey($user)->firstOrFail();

        if ($member->pivot->role === TenantRole::Owner && $tenant->ownersCount() === 1) {
            return back()->with('error', 'A company needs at least one Owner.');
        }

        $tenant->members()->detach($member->getKey());

        if ($member->current_tenant_id === $tenant->getKey()) {
            $member->forceFill(['current_tenant_id' => null])->save();
        }

        return back()->with('success', "{$member->name} was removed.");
    }
}
