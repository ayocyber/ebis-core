<?php

namespace App\Support\Tenders;

use App\Models\Tender;
use RuntimeException;

/** ING-05: the upload matches a tender the company already has. */
class DuplicateTender extends RuntimeException
{
    public function __construct(public readonly Tender $existing, public readonly string $reason)
    {
        parent::__construct($reason);
    }
}
