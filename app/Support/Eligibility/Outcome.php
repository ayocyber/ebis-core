<?php

namespace App\Support\Eligibility;

use App\Enums\AssessmentStatus;

/** The result of checking one requirement, before it is stored. */
final readonly class Outcome
{
    /**
     * @param  list<array<string, mixed>>  $facts  ProfileFact shapes for the evidence drawer
     * @param  array{factLabel: string, expiresAt: string}|null  $stale  EVD-02
     * @param  array{remedy: string, days: int, evidence?: array{scope: string, title: string, category: string}}|null  $fix  How to close the gap
     */
    public function __construct(
        public AssessmentStatus $status,
        public string $summary,
        public string $reasoning,
        public string $method = 'rule',
        public array $facts = [],
        public ?array $stale = null,
        public ?array $fix = null,
    ) {}
}
