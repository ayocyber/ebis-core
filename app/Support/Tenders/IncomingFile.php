<?php

namespace App\Support\Tenders;

/** A file ready to store: an upload, or one unpacked from an uploaded ZIP. */
final readonly class IncomingFile
{
    public function __construct(
        public string $localPath,
        public string $name,
        public string $extension,
        public int $size,
        public string $sha256,
        public ?string $fromArchive = null,
    ) {}
}
