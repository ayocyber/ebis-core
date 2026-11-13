<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Enums\ExtractionStatus;
use App\Enums\TenderStage;
use App\Http\Requests\Tenders\StoreTenderRequest;
use App\Models\Tender;
use App\Models\TenderDocument;
use App\Models\User;
use App\Support\AuditLog;
use App\Support\Tenders\DuplicateTender;
use App\Support\Tenders\TenderIntake;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Stage 1, Ingest (ING-*). Ids, not route-model binding: binding runs before the
 * `tenant` middleware sets the company, so lookups happen here, inside the tenant scope.
 */
class TenderController extends Controller
{
    public function index(): Response
    {
        $tenders = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])
            ->orderBy('deadline')
            ->get();

        return Inertia::render('tenders/index', [
            'tenders' => $tenders->map->toFrontend()->values(),
        ]);
    }

    public function store(StoreTenderRequest $request, TenderIntake $intake): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        try {
            $tender = $intake->create(
                $request->safe()->except(['files', 'allow_duplicate']),
                $request->file('files'),
                $user,
                $request->boolean('allow_duplicate'),
            );
        } catch (DuplicateTender $e) {
            // The form asks the user to open the existing tender or upload anyway.
            return back()
                ->withInput($request->except('files'))
                ->with('duplicate', [
                    'message' => $e->reason,
                    'tender' => ['id' => $e->existing->id, 'title' => $e->existing->title, 'reference' => $e->existing->reference],
                ]);
        }

        return to_route('tenders.show', $tender->id)
            ->with('success', self::uploadMessage("{$tender->title} uploaded.", $intake->skipped));
    }

    public function show(string $tender): Response
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);

        return Inertia::render('tenders/show', [
            'tender' => $tender->toFrontend(),
        ]);
    }

    public function update(Request $request, string $tender): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $data = $request->validate(StoreTenderRequest::detailRules(), StoreTenderRequest::detailMessages());

        $tender->fill($data);
        $changed = array_keys($tender->getDirty());
        if ($changed === []) {
            return back();
        }

        DB::transaction(function () use ($tender, $changed, $request) {
            $tender->save();
            AuditLog::record(
                AuditCategory::Tender,
                'edited the details of',
                $tender->label(),
                detail: 'Changed '.implode(', ', array_map(fn (string $c) => str_replace('_', ' ', $c), $changed)),
                subject: $tender,
                actor: $request->user(),
                tenderId: $tender->id,
            );
        });

        return back()->with('success', 'Tender details saved.');
    }

    public function destroy(Request $request, string $tender): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);

        DB::transaction(function () use ($tender, $request) {
            $tender->delete();
            AuditLog::record(AuditCategory::Tender, 'deleted the tender', $tender->label(), subject: $tender, actor: $request->user(), tenderId: $tender->id);
        });

        return to_route('tenders.index')->with('success', "{$tender->title} deleted.");
    }

    public function addDocuments(Request $request, string $tender, TenderIntake $intake): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $request->validate(
            [
                'files' => ['required', 'array', 'min:1', 'max:'.StoreTenderRequest::MAX_FILES],
                'files.*' => ['required', 'file', 'max:'.TenderDocument::MAX_KB, 'extensions:'.implode(',', TenderDocument::EXTENSIONS)],
            ],
            (new StoreTenderRequest)->messages(),
        );

        /** @var User $user */
        $user = $request->user();
        $added = $intake->addDocuments($tender, $request->file('files'), $user);

        $message = match ($added) {
            0 => 'No new documents were added.',
            1 => '1 document added.',
            default => "{$added} documents added.",
        };

        return back()->with($added > 0 ? 'success' : 'error', self::uploadMessage($message, $intake->skipped));
    }

    public function download(string $tender, string $document): StreamedResponse
    {
        $doc = TenderDocument::withoutText()->where('tender_id', $tender)->whereHas('tender')->findOrFail($document);
        abort_unless(Storage::disk($doc->disk)->exists($doc->path), 404, 'The file is missing from storage.');

        return Storage::disk($doc->disk)->download($doc->path, $doc->name);
    }

    public function destroyDocument(Request $request, string $tender, string $document): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $doc = $tender->documents()->withoutText()->findOrFail($document);

        if ($tender->documents()->count() === 1) {
            return back()->with('error', 'A tender needs at least one document. Delete the tender instead.');
        }

        DB::transaction(function () use ($tender, $doc, $request) {
            $doc->delete();
            $tender->forceFill(['version' => $tender->version + 1])->save();
            AuditLog::record(
                AuditCategory::Tender,
                'removed a document from',
                $tender->label(),
                detail: $doc->name,
                subject: $tender,
                actor: $request->user(),
                tenderId: $tender->id,
            );
        });
        $tender->refreshStage();

        return back()->with('success', "{$doc->name} removed.");
    }

    /** ERR-01: a failed read can be tried again. */
    public function retryExtraction(string $tender, string $document, TenderIntake $intake): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $doc = $tender->documents()->withoutText()->findOrFail($document);

        $doc->forceFill([
            'extraction_status' => ExtractionStatus::Pending,
            'extraction_error' => null,
            'unreadable_pages' => null,
        ])->save();
        if ($tender->stage === TenderStage::Requirements) {
            $tender->forceFill(['stage' => TenderStage::Extraction])->save();
        }
        $intake->queueExtraction($tender);

        $doc->refresh();

        return back()->with(
            $doc->extraction_status === ExtractionStatus::Failed ? 'error' : 'success',
            $doc->extraction_status === ExtractionStatus::Failed ? "{$doc->name} still could not be read." : "{$doc->name} read again.",
        );
    }

    /**
     * @param  list<string>  $skipped
     */
    private static function uploadMessage(string $message, array $skipped): string
    {
        if ($skipped === []) {
            return $message;
        }

        return $message.' Skipped: '.implode('; ', array_slice($skipped, 0, 5)).(count($skipped) > 5 ? '; and '.(count($skipped) - 5).' more.' : '.');
    }
}
