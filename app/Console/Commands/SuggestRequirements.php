<?php

namespace App\Console\Commands;

use App\Enums\ExtractionStatus;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\TenderDocument;
use App\Support\Requirements\RequirementBook;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Console\Command;

/**
 * Suggests requirements for documents read before requirement suggestions existed.
 * Safe to run on every deploy: documents that already have suggestions (or had
 * them dismissed) are skipped.
 */
class SuggestRequirements extends Command
{
    protected $signature = 'tenders:suggest-requirements';

    protected $description = 'Suggest requirements from tender documents that have none yet';

    public function handle(CurrentTenant $current, RequirementBook $book): int
    {
        $added = 0;

        Tenant::query()->each(function (Tenant $tenant) use ($current, $book, &$added) {
            $current->runAs($tenant, function () use ($book, &$added) {
                $withSuggestions = Requirement::withTrashed()->whereNotNull('document_id')->distinct()->pluck('document_id')->all();

                TenderDocument::withoutText()
                    ->whereHas('tender')
                    ->whereIn('extraction_status', [ExtractionStatus::Done->value, ExtractionStatus::Partial->value])
                    ->whereNotIn('id', $withSuggestions)
                    ->each(function (TenderDocument $doc) use ($book, &$added) {
                        $added += $book->suggestFrom($doc);
                    });
            });
        });

        $this->info("{$added} requirement suggestions added.");

        return self::SUCCESS;
    }
}
