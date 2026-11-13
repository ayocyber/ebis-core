<?php

namespace App\Enums;

/** PRF-03: a fact with no source document, or not yet confirmed by a person, is unverified. */
enum VerificationStatus: string
{
    case Verified = 'verified';
    case Unverified = 'unverified';
    case Expired = 'expired';
}
