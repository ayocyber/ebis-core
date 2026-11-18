<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// PRF-05: 90- and 30-day renewal reminders for vault documents.
Schedule::command('vault:expiry-alerts')->dailyAt('07:00')->timezone('Europe/London')->withoutOverlapping();

// New tenders from Find a Tender and Contracts Finder.
Schedule::command('tenders:fetch-opportunities')->hourly()->withoutOverlapping();

// SEC-02: anything deleted more than 30 days ago is erased for good, files included.
// Hourly, because the free server sleeps and a nightly run could be missed.
Schedule::command('privacy:purge-deleted')->hourly()->withoutOverlapping();
