<?php

namespace App\Support\Privacy;

use App\Models\Assessment;
use App\Models\AuditEvent;
use App\Models\BidSection;
use App\Models\BidSectionVersion;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\EligibilityRun;
use App\Models\Gap;
use App\Models\Invitation;
use App\Models\ProfileFact;
use App\Models\ReadinessCheck;
use App\Models\Requirement;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Models\TenderDocument;
use App\Models\VaultDocument;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * SEC-02 (GDPR): everything a company holds, exported or erased.
 *
 * Every tenant table cascades from `tenants`, and every file sits under
 * tenants/{id}/ on the vault disk, so erasing is: delete the folder, delete the row.
 */
class CompanyData
{
    /**
     * Tenant-owned data, in export order. File columns say where each row's file is.
     *
     * @var array<string, class-string<Model>>
     */
    public const TABLES = [
        'company_profile' => CompanyProfile::class,
        'profile_facts' => ProfileFact::class,
        'vault_documents' => VaultDocument::class,
        'tenders' => Tender::class,
        'tender_documents' => TenderDocument::class,
        'requirements' => Requirement::class,
        'eligibility_runs' => EligibilityRun::class,
        'assessments' => Assessment::class,
        'gaps' => Gap::class,
        'decisions' => TenderDecision::class,
        'bid_sections' => BidSection::class,
        'bid_section_versions' => BidSectionVersion::class,
        'checklist_items' => ChecklistItem::class,
        'readiness_checks' => ReadinessCheck::class,
        'invitations' => Invitation::class,
        'activity_log' => AuditEvent::class,
    ];

    public function __construct(private CurrentTenant $current) {}

    /**
     * A ZIP of the company's data as JSON, plus every stored file.
     *
     * @return array{path: string, name: string}
     */
    public function export(Tenant $tenant): array
    {
        return $this->current->runAs($tenant, function () use ($tenant) {
            $path = (string) tempnam(sys_get_temp_dir(), 'export');
            $zip = new ZipArchive;
            $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
            $temps = [];

            $members = $tenant->members()->get()->map(fn ($u) => [
                'name' => $u->name, 'email' => $u->email, 'role' => $u->pivot->role, 'joined_at' => $u->pivot->joined_at,
            ]);
            $zip->addFromString('data/company.json', self::json([
                ...$tenant->only(['id', 'name', 'country', 'time_zone', 'data_region', 'created_at']),
                'members' => $members,
            ]));

            foreach (self::TABLES as $name => $model) {
                $query = $model::query();
                if (in_array(SoftDeletes::class, class_uses_recursive($model), true)) {
                    $query->withTrashed();
                }
                // The text read from tender files is left out: the files themselves are in files/.
                $rows = $query->get()->map(fn (Model $m) => $m->attributesToArray());
                $zip->addFromString("data/{$name}.json", self::json($rows));
            }

            $files = $this->files($tenant);
            foreach ($files as $file) {
                $temps[] = $temp = (string) tempnam(sys_get_temp_dir(), 'file');
                $in = Storage::disk($file['disk'])->readStream($file['path']);
                if ($in === null) {
                    continue;
                }
                file_put_contents($temp, $in);
                fclose($in);
                $zip->addFile($temp, 'files/'.$file['folder'].'/'.$file['name']);
            }

            $zip->addFromString('README.txt', implode("\r\n", [
                "Everything ProcurPilot holds for {$tenant->name}, exported on ".now()->timezone('Europe/London')->format('j F Y, H:i').'.',
                '',
                'data/   one JSON file per kind of record (tenders, requirements, bid sections, the activity log, ...)',
                'files/  every file uploaded: the evidence vault, tender packs and files added to bids',
                '',
                'Deleted items still kept for the audit trail are included; they have a deleted_at date.',
            ])."\r\n");
            $zip->close();
            foreach ($temps as $t) {
                @unlink($t);
            }

            $slug = trim((string) preg_replace('/[^A-Za-z0-9]+/', '-', $tenant->name), '-');

            return ['path' => $path, 'name' => "{$slug}_ProcurPilot-data_".now()->format('Y-m-d').'.zip'];
        });
    }

    /**
     * Erase the company for good: its files, then every row (the database cascades).
     */
    public function erase(Tenant $tenant): void
    {
        $id = $tenant->getKey();
        foreach (array_unique([(string) config('filesystems.vault_disk', 'local'), 'local']) as $disk) {
            Storage::disk($disk)->deleteDirectory("tenants/{$id}");
        }
        // Files stored somewhere other than the usual folder (should not happen, but never leave one behind).
        $this->current->runAs($tenant, function () use ($tenant) {
            foreach ($this->files($tenant) as $file) {
                Storage::disk($file['disk'])->delete($file['path']);
            }
        });

        DB::transaction(function () use ($tenant) {
            DB::table('users')->where('current_tenant_id', $tenant->getKey())->update(['current_tenant_id' => null]);
            $tenant->forceDelete();
        });
    }

    /**
     * Every stored file the company has, with a readable name for the export.
     *
     * @return list<array{disk: string, path: string, folder: string, name: string}>
     */
    private function files(Tenant $tenant): array
    {
        $files = [];
        $used = [];
        $add = function (string $folder, ?string $disk, ?string $path, string $name) use (&$files, &$used) {
            if ($disk === null || $path === null || $path === '') {
                return;
            }
            $name = str_replace(['/', '\\'], '-', $name !== '' ? $name : basename($path));
            $key = "{$folder}/{$name}";
            for ($i = 2; isset($used[$key]); $i++) {
                $key = $folder.'/'.pathinfo($name, PATHINFO_FILENAME)." ({$i}).".pathinfo($name, PATHINFO_EXTENSION);
            }
            $used[$key] = true;
            $files[] = ['disk' => $disk, 'path' => $path, 'folder' => $folder, 'name' => substr($key, strlen($folder) + 1)];
        };

        foreach (VaultDocument::withTrashed()->get() as $doc) {
            $add('vault', $doc->disk, $doc->path, $doc->file_name);
        }
        foreach (TenderDocument::withTrashed()->withoutText()->get() as $doc) {
            $add('tenders', $doc->disk, $doc->path, $doc->name);
        }
        foreach (ChecklistItem::withTrashed()->whereNotNull('file_path')->get() as $item) {
            $add('bid-files', $item->file_disk, $item->file_path, (string) ($item->progress['fileName'] ?? ''));
        }

        return array_values(array_filter($files, fn ($f) => Storage::disk($f['disk'])->exists($f['path'])));
    }

    private static function json(mixed $data): string
    {
        return (string) json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
