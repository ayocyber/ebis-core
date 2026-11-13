<?php

namespace App\Enums;

/** Mirrors `GapSeverity` in resources/js/types/ebis.ts (GAP-02). */
enum GapSeverity: string
{
    /** Mandatory, and can't realistically be closed before the deadline. */
    case Blocker = 'blocker';
    case Fixable = 'fixable';
    case Minor = 'minor';
}
