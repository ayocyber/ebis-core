<?php

namespace App\Http\Controllers;

use App\Models\AuditEvent;
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
        ]);
    }
}
