<?php

namespace App\Support\Requirements;

use App\Enums\RequirementCategory;
use App\Enums\RequirementTopic;

final readonly class FoundRequirement
{
    /**
     * @param  string  $quote  The tender's exact words (the evidence)
     * @param  array<string, mixed>|null  $check
     * @param  string|null  $key  Tells apart requirements split from one sentence
     */
    public function __construct(
        public string $title,
        public string $text,
        public RequirementCategory $category,
        public RequirementTopic $topic,
        public int $page,
        public ?string $section,
        public string $quote,
        public ?array $check,
        public ?string $key = null,
        /** Percentage weight of a scored requirement, when the text gives one */
        public ?int $weight = null,
    ) {}

    public function hashSource(): string
    {
        return $this->key ?? $this->quote;
    }
}
