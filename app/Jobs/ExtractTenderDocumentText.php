<?php

namespace App\Jobs;

use App\Enums\ExtractionStatus;
use App\Models\Tenant;
use App\Models\TenderDocument;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenders\ExtractionResult;
use App\Support\Tenders\TextExtractor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Reads one tender document's text (ING-02). Queued, so it can move to a worker
 * later; on the free Render plan the queue is `sync` and it runs during the upload.
 */
class ExtractTenderDocumentText implements ShouldQueue
{
    use Queueable;

    public int $timeout = 300;

    public function __construct(public string $tenantId, public string $documentId) {}

    public function handle(TextExtractor $extractor, CurrentTenant $current): void
    {
        $tenant = Tenant::find($this->tenantId);
        if ($tenant === null) {
            return;
        }

        $current->runAs($tenant, function () use ($extractor) {
            $doc = TenderDocument::with('tender')->find($this->documentId);
            if ($doc === null) {
                return;
            }

            $result = $this->read($doc, $extractor);

            $doc->forceFill([
                'extraction_status' => $result->status,
                'extracted_text' => $result->text,
                'pages' => $result->pages ?? $doc->pages,
                'unreadable_pages' => $result->unreadablePages ?: null,
                'extraction_error' => $result->error,
                'extracted_at' => now(),
            ])->save();

            $doc->tender->refreshStage();
        });
    }

    private function read(TenderDocument $doc, TextExtractor $extractor): ExtractionResult
    {
        $disk = Storage::disk($doc->disk);
        $stream = $disk->readStream($doc->path);
        if ($stream === null) {
            return ExtractionResult::failed('The file is missing from storage. Upload it again.');
        }

        // Parsers need a local file; cloud disks only hand back a stream.
        $local = tempnam(sys_get_temp_dir(), 'tender');
        try {
            $out = fopen($local, 'wb');
            stream_copy_to_stream($stream, $out);
            fclose($out);

            $previous = ini_get('memory_limit');
            ini_set('memory_limit', '384M');
            try {
                return $extractor->extract($local, $doc->kind);
            } finally {
                ini_set('memory_limit', (string) $previous);
            }
        } catch (Throwable $e) {
            report($e);

            return ExtractionResult::failed('The file could not be read. Try again, or upload it again.');
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
            @unlink($local);
        }
    }

    public function failed(Throwable $e): void
    {
        $tenant = Tenant::find($this->tenantId);
        if ($tenant === null) {
            return;
        }

        app(CurrentTenant::class)->runAs($tenant, function () {
            TenderDocument::whereKey($this->documentId)
                ->where('extraction_status', ExtractionStatus::Pending->value)
                ->update([
                    'extraction_status' => ExtractionStatus::Failed->value,
                    'extraction_error' => 'Reading this file took too long. Try again, or split it into smaller files.',
                ]);
        });
    }
}
