<?php

namespace App\Support\Bid;

use App\Models\ChecklistItem;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\TenderDocument;
use Illuminate\Support\Str;

/**
 * Works out what the buyer wants submitted (BID-02), without AI:
 *
 * - the written response, from the bid editor;
 * - vault documents that requirements ask for (certificates, insurance, accounts);
 * - a selection questionnaire in the pack becomes a form pre-filled from the
 *   company profile (BID-06);
 * - pricing schedules and forms in the pack become files to upload for this bid.
 *
 * Safe to run again: it only adds what is new, and never brings back an item the
 * user removed.
 */
class ChecklistBuilder
{
    /** UK standard selection questionnaire, Part 1: supplier information. */
    private const SQ_FIELDS = [
        ['id' => 'legal_name', 'label' => 'Full name of the supplier', 'profile' => 'legal_name'],
        ['id' => 'trading_name', 'label' => 'Trading name', 'profile' => 'trading_name'],
        ['id' => 'registered_office', 'label' => 'Registered address', 'profile' => 'registered_office'],
        ['id' => 'company_number', 'label' => 'Companies House number', 'profile' => 'company_number'],
        ['id' => 'incorporated', 'label' => 'Date of registration', 'profile' => 'incorporated_at'],
        ['id' => 'vat_number', 'label' => 'VAT number', 'profile' => 'vat_number'],
        ['id' => 'cdp_id', 'label' => 'Central Digital Platform unique ID', 'profile' => 'cdp_id', 'hint' => 'Required under the Procurement Act 2023.'],
        ['id' => 'website', 'label' => 'Website', 'profile' => 'website'],
        ['id' => 'employees', 'label' => 'Number of employees', 'profile' => 'employees'],
        ['id' => 'contact_name', 'label' => 'Contact name for this bid'],
        ['id' => 'contact_email', 'label' => 'Contact email'],
        ['id' => 'contact_phone', 'label' => 'Contact phone'],
    ];

    public function sync(Tender $tender): void
    {
        /** @var array<string, true> $known */
        $known = array_fill_keys(ChecklistItem::withTrashed()->where('tender_id', $tender->id)->whereNotNull('key')->pluck('key')->all(), true);
        $position = (int) ChecklistItem::withTrashed()->where('tender_id', $tender->id)->max('position');

        $add = function (string $key, array $attributes) use ($tender, &$known, &$position) {
            if (isset($known[$key])) {
                return;
            }
            $known[$key] = true;
            ChecklistItem::create([...$attributes, 'tender_id' => $tender->id, 'key' => $key, 'position' => ++$position]);
        };

        $add('response', [
            'kind' => 'response',
            'title' => 'Written response',
            'why' => 'Your answers to the buyer’s questions, written in the bid editor.',
            'source' => 'Bid editor',
            'formats' => ['pdf', 'docx'],
            'file_stem' => 'Response',
        ]);

        foreach ($tender->documents()->withoutText()->get() as $doc) {
            $this->fromDocument($doc, $add);
        }

        $requirements = Requirement::confirmed()->with('document')->where('tender_id', $tender->id)->get();
        foreach ($requirements as $req) {
            $this->fromRequirement($req, $add);
        }
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $add
     */
    private function fromDocument(TenderDocument $doc, callable $add): void
    {
        $name = pathinfo($doc->name, PATHINFO_FILENAME);

        match ($doc->role) {
            'Selection questionnaire' => $add("doc:{$doc->id}", [
                'kind' => 'form',
                'title' => 'Selection questionnaire: supplier information',
                'why' => 'The buyer’s standard questions about your company. ProcurPilot fills in what your company profile already holds.',
                'source' => $doc->name,
                'formats' => ['pdf', 'docx'],
                'file_stem' => 'SelectionQuestionnaire',
                'signature' => true,
                'fields' => self::SQ_FIELDS,
            ]),
            'Pricing schedule' => $add("doc:{$doc->id}", [
                'kind' => 'bid',
                'title' => 'Completed pricing schedule',
                'why' => 'Your prices, in the buyer’s own pricing template.',
                'source' => $doc->name,
                'formats' => ['xlsx', 'pdf'],
                'file_stem' => 'PricingSchedule',
            ]),
            'Form or appendix' => $add("doc:{$doc->id}", [
                'kind' => 'bid',
                'title' => "Completed {$name}",
                'why' => 'A form or appendix from the tender pack, filled in and returned.',
                'source' => $doc->name,
                'formats' => ['pdf', 'docx'],
                'file_stem' => Str::studly(Str::limit($name, 40, '')),
                'signature' => (bool) preg_match('/declaration|form of tender|undertaking/i', $name),
            ]),
            default => null,
        };
    }

    /**
     * Vault documents that prove a hard criterion are attached from the vault.
     *
     * @param  callable(string, array<string, mixed>): void  $add
     */
    private function fromRequirement(Requirement $req, callable $add): void
    {
        $rule = $req->check_rule ?? [];
        $source = trim(implode(' · ', array_filter([$req->document->name ?? null, $req->page ? "p.{$req->page}" : null, $req->section ? "§{$req->section}" : null, $req->code])));

        [$title, $match] = match ($rule['type'] ?? null) {
            'certification' => ["{$rule['name']} certificate", self::pattern((string) $rule['name'])],
            'insurance_min' => [
                ['public' => 'Public liability', 'employers' => 'Employer’s liability', 'professional' => 'Professional indemnity'][$rule['kind']].' insurance certificate',
                ['public' => 'public', 'employers' => 'employer', 'professional' => 'professional|indemnity'][$rule['kind']],
            ],
            'turnover_min' => ['Audited accounts', 'accounts|financial statement'],
            default => [null, null],
        };
        if ($title === null) {
            return;
        }

        // Several requirements can ask for the same document; it is listed once.
        $add('vault:'.Str::slug($title), [
            'kind' => 'company',
            'title' => $title,
            'why' => $req->title,
            'source' => $source !== '' ? $source : 'Requirements',
            'formats' => ['pdf'],
            'file_stem' => Str::studly(Str::limit($title, 40, '')),
            'vault_match' => $match,
        ]);
    }

    /** "ISO/IEC 27001" → a pattern that also matches "ISO 27001" and "ISO27001:2022". */
    private static function pattern(string $name): string
    {
        $words = preg_split('/[^A-Za-z0-9]+/', str_ireplace('/IEC', '', $name), -1, PREG_SPLIT_NO_EMPTY) ?: [$name];
        $pattern = implode('\W*', array_map(fn (string $w) => preg_quote($w, '/'), $words));

        // ISO standards are often written "ISO/IEC 27001". The pattern is used by the browser too (JavaScript RegExp).
        return (string) preg_replace('/^ISO\\\\W\*/i', 'ISO\W*(?:IEC\W*)?', $pattern);
    }
}
