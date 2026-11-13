<?php

namespace App\Enums;

/** Mirrors `RequirementTopic` in resources/js/types/ebis.ts. */
enum RequirementTopic: string
{
    case Legal = 'legal';
    case Financial = 'financial';
    case Technical = 'technical';
    case Experience = 'experience';
    case Certification = 'certification';
    case Insurance = 'insurance';
    case Personnel = 'personnel';
    case SocialValue = 'social_value';
    case Submission = 'submission';
}
