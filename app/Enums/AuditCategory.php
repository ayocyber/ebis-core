<?php

namespace App\Enums;

/** Activity log area. Mirrors `AuditCategory` in resources/js/hooks/use-audit.ts. */
enum AuditCategory: string
{
    case Requirements = 'requirements';
    case Assessment = 'assessment';
    case Override = 'override';
    case Gap = 'gap';
    case Decision = 'decision';
    case Bid = 'bid';
    case Documents = 'documents';
    case Signoff = 'signoff';
    case Vault = 'vault';
    case Profile = 'profile';
}
