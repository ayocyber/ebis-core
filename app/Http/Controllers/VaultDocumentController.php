<?php

namespace App\Http\Controllers;

use App\Http\Requests\Vault\StoreVaultDocumentRequest;
use App\Models\User;
use App\Models\VaultDocument;
use App\Support\Vault\VaultUploader;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Evidence vault (PRF-02, PRF-03). The document list itself is a shared Inertia
 * prop (`vault`) because tender pages check it too.
 */
class VaultDocumentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('vault/index');
    }

    public function store(StoreVaultDocumentRequest $request, VaultUploader $uploader): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();
        $doc = $uploader->store($request->file('file'), $request->safe()->except('file'), $user);

        return back()->with('success', "{$doc->title} saved to the vault.");
    }

    // Ids, not route-model binding: binding runs before the `tenant` middleware sets
    // the company, so the lookup must happen here, inside the tenant scope (404 otherwise).

    public function download(string $document): StreamedResponse
    {
        $document = VaultDocument::findOrFail($document);
        abort_unless(Storage::disk($document->disk)->exists($document->path), 404, 'The file is missing from storage.');

        return Storage::disk($document->disk)->download($document->path, $document->file_name);
    }

    public function destroy(Request $request, string $document, VaultUploader $uploader): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $document = VaultDocument::findOrFail($document);
        /** @var User $user */
        $user = $request->user();
        $uploader->delete($document, $user);

        return back()->with('success', "{$document->title} deleted.");
    }
}
