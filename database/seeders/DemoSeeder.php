<?php

namespace Database\Seeders;

use App\Enums\AuditCategory;
use App\Enums\TenantRole;
use App\Enums\VaultCategory;
use App\Models\CompanyProfile;
use App\Models\Tenant;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\AuditLog;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Database\Seeder;
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

        $this->command->info('Demo ready. Sign in as emma@bluewave.example / password');
    }

    private function person(string $name): User
    {
        $email = Str::lower(Str::before($name, ' ')).'@bluewave.example';

        return User::firstOrCreate(['email' => $email], [
            'name' => $name,
            'password' => 'password',
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
