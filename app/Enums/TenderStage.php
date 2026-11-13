<?php

namespace App\Enums;

/** The ten workflow stages. Mirrors `TenderStage` in resources/js/types/ebis.ts. */
enum TenderStage: string
{
    case Intake = 'intake';
    case Extraction = 'extraction';
    case Requirements = 'requirements';
    case Eligibility = 'eligibility';
    case Gaps = 'gaps';
    case Decision = 'decision';
    case Compliance = 'compliance';
    case Drafting = 'drafting';
    case Validation = 'validation';
    case Submitted = 'submitted';
}
