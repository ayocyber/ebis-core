<?php

namespace App\Http\Controllers;

use App\Models\Invitation;
use App\Models\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The link in an invitation email. Works for guests (they sign in or register
 * first and come back here) and for signed-in users.
 */
class AcceptInvitationController extends Controller
{
    public function show(Request $request, string $token): Response
    {
        $invitation = Invitation::findByToken($token);
        $user = $request->user();

        if ($user === null && $invitation?->isPending()) {
            // After login or registration, come back to this page.
            $request->session()->put('url.intended', $request->fullUrl());
        }

        return Inertia::render('invitations/accept', [
            'token' => $token,
            'invitation' => $invitation?->isPending() ? [
                'email' => $invitation->email,
                'role' => $invitation->role->label(),
                'company' => Tenant::find($invitation->tenant_id)?->name,
            ] : null,
            'emailMatches' => $user && $invitation && strcasecmp($user->email, $invitation->email) === 0,
        ]);
    }

    public function store(Request $request, string $token): RedirectResponse
    {
        $invitation = Invitation::findByToken($token);
        $user = $request->user();

        if (! $invitation?->isPending()) {
            return back()->with('error', 'This invitation has expired or was already used.');
        }

        if (strcasecmp($user->email, $invitation->email) !== 0) {
            return back()->with('error', "This invitation is for {$invitation->email}. Sign in with that email to accept it.");
        }

        $tenant = Tenant::findOrFail($invitation->tenant_id);

        DB::transaction(function () use ($invitation, $tenant, $user) {
            $tenant->addMember($user, $invitation->role);
            $invitation->forceFill(['accepted_at' => now()])->save();
            $user->switchTenant($tenant);
        });

        return redirect()->route('dashboard')->with('success', "Welcome to {$tenant->name}.");
    }
}
