<?php

namespace App\Http\Middleware;

use App\Models\Tender;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * SEC-01: a route with a {tender} is "not found" unless that tender belongs to
 * the current company, before any input is validated or anything is read.
 * Controllers still scope every query; this is the first line, not the only one.
 */
class EnsureTenderBelongsToCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $tender = $request->route('tender');

        // Sample tenders (tnd-001…) are not in the database; their pages show sample data.
        if (is_string($tender) && Str::isUuid($tender)) {
            abort_unless(Tender::whereKey($tender)->exists(), 404);
        }

        return $next($request);
    }
}
