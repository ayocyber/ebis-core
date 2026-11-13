<?php

namespace App\Support;

use App\Enums\AuditCategory;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * The only way to write to the activity log (EVD-05).
 *
 * Entries go to the current company. With no user (scheduled jobs, the engine)
 * the entry is attributed to "EBIS".
 */
class AuditLog
{
    public const SYSTEM = 'EBIS';

    public static function record(
        AuditCategory $category,
        string $action,
        string $target,
        ?string $detail = null,
        ?Model $subject = null,
        ?User $actor = null,
        ?string $tenderId = null,
    ): AuditEvent {
        $signedIn = auth()->user();
        $actor ??= $signedIn instanceof User ? $signedIn : null;

        return AuditEvent::create([
            'actor_id' => $actor?->getKey(),
            'actor_name' => $actor !== null ? $actor->name : self::SYSTEM,
            'category' => $category,
            'action' => $action,
            'target' => $target,
            'tender_id' => $tenderId,
            'detail' => $detail !== '' ? $detail : null,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject !== null ? (string) $subject->getKey() : null,
        ]);
    }
}
