<?php

namespace App\Console\Commands;

use App\Models\BidSection;
use App\Models\ChecklistItem;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\VaultDocument;
use App\Support\Privacy\CompanyData;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * SEC-02 retention: anything deleted in the app is kept for 30 days (so a mistake
 * can be undone by support), then erased for good, files included.
 */
class PurgeDeleted extends Command
{
    public const DAYS = 30;

    protected $signature = 'privacy:purge-deleted';

    protected $description = 'Erase records and files deleted more than 30 days ago';

    public function handle(CompanyData $companies): int
    {
        $before = now()->subDays(self::DAYS);
        $count = 0;

        foreach (Tenant::onlyTrashed()->where('deleted_at', '<', $before)->get() as $tenant) {
            $companies->erase($tenant);
            $count++;
        }

        // Tenders first: erasing one takes its documents, requirements, bid and checklist with it.
        $count += $this->purge(Tender::onlyTrashed()->withoutGlobalScope('tenant'), $before, function (Tender $tender) {
            foreach (TenderDocument::withoutGlobalScope('tenant')->withTrashed()->where('tender_id', $tender->id)->get() as $doc) {
                Storage::disk($doc->disk)->delete($doc->path);
            }
            foreach (ChecklistItem::withoutGlobalScope('tenant')->withTrashed()->where('tender_id', $tender->id)->whereNotNull('file_path')->get() as $item) {
                Storage::disk((string) $item->file_disk)->delete((string) $item->file_path);
            }
        });
        $count += $this->purge(TenderDocument::onlyTrashed()->withoutGlobalScope('tenant'), $before, function (TenderDocument $d) {
            Storage::disk($d->disk)->delete($d->path);
        });
        $count += $this->purge(ChecklistItem::onlyTrashed()->withoutGlobalScope('tenant'), $before, function (ChecklistItem $i) {
            if ($i->file_path !== null) {
                Storage::disk((string) $i->file_disk)->delete($i->file_path);
            }
        });
        $count += $this->purge(VaultDocument::onlyTrashed()->withoutGlobalScope('tenant'), $before, function (VaultDocument $d) {
            Storage::disk($d->disk)->delete($d->path);
        });
        $count += $this->purge(Requirement::onlyTrashed()->withoutGlobalScope('tenant'), $before);
        $count += $this->purge(BidSection::onlyTrashed()->withoutGlobalScope('tenant'), $before);

        $this->info("Erased {$count} deleted ".($count === 1 ? 'item' : 'items').'.');

        return self::SUCCESS;
    }

    /**
     * @template T of Model
     *
     * @param  Builder<T>  $trashed
     * @param  (callable(T): void)|null  $files
     */
    private function purge(Builder $trashed, \DateTimeInterface $before, ?callable $files = null): int
    {
        $count = 0;
        $trashed->where('deleted_at', '<', $before)->chunkById(100, function ($rows) use ($files, &$count) {
            foreach ($rows as $row) {
                if ($files !== null) {
                    $files($row);
                }
                $row->forceDelete();
                $count++;
            }
        });

        return $count;
    }
}
