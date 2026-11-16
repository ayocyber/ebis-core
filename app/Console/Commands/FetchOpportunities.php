<?php

namespace App\Console\Commands;

use App\Support\Opportunities\OpportunityFeed;
use Illuminate\Console\Command;

class FetchOpportunities extends Command
{
    protected $signature = 'tenders:fetch-opportunities {--days=14 : How far back to look on the first run}';

    protected $description = 'Pull open tenders from Find a Tender and Contracts Finder';

    public function handle(OpportunityFeed $feed): int
    {
        foreach ($feed->fetch((int) $this->option('days')) as $source => $r) {
            $this->line("{$source}: {$r['saved']} saved".($r['error'] ? " (stopped: {$r['error']})" : ''));
        }

        return self::SUCCESS;
    }
}
