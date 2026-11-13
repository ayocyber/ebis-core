<?php

namespace App\Enums;

/** Mirrors `AssessmentStatus` in resources/js/types/ebis.ts. */
enum AssessmentStatus: string
{
    case Met = 'met';
    case PartiallyMet = 'partially_met';
    case NotMet = 'not_met';
    case Unknown = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::Met => 'Met',
            self::PartiallyMet => 'Partially met',
            self::NotMet => 'Not met',
            self::Unknown => 'Unknown',
        };
    }
}
