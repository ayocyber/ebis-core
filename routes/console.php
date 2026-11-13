<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// PRF-05: 90- and 30-day renewal reminders for vault documents.
Schedule::command('vault:expiry-alerts')->dailyAt('07:00')->timezone('Europe/London')->withoutOverlapping();
