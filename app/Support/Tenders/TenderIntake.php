<?php

namespace App\Support\Tenders;

use App\Enums\AuditCategory;
use App\Enums\ExtractionStatus;
use App\Enums\TenderStage;
use App\Jobs\ExtractTenderDocumentText;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;
use ZipArchive;

/**
 * Stage 1, Ingest (ING-01 to ING-05): turns uploaded files into one tender record,
 * unpacking ZIPs, catching duplicates and queueing the text extraction.
 */
class TenderIntake
{
    /** Guards against ZIP bombs and packs too big for the server. */
    private const ZIP_MAX_ENTRIES = 100;

    private const ZIP_MAX_TOTAL_BYTES = 250 * 1024 * 1024;

    /** @var list<string> Temporary files to remove once stored. */
    private array $temp = [];

    /** @var list<string> Files left out of a ZIP, reported back to the user. */
    public array $skipped = [];

    /**
     * @param  array<string, mixed>  $details  Validated tender details
     * @param  list<UploadedFile>  $uploads
     *
     * @throws DuplicateTender when it matches an existing tender and $allowDuplicate is false
     */
    public function create(array $details, array $uploads, User $by, bool $allowDuplicate = false): Tender
    {
        try {
            $files = $this->expand($uploads);

            if (! $allowDuplicate) {
                $this->guardDuplicate($details['reference'] ?? null, $files);
            }

            $stored = $this->storeFiles($files);

            try {
                $tender = DB::transaction(function () use ($details, $stored, $by) {
                    $tender = Tender::create([
                        ...$details,
                        'stage' => TenderStage::Extraction,
                        'created_by' => $by->getKey(),
                    ]);
                    $this->record($tender, $stored, $by);

                    AuditLog::record(
                        AuditCategory::Tender,
                        'uploaded the tender',
                        $tender->label(),
                        detail: self::countLabel(count($stored)).' · '.$tender->buyer_name,
                        subject: $tender,
                        actor: $by,
                        tenderId: $tender->id,
                    );

                    return $tender;
                });
            } catch (Throwable $e) {
                $this->deleteStored($stored);
                throw $e;
            }
        } finally {
            $this->cleanUp();
        }

        $this->queueExtraction($tender);

        return $tender;
    }

    /**
     * Adds more files to an existing pack (ING-03). Files already in it are skipped.
     *
     * @param  list<UploadedFile>  $uploads
     * @return int How many documents were added
     */
    public function addDocuments(Tender $tender, array $uploads, User $by): int
    {
        try {
            $existing = $tender->documents()->pluck('sha256')->all();
            $files = array_values(array_filter($this->expand($uploads), function (IncomingFile $f) use ($existing) {
                if (in_array($f->sha256, $existing, true)) {
                    $this->skipped[] = "{$f->name} (already in this tender)";

                    return false;
                }

                return true;
            }));

            if ($files === []) {
                return 0;
            }

            $stored = $this->storeFiles($files);

            try {
                DB::transaction(function () use ($tender, $stored, $by) {
                    $this->record($tender, $stored, $by);
                    $tender->forceFill([
                        'version' => $tender->version + 1,
                        // New text to read means requirements must be looked at again.
                        'stage' => $tender->stage === TenderStage::Requirements ? TenderStage::Extraction : $tender->stage,
                    ])->save();

                    AuditLog::record(
                        AuditCategory::Tender,
                        'added documents to',
                        $tender->label(),
                        detail: implode(', ', array_map(fn (array $s) => $s['file']->name, $stored)),
                        subject: $tender,
                        actor: $by,
                        tenderId: $tender->id,
                    );
                });
            } catch (Throwable $e) {
                $this->deleteStored($stored);
                throw $e;
            }
        } finally {
            $this->cleanUp();
        }

        $this->queueExtraction($tender);

        return count($stored);
    }

    /** Reads every document still waiting, e.g. after a failed attempt is retried. */
    public function queueExtraction(Tender $tender): void
    {
        $tender->documents()
            ->withoutText()
            ->where('extraction_status', ExtractionStatus::Pending->value)
            ->pluck('id')
            ->each(fn (string $id) => ExtractTenderDocumentText::dispatch($tender->tenant_id, $id));
    }

    /**
     * @param  list<UploadedFile>  $uploads
     * @return list<IncomingFile>
     */
    private function expand(array $uploads): array
    {
        $files = [];
        foreach ($uploads as $upload) {
            $extension = strtolower($upload->getClientOriginalExtension());
            $path = (string) $upload->getRealPath();

            if ($extension === 'zip') {
                array_push($files, ...$this->unzip($path, $upload->getClientOriginalName()));

                continue;
            }

            $files[] = new IncomingFile(
                $path,
                $upload->getClientOriginalName(),
                $extension,
                (int) $upload->getSize(),
                (string) hash_file('sha256', $path),
            );
        }

        // The same file twice in one upload is stored once.
        $unique = [];
        foreach ($files as $file) {
            $unique[$file->sha256] ??= $file;
        }

        if ($unique === []) {
            throw ValidationException::withMessages([
                'files' => 'None of the files could be used. Upload PDF or Word (DOCX) documents, or a ZIP containing them.',
            ]);
        }

        return array_values($unique);
    }

