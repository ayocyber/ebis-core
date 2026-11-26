<?php

namespace App\Support;

use App\Enums\AuditCategory;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * The only way to write to the activity log (EVD-05).
 *
 * Entries go to the current company. With no user (scheduled jobs, the engine)
 * the entry is attributed to "ProcurPilot".
 */
class AuditLog
{
    public const SYSTEM = 'ProcurPilot';

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
            // The columns hold 255 characters. Postgres refuses longer text (SQLite doesn't), and a long
            // tender reference plus title went over, so the whole action failed.
            'action' => Str::limit($action, 252),
            'target' => Str::limit($target, 252),
            'tender_id' => $tenderId,
            'detail' => $detail !== '' ? $detail : null,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject !== null ? (string) $subject->getKey() : null,
        ]);
    }
}
