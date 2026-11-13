<?php

namespace App\Enums;

/**
 * How reading a tender document's text went (ING-02, ERR-01). Mirrors
 * `ExtractionStatus` in resources/js/types/ebis.ts.
 */
enum ExtractionStatus: string
{
    case Pending = 'pending';
    /** Every page was read. */
    case Done = 'done';
    /** Some pages had no readable text (usually scans); they are listed. */
    case Partial = 'partial';
    case Failed = 'failed';
}
