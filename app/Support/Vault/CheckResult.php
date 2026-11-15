<?php

namespace App\Support\Vault;

final readonly class CheckResult
{
    /**
     * @param  list<array{level: string, text: string}>  $notes
     */
    public function __construct(public array $notes, public ?string $status = null) {}

    public static function unreadable(string $why): self
    {
        return new self([['level' => 'warn', 'text' => $why]], 'unreadable');
    }

    /** passed, warnings or unreadable. */
    public function status(): string
    {
        return $this->status ?? (collect($this->notes)->contains('level', 'warn') ? 'warnings' : 'passed');
    }

    public function warnings(): int
    {
        return collect($this->notes)->where('level', 'warn')->count();
    }
}
