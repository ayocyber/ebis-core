<?php

namespace App\Http\Controllers;

use App\Enums\AuditCategory;
use App\Models\BidSection;
use App\Models\ChecklistItem;
use App\Models\CompanyProfile;
use App\Models\Tender;
use App\Models\TenderDecision;
use App\Support\AuditLog;
use App\Support\Bid\BidWorkspace;
use App\Support\Bid\ChecklistBuilder;
use App\Support\Bid\SubmissionPack;
use App\Support\Docx;
use App\Support\Tenancy\CurrentTenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** M6: the documents checklist of a real tender (BID-02, BID-06). */
class ChecklistController extends Controller
{
    public function index(string $tender, ChecklistBuilder $builder, BidWorkspace $bid): Response|RedirectResponse
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);
        $decision = TenderDecision::where('tender_id', $tender->id)->latest('created_at')->latest('id')->first();
        if ($decision?->outcome !== 'proceed') {
            return to_route('tenders.decision', $tender->id)
                ->with('error', 'Decide to bid first. The documents checklist comes with the bid.');
        }

        $bid->ensure($tender);
        $builder->sync($tender);
        $profile = CompanyProfile::first();
        $items = ChecklistItem::where('tender_id', $tender->id)->orderBy('position')->get();

        return Inertia::render('tenders/live/documents', [
            'tender' => $tender->toFrontend(),
            'items' => $items->map(fn (ChecklistItem $i) => $i->toFrontend($profile))->values(),
            'progress' => $items->mapWithKeys(fn (ChecklistItem $i) => [$i->id => (object) ($i->progress ?? [])]),
            // Items with an uploaded file, for download links.
            'files' => $items->whereNotNull('file_path')->pluck('id')->values(),
            'sections' => BidSection::where('tender_id', $tender->id)->orderBy('position')->get()->map->toFrontend()->values(),
        ]);
    }

    /**
     * Save form answers, mark not needed, or clear progress (null). Clearing the
     * file name removes the uploaded file.
     */
    public function update(Request $request, string $tender, string $item): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $item = $this->item($tender, $item);
        $data = $request->validate([
            'progress' => ['present', 'nullable', 'array'],
            'progress.fields' => ['sometimes', 'array'],
            'progress.fields.*' => ['nullable', 'string', 'max:2000'],
            'progress.notApplicable' => ['sometimes', 'boolean'],
            'progress.fileName' => ['sometimes', 'nullable', 'string'],
            'progress.signedBy' => ['sometimes', 'nullable', 'string', 'max:120'],
            'progress.signedAt' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);
        $patch = $data['progress'];

        if ($patch === null) {
            $this->deleteFile($item);
            $item->forceFill(['progress' => null])->save();
            AuditLog::record(AuditCategory::Documents, 'reset', $item->title, null, $item, $request->user(), $item->tender_id);

            return back();
        }

        $progress = $item->progress ?? [];
        if (array_key_exists('fileName', $patch) && $patch['fileName'] === null) {
            $this->deleteFile($item);
            unset($progress['fileName'], $progress['sizeBytes'], $progress['uploadedAt'], $progress['uploadedBy']);
        }
        foreach (['fields', 'notApplicable', 'signedBy', 'signedAt'] as $key) {
            if (array_key_exists($key, $patch)) {
                $progress[$key] = $patch[$key];
            }
        }
        $item->forceFill(['progress' => $progress])->save();

        $action = match (true) {
            ($patch['notApplicable'] ?? false) === true => 'marked as not needed',
            isset($patch['fields']) => 'filled in',
            default => 'updated',
        };
        AuditLog::record(AuditCategory::Documents, $action, $item->title, null, $item, $request->user(), $item->tender_id);

        return back();
    }

    public function upload(Request $request, string $tender, string $item): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $item = $this->item($tender, $item);
        $request->validate(['file' => ['required', 'file', 'max:51200']], ['file.max' => 'The file can be up to 50 MB.']);

        $file = $request->file('file');
        $disk = (string) config('filesystems.vault_disk', 'local');
        $tenantId = app(CurrentTenant::class)->require()->getKey();
        $extension = strtolower($file->getClientOriginalExtension()) ?: 'bin';
        $path = $file->storeAs("tenants/{$tenantId}/bid-files", Str::uuid()->toString().'.'.$extension, $disk);
        abort_if($path === false, 500, 'The file could not be stored.');

        $this->deleteFile($item);
        $item->forceFill([
            'file_disk' => $disk,
            'file_path' => $path,
            'progress' => [
                ...($item->progress ?? []),
                'fileName' => $file->getClientOriginalName(),
                'sizeBytes' => $file->getSize(),
                'uploadedAt' => now()->toIso8601ZuluString(),
                'uploadedBy' => $request->user()?->name,
                'notApplicable' => false,
            ],
        ])->save();

        AuditLog::record(AuditCategory::Documents, 'uploaded', $item->title, $file->getClientOriginalName(), $item, $request->user(), $item->tender_id);

        return back()->with('success', "{$file->getClientOriginalName()} uploaded.");
    }

    public function download(string $tender, string $item): StreamedResponse
    {
        $item = $this->item($tender, $item);
        abort_if($item->file_path === null || ! Storage::disk((string) $item->file_disk)->exists($item->file_path), 404);

        return Storage::disk((string) $item->file_disk)->download($item->file_path, (string) ($item->progress['fileName'] ?? basename($item->file_path)));
    }

    /**
     * The form filled in with the answers on screen (saved or not), as a Word
     * document to sign. Nothing is saved.
     */
    public function form(Request $request, string $tender, string $item): BinaryFileResponse
    {
        $item = $this->item($tender, $item);
        abort_if($item->kind !== 'form', 404);
        $data = $request->validate([
            'fields' => ['sometimes', 'array'],
            'fields.*' => ['nullable', 'string', 'max:2000'],
        ]);

        $docx = new Docx;
        SubmissionPack::form($docx, $item, CompanyProfile::first(), $data['fields'] ?? ($item->progress['fields'] ?? []));
        $path = (string) tempnam(sys_get_temp_dir(), 'form');
        $docx->save($path);
        $tender = Tender::findOrFail($item->tender_id);
        $name = SubmissionPack::slug($tender->reference ?: $tender->title).'_'.SubmissionPack::slug(app(CurrentTenant::class)->require()->name)."_{$item->file_stem}.docx";

        return response()->download($path, $name, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])->deleteFileAfterSend();
    }

    private function item(string $tender, string $item): ChecklistItem
    {
        $tender = Tender::findOrFail($tender);

        return ChecklistItem::where('tender_id', $tender->id)->findOrFail($item);
    }

    private function deleteFile(ChecklistItem $item): void
    {
        if ($item->file_path !== null) {
            Storage::disk((string) $item->file_disk)->delete($item->file_path);
            $item->forceFill(['file_disk' => null, 'file_path' => null]);
        }
    }
}
