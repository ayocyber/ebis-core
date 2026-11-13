<?php

namespace App\Enums;

/** Where a profile fact comes from. Mirrors `ProfileFactSource` in resources/js/types/ebis.ts. */
enum ProfileFactSource: string
{
    case CompanyProfile = 'company_profile';
    case Certificate = 'certificate';
    case FinancialStatement = 'financial_statement';
    case CaseStudy = 'case_study';
    case Cv = 'cv';
    case Policy = 'policy';
}
