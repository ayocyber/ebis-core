<?php

namespace App\Notifications;

use App\Models\Tenant;
use App\Models\VaultDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** PRF-05: a vault document expires in 90 or 30 days. */
class DocumentExpiring extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $tenantName,
        public readonly string $title,
        public readonly string $expiresOn,
        public readonly int $days,
    ) {}

    public static function for(Tenant $tenant, VaultDocument $doc, int $days): self
    {
        return new self($tenant->name, $doc->title, (string) $doc->expires_at?->format('j F Y'), $days);
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->title} expires in {$this->days} days")
            ->greeting('Time to renew')
            ->line("{$this->tenantName}’s {$this->title} expires on {$this->expiresOn}.")
            ->line('Tenders that close after that date will treat it as missing. Upload the renewal to the evidence vault when you have it.')
            ->action('Open the evidence vault', route('vault.index'));
    }
}
