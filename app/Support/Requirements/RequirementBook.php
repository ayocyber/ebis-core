<?php

namespace App\Support\Requirements;

use App\Enums\AuditCategory;
use App\Enums\ExtractionStatus;
use App\Enums\RequirementCategory;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\User;
use App\Support\AuditLog;
use Illuminate\Support\Facades\DB;

/**
 * A tender's requirements (TUN-01/02/03): suggestions found in the text, ones the
 * user adds, edits (versioned) and removes. Every change to a confirmed requirement
 * goes to the activity log.
 */
class RequirementBook
{
    public function __construct(private RequirementFinder $finder) {}

    /**
     * Suggestions from one document's text. A sentence already suggested, confirmed
     * or dismissed for this tender is not suggested again.
     *
     * @return int How many were added
     */
    public function suggestFrom(TenderDocument $doc): int
    {
        if (! in_array($doc->extraction_status, [ExtractionStatus::Done, ExtractionStatus::Partial], true)) {
            return 0;
        }

        $text = TenderDocument::whereKey($doc->id)->value('extracted_text');
        if (! is_string($text) || $text === '') {
            return 0;
        }

        /** @var array<string, true> $seen */
        $seen = array_fill_keys(
            Requirement::withTrashed()->where('tender_id', $doc->tender_id)->whereNotNull('quote_hash')->pluck('quote_hash')->all(),
            true,
        );
        $added = 0;

        foreach ($this->finder->find($text) as $f) {
            $hash = Requirement::hashQuote($f->hashSource());
            if (isset($seen[$hash])) {
                continue;
            }
            $seen[$hash] = true;

            Requirement::create([
                'tender_id' => $doc->tender_id,
                'title' => $f->title,
                'text' => $f->text,
                'category' => $f->category,
                'topic' => $f->topic,
                'document_id' => $doc->id,
                'page' => $f->page,
                'section' => $f->section,
                'quote' => $f->quote,
                'check_rule' => $f->check,
                'weight' => $f->weight,
                'origin' => 'found',
                'quote_hash' => $hash,
            ]);
            $added++;
        }

        return $added;
    }

    /**
     * A requirement the user typed. It is confirmed straight away.
     *
     * @param  array<string, mixed>  $data
     */
    public function add(Tender $tender, array $data, User $by): Requirement
    {
        return DB::transaction(function () use ($tender, $data, $by) {
            $category = RequirementCategory::from($data['category']);
            $req = Requirement::create([
                ...$data,
                'tender_id' => $tender->id,
                'code' => $this->nextCode($tender, $category),
                'origin' => 'manual',
                'quote_hash' => isset($data['quote']) && $data['quote'] !== '' ? Requirement::hashQuote($data['quote']) : null,
                'confirmed_at' => now(),
                'confirmed_by' => $by->getKey(),
                'created_by' => $by->getKey(),
            ]);

            AuditLog::record(AuditCategory::Requirements, 'added a requirement to', $tender->label(), "{$req->code} · {$req->title}", $req, $by, $tender->id);

            return $req;
        });
    }

    /**
     * @param  list<Requirement>  $suggestions
     */
    public function confirm(Tender $tender, array $suggestions, User $by): int
    {
        return DB::transaction(function () use ($tender, $suggestions, $by) {
            $codes = [];
            foreach ($suggestions as $req) {
                if ($req->confirmed_at !== null) {
                    continue;
                }
                $req->forceFill([
                    'code' => $this->nextCode($tender, $req->category),
                    'confirmed_at' => now(),
                    'confirmed_by' => $by->getKey(),
                ])->save();
                $codes[] = $req->code;
            }

            if ($codes !== []) {
                AuditLog::record(
                    AuditCategory::Requirements,
                    count($codes) === 1 ? 'confirmed a requirement on' : 'confirmed '.count($codes).' requirements on',
                    $tender->label(),
                    implode(', ', $codes),
                    $tender,
                    $by,
                    $tender->id,
                );
            }

            return count($codes);
        });
    }

    /**
     * TUN-03: edits bump the version and record what changed.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Requirement $req, array $data, User $by): Requirement
    {
        return DB::transaction(function () use ($req, $data, $by) {
            $before = $req->only(array_keys($data));
            $req->fill($data);
            $changed = array_keys($req->getDirty());
            if ($changed === []) {
                return $req;
            }

            // A new category means a new code (M-02 becoming S-03).
            if (in_array('category', $changed, true) && $req->confirmed_at !== null) {
                $req->code = $this->nextCode($req->tender, $req->category);
            }
            $req->version++;
            $req->save();

            if ($req->confirmed_at !== null) {
                $detail = in_array('title', $changed, true)
                    ? "“{$before['title']}” → “{$req->title}”"
                    : 'Changed '.implode(', ', array_map(fn (string $c) => str_replace(['_rule', '_'], ['', ' '], $c), $changed));
                AuditLog::record(AuditCategory::Requirements, 'edited requirement', "{$req->code} · {$req->title}", $detail, $req, $by, $req->tender_id);
            }

            return $req;
        });
    }

    /** Dismissing a suggestion, or removing a confirmed requirement (logged). */
    public function remove(Requirement $req, User $by): void
    {
        DB::transaction(function () use ($req, $by) {
            $req->delete();
            if ($req->confirmed_at !== null) {
                AuditLog::record(AuditCategory::Requirements, 'removed requirement', "{$req->code} · {$req->title}", null, $req, $by, $req->tender_id);
            }
        });
    }

    /** M-01, M-02 … per category; numbers are never reused, even after a removal. */
    private function nextCode(Tender $tender, RequirementCategory $category): string
    {
        $prefix = $category->prefix();
        $used = Requirement::withTrashed()
            ->where('tender_id', $tender->id)
            ->where('code', 'like', "{$prefix}-%")
            ->pluck('code')
            ->map(fn (string $c) => (int) substr($c, 2))
            ->max() ?? 0;

        return sprintf('%s-%02d', $prefix, $used + 1);
    }
}
