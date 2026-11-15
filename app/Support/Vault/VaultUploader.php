<?php

namespace App\Support\Vault;

use App\Enums\AuditCategory;
use App\Enums\VaultCategory;
use App\Models\CompanyProfile;
use App\Models\ProfileFact;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Saves a file to the evidence vault: stores it privately, records the profile
 * fact it proves (PRF-02), archives the version it replaces and logs it (EVD-05).
 */
class VaultUploader
{
    /**
     * @param  array{title: string, category: string, issuer?: string|null, reference?: string|null, issued_at?: string|null, expires_at?: string|null, summary?: string|null, fact_keys?: list<string>|null, replaces_id?: string|null}  $details
     */
    public function store(UploadedFile $file, array $details, User $by): VaultDocument
    {
        $disk = config('filesystems.vault_disk', 'local');
        $extension = strtolower($file->getClientOriginalExtension());
        $tenantId = (string) app(CurrentTenant::class)->id();
        $path = $file->storeAs("tenants/{$tenantId}/vault", Str::uuid()->toString().'.'.$extension, $disk);
        if ($path === false) {
            throw new RuntimeException('The file could not be stored.');
        }

        try {
            $doc = DB::transaction(fn () => $this->record($file, $details, $by, $disk, $path, $extension));
        } catch (Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }

        $this->check($doc, (string) $file->getRealPath());

        return $doc;
    }

    /**
     * Check the document's text against what it claims to be. A failing check never
     * stops the upload; the document is then simply left unchecked.
     */
    public function check(VaultDocument $doc, ?string $localPath = null): void
    {
        $temp = null;
        try {
            if ($localPath === null) {
                $temp = (string) tempnam(sys_get_temp_dir(), 'vchk');
                $in = Storage::disk($doc->disk)->readStream($doc->path);
                if ($in === null) {
                    return;
                }
                $out = fopen($temp, 'wb');
                stream_copy_to_stream($in, $out);
                fclose($out);
                fclose($in);
                $localPath = $temp;
            }

            $result = app(DocumentChecker::class)->check($doc, $localPath, CompanyProfile::first());
            $doc->forceFill(['check_status' => $result->status(), 'check_notes' => $result->notes, 'checked_at' => now()])->save();
        } catch (Throwable $e) {
            report($e);
        } finally {
            if ($temp !== null) {
                @unlink($temp);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $details
     */
    private function record(UploadedFile $file, array $details, User $by, string $disk, string $path, string $extension): VaultDocument
    {
        $category = VaultCategory::from($details['category']);
        $replaced = isset($details['replaces_id'])
            ? VaultDocument::with('facts')->current()->findOrFail($details['replaces_id'])
            : null;

        $doc = VaultDocument::create([
            'title' => trim($details['title']),
            'category' => $category,
            'file_name' => $file->getClientOriginalName(),
            'kind' => VaultDocument::kindFor($extension),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size_bytes' => $file->getSize(),
            'disk' => $disk,
            'path' => $path,
            'sha256' => (string) hash_file('sha256', $file->getRealPath()),
            'issuer' => $details['issuer'] ?? null,
            'reference' => $details['reference'] ?? null,
            'issued_at' => $details['issued_at'] ?? null,
            'expires_at' => $details['expires_at'] ?? null,
            'summary' => $details['summary'] ?? null,
            'replaces_id' => $replaced?->id,
            'uploaded_by' => $by->getKey(),
        ]);

        // The renewal proves the same facts as the old version, with the new dates.
        $keys = $replaced !== null
            ? $replaced->facts->map(fn (ProfileFact $f) => $f->key)->filter()->values()->all()
            : ($details['fact_keys'] ?? []);
        $keys = $keys === [] ? [null] : array_values(array_unique($keys));

        foreach ($keys as $key) {
            $doc->facts()->create([
                'key' => $key,
                'label' => $doc->title,
                'value' => $doc->reference ?? $doc->title,
                'source' => $category->factSource(),
                'issued_at' => $doc->issued_at,
                'expires_at' => $doc->expires_at,
                // The uploader checked the details in the upload form (PRF-04).
                'verified_at' => now(),
                'verified_by' => $by->getKey(),
            ]);
        }

        if ($replaced !== null) {
            // Old facts stay untouched: past assessments point at them.
            $replaced->forceFill(['archived_at' => now()])->save();
        }

        AuditLog::record(
            AuditCategory::Vault,
            $replaced !== null ? 'renewed' : 'added to the evidence vault',
            $doc->title,
            detail: implode(' · ', array_filter([
                $doc->file_name,
                $doc->expires_at !== null ? 'valid to '.Carbon::parse($doc->expires_at)->format('j M Y') : null,
            ])),
            subject: $doc,
            actor: $by,
        );

        return $doc;
    }

    public function delete(VaultDocument $doc, User $by): void
    {
        DB::transaction(function () use ($doc, $by) {
            $doc->delete();
            AuditLog::record(AuditCategory::Vault, 'deleted from the evidence vault', $doc->title, $doc->file_name, $doc, $by);
        });
        // The file is kept: soft-deleted documents may still back past assessments.
    }
}
