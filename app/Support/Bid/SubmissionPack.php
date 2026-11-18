<?php

namespace App\Support\Bid;

use App\Models\BidSection;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\Tender;
use App\Models\VaultDocument;
use App\Support\Docx;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * BID-07: the submission pack, one ZIP holding every checklist item under the
 * name the buyer will see (the same names the documents screen shows).
 *
 * - the written response and unsigned forms are written as Word documents;
 * - uploaded files and signed copies go in as they were uploaded;
 * - vault documents are the same ones the checklist matched.
 *
 * Anything missing is listed in a contents file, never silently left out.
 */
class SubmissionPack
{
    /** @return array{path: string, name: string, included: list<string>, missing: list<string>} */
    public function build(Tender $tender): array
    {
        $supplier = app(CurrentTenant::class)->require()->name;
        $profile = CompanyProfile::first();
        $sections = BidSection::where('tender_id', $tender->id)->orderBy('position')->get();
        $items = ChecklistItem::where('tender_id', $tender->id)->orderBy('position')->get();
        $vault = VaultDocument::whereNull('archived_at')->get();
        $prefix = self::slug($tender->reference ?: $tender->title).'_'.self::slug($supplier);

        $path = (string) tempnam(sys_get_temp_dir(), 'pack');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $temps = [];
        $included = [];
        $missing = [];

        foreach ($items as $item) {
            $progress = $item->progress ?? [];
            if (($progress['notApplicable'] ?? false) === true) {
                continue;
            }
            $name = fn (string $ext) => "{$prefix}_{$item->file_stem}.".strtolower($ext);

            $file = match ($item->kind) {
                'response' => $this->docx($temps, fn (Docx $d) => $this->response($d, $tender, $supplier, $sections)),
                'form' => $item->file_path !== null
                    ? $this->stored($item->file_disk, $item->file_path, (string) ($progress['fileName'] ?? ''))
                    : $this->docx($temps, fn (Docx $d) => self::form($d, $item, $profile, $progress['fields'] ?? [])),
                'bid' => $item->file_path !== null
                    ? $this->stored($item->file_disk, $item->file_path, (string) ($progress['fileName'] ?? ''))
                    : null,
                'company' => $this->fromVault($item, $vault),
                default => null,
            };

            if ($file === null) {
                $missing[] = $item->title;

                continue;
            }
            [$contents, $ext] = $file;
            $entry = $name($ext);
            $zip->addFromString($entry, $contents);
            $included[] = "{$entry}  ({$item->title})";
        }

        $zip->addFromString('00_Contents.txt', $this->contents($tender, $supplier, $included, $missing));
        $zip->close();
        foreach ($temps as $t) {
            @unlink($t);
        }

        return ['path' => $path, 'name' => "{$prefix}_SubmissionPack.zip", 'included' => $included, 'missing' => $missing];
    }

    /** Same as `slug` in resources/js/lib/checklist.ts. */
    public static function slug(string $s): string
    {
        return trim((string) preg_replace('/[^A-Za-z0-9]+/', '-', $s), '-');
    }

    /**
     * @param  list<string>  $temps
     * @param  callable(Docx): void  $fill
     * @return array{string, string}
     */
    private function docx(array &$temps, callable $fill): array
    {
        $docx = new Docx;
        $fill($docx);
        $temps[] = $path = (string) tempnam(sys_get_temp_dir(), 'docx');
        $docx->save($path);

        return [(string) file_get_contents($path), 'docx'];
    }

    /** @param  iterable<BidSection>  $sections */
    private function response(Docx $d, Tender $tender, string $supplier, iterable $sections): void
    {
        $d->heading($tender->title)
            ->paragraph(trim(implode(' · ', array_filter([$tender->reference, $tender->buyer_name]))))
            ->paragraph("Response from {$supplier}");
        foreach ($sections as $section) {
            $d->heading($section->title, 2);
            if (trim((string) $section->body) === '') {
                $d->paragraph('(Not written yet)');
            } else {
                $d->paragraphs((string) $section->body);
            }
        }
    }

    /**
     * A buyer form with its answers, ready to print and sign (BID-06). Answers not
     * given fall back to what the company profile holds.
     *
     * @param  array<string, string|null>  $answers
     */
    public static function form(Docx $d, ChecklistItem $item, ?CompanyProfile $profile, array $answers): void
    {
        $d->heading($item->title);
        foreach ($item->toFrontend($profile)['fields'] ?? [] as $field) {
            $value = trim((string) ($answers[$field['id']] ?? $field['prefill'] ?? ''));
            $d->paragraph($field['label'], true)->paragraph($value !== '' ? $value : '(Not answered)');
        }
        if ($item->signature) {
            $d->paragraph('')->paragraph('Signed: ______________________    Date: ____________');
        }
    }

    /** @return array{string, string}|null */
    private function stored(?string $disk, string $path, string $fileName): ?array
    {
        $storage = Storage::disk((string) $disk);
        if (! $storage->exists($path)) {
            return null;
        }
        $ext = pathinfo($fileName !== '' ? $fileName : $path, PATHINFO_EXTENSION) ?: 'bin';

        return [(string) $storage->get($path), $ext];
    }

    /**
     * The vault document the checklist shows: title matches, latest expiry first.
     *
     * @param  iterable<VaultDocument>  $vault
     * @return array{string, string}|null
     */
    private function fromVault(ChecklistItem $item, iterable $vault): ?array
    {
        if ($item->vault_match === null) {
            return null;
        }
        $pattern = '~'.str_replace('~', '\~', $item->vault_match).'~i';
        $best = null;
        foreach ($vault as $doc) {
            if (@preg_match($pattern, $doc->title) !== 1) {
                continue;
            }
            $expiry = $doc->expires_at->timestamp ?? PHP_INT_MAX;
            if ($best === null || $expiry > ($best->expires_at->timestamp ?? PHP_INT_MAX)) {
                $best = $doc;
            }
        }

        return $best === null ? null : $this->stored($best->disk, $best->path, $best->file_name);
    }

    /**
     * @param  list<string>  $included
     * @param  list<string>  $missing
     */
    private function contents(Tender $tender, string $supplier, array $included, array $missing): string
    {
        $lines = [
            "Submission pack: {$tender->label()}",
            "Supplier: {$supplier}",
            'Buyer: '.($tender->buyer_name ?? ''),
            'Deadline: '.$tender->deadline->timezone('Europe/London')->format('j F Y, H:i'),
            'Made by ProcurPilot on '.now()->timezone('Europe/London')->format('j F Y, H:i'),
            '',
            'In this pack:',
            ...array_map(fn ($l) => "  - {$l}", $included),
        ];
        if ($missing !== []) {
            $lines = [...$lines, '', 'NOT in this pack (add these before you submit):', ...array_map(fn ($l) => "  - {$l}", $missing)];
        }
        $lines[] = '';
        $lines[] = "Check each file, then upload them to the buyer's e-tendering portal.";

        return implode("\r\n", $lines)."\r\n";
    }
}
