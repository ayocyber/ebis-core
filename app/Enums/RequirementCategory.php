<?php

namespace App\Enums;

/** Mirrors `RequirementCategory` in resources/js/types/ebis.ts. */
enum RequirementCategory: string
{
    case Mandatory = 'mandatory';
    case Scored = 'scored';
    case Informational = 'informational';

    /** Code prefix: M-01, S-01, I-01. */
    public function prefix(): string
    {
        return match ($this) {
            self::Mandatory => 'M',
            self::Scored => 'S',
            self::Informational => 'I',
        };
    }
}
