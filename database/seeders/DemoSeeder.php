<?php

namespace Database\Seeders;

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Enums\VaultCategory;
use App\Models\CompanyProfile;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use App\Support\Tenders\TenderIntake;
use Illuminate\Database\Seeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Demo company for showing the app: Bluewave Networks Ltd (fictional), the same
 * company the sample tenders are written for, so vault facts line up with them.
 *
 *   php artisan db:seed --class=DemoSeeder
 *   Sign in as emma@bluewave.example / password
 *
 * Files are one-page placeholder PDFs. Data comes from data/bluewave.json, exported
 * from resources/js/data/mock-vault.ts.
 */
class DemoSeeder extends Seeder
{
    public function run(CurrentTenant $current): void
    {
        /** @var array{profile: array<string, mixed>, documents: list<array<string, mixed>>} $data */
        $data = json_decode((string) file_get_contents(__DIR__.'/data/bluewave.json'), true, flags: JSON_THROW_ON_ERROR);

        // Safe to run on every deploy: the company is created once, the demo tenders once.
        $existing = Tenant::where('name', $data['profile']['legalName'])->first();
        if ($existing !== null) {
            $this->command?->info('Demo company already exists.');
            $this->seedTenders($existing, $current);

            return;
        }

        $owner = $this->person('Emma Richardson');
        $tenant = Tenant::create(['name' => $data['profile']['legalName'], 'created_by' => $owner->id]);
        $tenant->addMember($owner, TenantRole::Owner);
        $owner->switchTenant($tenant);

        $current->runAs($tenant, function () use ($data, $tenant, $owner) {
            $p = $data['profile'];
            CompanyProfile::create([
                'legal_name' => $p['legalName'], 'trading_name' => $p['tradingName'], 'company_number' => $p['companyNumber'],
                'incorporated_at' => substr((string) $p['incorporatedAt'], 0, 10), 'registered_office' => $p['registeredOffice'],
                'vat_number' => $p['vatNumber'], 'cdp_id' => $p['cdpId'], 'website' => $p['website'], 'sector' => $p['sector'],
                'employees' => $p['employees'], 'engineers' => $p['engineers'], 'turnover' => $p['turnover'],
                'auditor' => $p['auditor'], 'insurance' => $p['insurance'], 'social_value' => $p['socialValue'],
                'about' => $p['about'], 'updated_by' => $owner->id,
            ]);

            $disk = (string) config('filesystems.vault_disk', 'local');
            foreach ($data['documents'] as $d) {
                $uploader = $this->person((string) $d['uploadedBy']);
                if (! $uploader->belongsToTenant($tenant)) {
                    $tenant->addMember($uploader, TenantRole::Editor);
                    $uploader->switchTenant($tenant);
                }

                $fileName = (string) ($d['fileName'] ?? $d['title'].'.pdf');
                $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION)) ?: 'pdf';
                $path = "tenants/{$tenant->id}/vault/".Str::uuid().'.'.$extension;
                $pdf = self::placeholderPdf((string) $d['title']);
                Storage::disk($disk)->put($path, $pdf);

                $doc = new VaultDocument([
                    'title' => $d['title'], 'category' => VaultCategory::from((string) $d['category']), 'file_name' => $fileName,
                    'kind' => VaultDocument::kindFor($extension), 'mime_type' => 'application/pdf', 'size_bytes' => strlen($pdf),
                    'disk' => $disk, 'path' => $path, 'sha256' => hash('sha256', $pdf), 'issuer' => $d['issuer'],
                    'reference' => $d['reference'], 'issued_at' => $d['issuedAt'], 'expires_at' => $d['expiresAt'],
                    'summary' => $d['summary'], 'uploaded_by' => $uploader->id,
                ]);
                $doc->created_at = Carbon::parse((string) $d['uploadedAt']);
                $doc->save();

                $keys = $d['factIds'] === [] ? [null] : $d['factIds'];
                foreach ($keys as $key) {
                    $doc->facts()->create([
                        'key' => $key, 'label' => $doc->title, 'value' => $doc->reference ?? $doc->title,
                        'source' => $doc->category->factSource(), 'issued_at' => $doc->issued_at, 'expires_at' => $doc->expires_at,
                        'verified_at' => $doc->created_at, 'verified_by' => $uploader->id,
                    ]);
                }
            }

            AuditLog::record(AuditCategory::Profile, 'loaded the demo company', $tenant->name, count($data['documents']).' vault documents');
        });

        $this->seedTenders($tenant, $current);

        $this->command?->info('Demo ready. Sign in as emma@bluewave.example with DEMO_PASSWORD (or "password" locally).');
    }

    /**
     * Two uploaded tenders, so the dashboard and tender list have real data. Runs
     * once: deleted demo tenders are not brought back on the next deploy.
     */
    private function seedTenders(Tenant $tenant, CurrentTenant $current): void
    {
        $current->runAs($tenant, function () use ($tenant) {
            if (Tender::withTrashed()->exists()) {
                return;
            }

            /** @var User $owner */
            $owner = $tenant->members()->where('email', 'emma@bluewave.example')->first() ?? $tenant->members()->firstOrFail();
            $intake = app(TenderIntake::class);
            $at = fn (int $days) => now()->addDays($days)->setTime(12, 0);

            $intake->create([
                'title' => 'Managed Wi-Fi and network support for nine city libraries',
                'reference' => 'ECC/ICT/2026/088',
                'buyer_name' => 'Eastbrook City Council',
                'buyer_type' => 'local',
                'buyer_location' => 'Eastbrook, England',
                'sector' => 'ICT infrastructure',
                'deadline' => $at(24),
                'clarification_deadline' => $at(10),
                'estimated_value' => 450_000,
                'lots' => 1,
                'summary' => 'Replace public and staff Wi-Fi across nine libraries and provide a 36-month managed support service.',
            ], [
                self::demoPdf('ITT - Instructions to tenderers.pdf', [
                    ['Eastbrook City Council - Invitation to Tender ECC/ICT/2026/088', 'Managed Wi-Fi and network support for nine city libraries',
                        '1. Tenders must be submitted through the council portal by 12:00 on the deadline date.',
                        '2. Late tenders will not be considered.', '3. Clarification questions must be sent at least 14 days before the deadline.'],
                    ['4. Selection criteria', '4.1 Minimum annual turnover of GBP 900,000 in each of the last two financial years.',
                        '4.2 Cyber Essentials Plus certification, valid on the submission deadline.',
                        '4.3 Public liability insurance of at least GBP 5,000,000 and employer\'s liability of GBP 10,000,000.',
                        '4.4 Two contracts of similar scope delivered for a public body in the last five years.'],
                ]),
                self::demoPdf('Specification.pdf', [
                    ['Section 2 - Specification', '2.1 Supply and install Wi-Fi 6E access points in all nine libraries.',
                        '2.2 Separate public and staff networks with content filtering on the public network.',
                        '2.3 Provide 24/7 monitoring and a 4-hour fix for priority-one faults.'],
                    ['2.4 Engineers working on site must hold an enhanced DBS check.', '2.5 Provide monthly service reports.',
                        '2.6 The contract runs for 36 months with an option to extend by 12 months.'],
                ]),
            ], $owner, allowDuplicate: true);

            $intake->create([
                'title' => 'Security monitoring service (SOC) for three hospital sites',
                'reference' => 'HNT/DIG/2026/041',
                'buyer_name' => 'Hartfield NHS Foundation Trust',
                'buyer_type' => 'nhs',
                'buyer_location' => 'Hartfield, North West',
                'sector' => 'Cyber security',
                'deadline' => $at(40),
                'estimated_value' => 780_000,
                'summary' => '24/7 security operations centre covering three hospital sites, with incident response.',
            ], [
                self::demoPdf('ITT - Hartfield SOC.pdf', [
                    ['Hartfield NHS Foundation Trust - Invitation to Tender HNT/DIG/2026/041', 'Security operations centre (SOC) service',
                        'Suppliers must hold ISO/IEC 27001 certification and meet the NHS Data Security and Protection Toolkit standard.',
                        'Staff with access to Trust systems must hold Security Check (SC) clearance.'],
                ]),
                // Page 2 is blank, like a scanned form, so the "unreadable page" warning can be seen.
                self::demoPdf('Selection questionnaire.pdf', [
                    ['Selection questionnaire - Part 1: supplier information', 'Complete every question. Answers are scored pass or fail.'],
                    [],
                    ['Part 3: financial standing', 'Provide audited accounts for the last two financial years.'],
                ]),
            ], $owner, allowDuplicate: true);
        });
    }

    /**
     * A small PDF with one entry per page; an empty page has no text at all.
     *
     * @param  list<list<string>>  $pages
     */
    private static function demoPdf(string $name, array $pages): UploadedFile
    {
        $objects = [1 => '<< /Type /Catalog /Pages 2 0 R >>', 3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
        $kids = [];
        foreach (array_values($pages) as $i => $lines) {
            $page = 4 + $i * 2;
            $kids[] = "{$page} 0 R";
            $escaped = array_map(fn (string $l) => '('.str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $l).') Tj', $lines);
            $stream = $lines === [] ? '' : 'BT /F1 11 Tf 15 TL 72 730 Td '.implode(' T* ', $escaped).' ET';
            $objects[$page] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents '.($page + 1).' 0 R /Resources << /Font << /F1 3 0 R >> >> >>';
            $objects[$page + 1] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream";
        }
        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($kids).' >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $n => $body) {
            $offsets[] = strlen($pdf);
            $pdf .= "{$n} 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = count($objects) + 1;
        $pdf .= "xref\n0 {$size}\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $pdf .= sprintf("%010d 00000 n \n", $o);
        }
        $pdf .= "trailer << /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";

        $path = (string) tempnam(sys_get_temp_dir(), 'demo');
        file_put_contents($path, $pdf);

        return new UploadedFile($path, $name, 'application/pdf', null, true);
    }

    private function person(string $name): User
    {
        $email = Str::lower(Str::before($name, ' ')).'@bluewave.example';

        return User::firstOrCreate(['email' => $email], [
            'name' => $name,
            // Set DEMO_PASSWORD on any public server; "password" is for local use only.
            'password' => env('DEMO_PASSWORD', 'password'),
            'email_verified_at' => now(),
        ]);
    }

    /** A valid one-page PDF that says what it stands in for. */
    private static function placeholderPdf(string $title): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], "Demo placeholder: {$title}");
        $stream = "BT /F1 18 Tf 72 720 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $body) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $o) {
            $pdf .= sprintf("%010d 00000 n \n", $o);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }
}
