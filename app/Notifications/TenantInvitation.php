<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TenantInvitation extends Notification
{
    use Queueable;

    public function __construct(
        public string $companyName,
        public string $inviterName,
        public string $token,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("You're invited to {$this->companyName} on ".config('app.name'))
            ->line("{$this->inviterName} invited you to join {$this->companyName}.")
            ->action('Accept invitation', route('invitations.show', $this->token))
            ->line('The link works for 7 days.');
    }
}
