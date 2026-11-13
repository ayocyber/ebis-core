<?php

namespace App\Console\Commands;

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Notifications\DocumentExpiring;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * PRF-05: warn each company 90 and 30 days before a vault document expires.
 * Runs daily. Each reminder is sent once per document (alerted_90_at / alerted_30_at),
 * so a missed day catches up instead of skipping.
 */
class SendExpiryAlerts extends Command
{
    protected $signature = 'vault:expiry-alerts';

    protected $description = 'Email owners and editors about vault documents expiring in 90 or 30 days';

    public function handle(CurrentTenant $current): int
    {
        $sent = 0;
        $today = now()->startOfDay();

        Tenant::query()->each(function (Tenant $tenant) use ($current, $today, &$sent) {
            $current->runAs($tenant, function () use ($tenant, $today, &$sent) {
                $docs = VaultDocument::current()
                    ->whereNotNull('expires_at')
                    ->whereDate('expires_at', '>=', $today)
                    ->whereDate('expires_at', '<=', $today->copy()->addDays(90))
                    ->where(fn ($q) => $q->whereNull('alerted_90_at')->orWhereNull('alerted_30_at'))
                    ->get();

                if ($docs->isEmpty()) {
                    return;
                }

                $people = $tenant->members()
                    ->wherePivotIn('role', [TenantRole::Owner->value, TenantRole::Editor->value])
                    ->get();

                foreach ($docs as $doc) {
                    $days = (int) $today->diffInDays($doc->expires_at);
                    $threshold = $days <= 30 ? 30 : 90;
                    $column = "alerted_{$threshold}_at";
                    if ($doc->{$column} !== null) {
                        continue;
                    }

                    Notification::send($people, DocumentExpiring::for($tenant, $doc, $days));
                    // Inside 30 days, the 90-day reminder is no longer useful: mark both.
                    $doc->forceFill($threshold === 30
                        ? ['alerted_30_at' => now(), 'alerted_90_at' => $doc->alerted_90_at ?? now()]
                        : ['alerted_90_at' => now()])->save();

                    AuditLog::record(
                        AuditCategory::Vault,
                        "sent a {$threshold}-day renewal reminder for",
                        $doc->title,
                        detail: 'Expires '.$doc->expires_at?->format('j M Y').' · emailed '.$people->map(fn (User $u) => $u->name)->join(', ', ' and '),
                        subject: $doc,
                    );
                    $sent++;
                }
            });
        });

        $this->info("Sent {$sent} reminder(s).");

        return self::SUCCESS;
    }
}
