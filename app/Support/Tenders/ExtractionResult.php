<?php

namespace App\Support\Tenders;

use App\Enums\ExtractionStatus;

final readonly class ExtractionResult
{
    /**
     * @param  list<int>  $unreadablePages
     */
    public function __construct(
        public ExtractionStatus $status,
        public ?string $text = null,
        public ?int $pages = null,
        public array $unreadablePages = [],
        public ?string $error = null,
    ) {}

    public static function failed(string $error, ?int $pages = null): self
    {
        return new self(ExtractionStatus::Failed, pages: $pages, error: $error);
    }
}