    /**
     * @return list<IncomingFile>
     */
    private function unzip(string $path, string $archiveName): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw ValidationException::withMessages(['files' => "{$archiveName} could not be opened. It may be damaged."]);
        }

        try {
            if ($zip->numFiles > self::ZIP_MAX_ENTRIES) {
                throw ValidationException::withMessages([
                    'files' => "{$archiveName} has more than ".self::ZIP_MAX_ENTRIES.' files. Split it into smaller ZIPs.',
                ]);
            }

            $files = [];
            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if ($stat === false) {
                    continue;
                }

                $entry = (string) $stat['name'];
                $name = basename(str_replace('\\', '/', $entry));
                // Folders, Mac metadata and hidden files.
                if (str_ends_with($entry, '/') || str_contains($entry, '__MACOSX/') || $name === '' || str_starts_with($name, '.')) {
                    continue;
                }

                $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                if (! in_array($extension, TenderDocument::READABLE, true)) {
                    $this->skipped[] = "{$name} (only PDF and Word files are read)";

                    continue;
                }

                $size = (int) $stat['size'];
                if ($size > TenderDocument::MAX_KB * 1024) {
                    $this->skipped[] = "{$name} (larger than 50 MB)";

                    continue;
                }

                $total += $size;
                if ($total > self::ZIP_MAX_TOTAL_BYTES) {
                    throw ValidationException::withMessages([
                        'files' => "{$archiveName} unpacks to more than 250 MB. Split it into smaller ZIPs.",
                    ]);
                }

                $local = $this->tempFile();
                $in = $zip->getStream($entry);
                if ($in === false) {
                    $this->skipped[] = "{$name} (could not be unpacked)";

                    continue;
                }
                $out = fopen($local, 'wb');
                // Copy no more than the declared size, so a lying header cannot fill the disk.
                stream_copy_to_stream($in, $out, $size + 1);
                fclose($in);
                fclose($out);

                $actual = (int) filesize($local);
                if ($actual > $size) {
                    $this->skipped[] = "{$name} (could not be unpacked)";

                    continue;
                }

                $files[] = new IncomingFile($local, $name, $extension, $actual, (string) hash_file('sha256', $local), $archiveName);
            }

            return $files;
        } finally {
            $zip->close();
        }
    }

    /**
     * ING-05: same reference, or any identical file, as a tender the company already has.
     *
     * @param  list<IncomingFile>  $files
     */
    private function guardDuplicate(?string $reference, array $files): void
    {
        $reference = $reference !== null ? trim($reference) : '';
        if ($reference !== '') {
            $match = Tender::whereRaw('lower(reference) = ?', [Str::lower($reference)])->first();
            if ($match !== null) {
                throw new DuplicateTender($match, "You already have a tender with the reference {$reference}.");
            }
        }

        $hashes = array_map(fn (IncomingFile $f) => $f->sha256, $files);
        $doc = TenderDocument::withoutText()->with('tender')->whereIn('sha256', $hashes)->whereHas('tender')->first();
        if ($doc !== null) {
            throw new DuplicateTender($doc->tender, "{$doc->name} is already part of another tender.");
        }
    }

    /**
     * @param  list<IncomingFile>  $files
     * @return list<array{file: IncomingFile, disk: string, path: string}>
     */
    private function storeFiles(array $files): array
    {
        $disk = (string) config('filesystems.vault_disk', 'local');
        $tenantId = app(CurrentTenant::class)->require()->getKey();
        $stored = [];

        try {
            foreach ($files as $file) {
                $path = "tenants/{$tenantId}/tenders/".Str::uuid()->toString().'.'.$file->extension;
                $in = fopen($file->localPath, 'rb');
                $ok = Storage::disk($disk)->writeStream($path, $in);
                if (is_resource($in)) {
                    fclose($in);
                }
                if ($ok === false) {
                    throw new \RuntimeException("{$file->name} could not be stored.");
                }
                $stored[] = ['file' => $file, 'disk' => $disk, 'path' => $path];
            }
        } catch (Throwable $e) {
            $this->deleteStored($stored);
            throw $e;
        }

        return $stored;
    }

    /**
     * @param  list<array{file: IncomingFile, disk: string, path: string}>  $stored
     */
    private function record(Tender $tender, array $stored, User $by): void
    {
        foreach ($stored as ['file' => $file, 'disk' => $disk, 'path' => $path]) {
            $tender->documents()->create([
                'name' => $file->name,
                'kind' => $file->extension,
                'role' => TenderDocument::guessRole($file->name),
                'size_bytes' => $file->size,
                'disk' => $disk,
                'path' => $path,
                'sha256' => $file->sha256,
                'from_archive' => $file->fromArchive,
                'extraction_status' => ExtractionStatus::Pending,
                'uploaded_by' => $by->getKey(),
            ]);
        }
    }

    /**
     * @param  list<array{file: IncomingFile, disk: string, path: string}>  $stored
     */
    private function deleteStored(array $stored): void
    {
        foreach ($stored as ['disk' => $disk, 'path' => $path]) {
            Storage::disk($disk)->delete($path);
        }
    }

    private function tempFile(): string
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'tzip');
        $this->temp[] = $path;

        return $path;
    }

    private function cleanUp(): void
    {
        foreach ($this->temp as $path) {
            @unlink($path);
        }
        $this->temp = [];
    }

    private static function countLabel(int $n): string
    {
        return $n === 1 ? '1 document' : "{$n} documents";
    }
}
