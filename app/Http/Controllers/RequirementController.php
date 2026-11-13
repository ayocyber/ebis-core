<?php

namespace App\Http\Controllers;

use App\Http\Requests\Tenders\RequirementRequest;
use App\Models\Requirement;
use App\Models\Tender;
use App\Models\User;
use App\Support\Requirements\RequirementBook;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A real tender's requirements (TUN-01/02/03): suggestions found in its text, and
 * the confirmed list that the eligibility check uses.
 */
class RequirementController extends Controller
{
    public function index(string $tender): Response
    {
        $tender = Tender::with(['creator', 'documents' => fn ($q) => $q->withoutText()])->findOrFail($tender);
        $all = Requirement::with('document')->where('tender_id', $tender->id)->get();

        $confirmed = $all->whereNotNull('confirmed_at')
            ->sortBy(fn (Requirement $r) => [array_search($r->category->value, ['mandatory', 'scored', 'informational'], true), $r->code])
            ->values();
        $suggested = $all->whereNull('confirmed_at')
            ->sortBy(fn (Requirement $r) => [$r->document->name ?? '', $r->page ?? 0, $r->created_at])
            ->values();

        return Inertia::render('tenders/live/requirements', [
            'tender' => $tender->toFrontend(),
            'requirements' => $confirmed->map->toFrontend()->values(),
            'suggestions' => $suggested->map->toFrontend()->values(),
        ]);
    }

    public function store(RequirementRequest $request, string $tender, RequirementBook $book): RedirectResponse
    {
        $tender = Tender::findOrFail($tender);
        $data = $this->withValidDocument($tender, $request->toColumns());

        /** @var User $user */
        $user = $request->user();
        $req = $book->add($tender, $data, $user);

        return back()->with('success', "{$req->code} added.");
    }

    public function update(RequirementRequest $request, string $tender, string $requirement, RequirementBook $book): RedirectResponse
    {
        $tender = Tender::findOrFail($tender);
        $req = Requirement::where('tender_id', $tender->id)->findOrFail($requirement);
        $data = $this->withValidDocument($tender, $request->toColumns());

        /** @var User $user */
        $user = $request->user();
        $book->update($req, $data, $user);

        return back()->with('success', 'Requirement saved.');
    }

    /** Confirm one suggestion, or all of them when no id is given. */
    public function confirm(Request $request, string $tender, RequirementBook $book, ?string $requirement = null): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $query = Requirement::suggested()->where('tender_id', $tender->id);
        $list = $requirement !== null ? [$query->findOrFail($requirement)] : $query->orderBy('created_at')->get()->all();

        /** @var User $user */
        $user = $request->user();
        $n = $book->confirm($tender, $list, $user);

        return back()->with('success', $n === 1 ? 'Requirement confirmed.' : "{$n} requirements confirmed.");
    }

    public function destroy(Request $request, string $tender, string $requirement, RequirementBook $book): RedirectResponse
    {
        Gate::authorize('edit-tenant-data');
        $tender = Tender::findOrFail($tender);
        $req = Requirement::where('tender_id', $tender->id)->findOrFail($requirement);

        /** @var User $user */
        $user = $request->user();
        $book->remove($req, $user);

        return back()->with('success', $req->confirmed_at !== null ? "{$req->code} removed." : 'Suggestion dismissed.');
    }

    /**
     * The source document must belong to this tender.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withValidDocument(Tender $tender, array $data): array
    {
        if (! empty($data['document_id']) && ! $tender->documents()->whereKey($data['document_id'])->exists()) {
            throw ValidationException::withMessages(['document_id' => 'Choose one of this tender’s documents.']);
        }

        return $data;
    }
}
