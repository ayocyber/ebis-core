<?php

namespace App\Enums;

/**
 * A person's role inside one company (spec section 3).
 */
enum TenantRole: string
{
    case Owner = 'owner';
    case Editor = 'editor';
    case Viewer = 'viewer';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    /** Upload tenders, edit the profile, override statuses, edit bids. */
    public function canEdit(): bool
    {
        return $this !== self::Viewer;
    }

    /** Invite people, change roles, go / no-go, sign-off, billing. */
    public function isOwner(): bool
    {
        return $this === self::Owner;
    }
}
