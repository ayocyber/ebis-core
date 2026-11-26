<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
use App\Models\Tender;
use Inertia\Inertia;
use Inertia\Response;

/** EVD-05: the activity log, newest first. Read-only: there are no edit or delete routes. */
class ActivityController extends Controller
{
    /** Enough for a year of a busy SME; paging can follow when someone needs more. */
    public const LIMIT = 1000;

    public function index(): Response
    {
        return Inertia::render('activity/index', [
            'activity' => AuditEvent::latest('id')->limit(self::LIMIT)->get()->map->toFrontend(),
            // For the tender filter and the reference shown on each entry.
            'tenders' => Tender::orderBy('title')->get(['id', 'reference', 'buyer_name'])
                ->map(fn (Tender $t) => ['id' => $t->id, 'reference' => $t->reference ?: 'No reference', 'buyer' => $t->buyer_name]),
        ]);
    }
}
