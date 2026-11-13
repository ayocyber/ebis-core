<?php

namespace App\Support\Tenders;

use App\Enums\ExtractionStatus;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;
use Throwable;
use ZipArchive;

/**
 * Reads the text out of a tender document (ING-02).
 *
 * PDFs are read page by page; a page with almost no text is almost always a scan,
 * so it is reported as unreadable rather than silently skipped (TUN-06, ERR-01).
 * Text recognition for scans (OCR) is not available yet.
 */
class TextExtractor
{
    /** Fewer characters than this on a page means there is no real text layer. */
    private const MIN_PAGE_CHARS = 25;

    /** Larger PDFs can exhaust memory on the current (free) server. */
    public const MAX_READ_BYTES = 30 * 1024 * 1024;

    public function extract(string $localPath, string $kind): ExtractionResult
    {
        if (filesize($localPath) > self::MAX_READ_BYTES) {
            return ExtractionResult::failed(
                'This file is too large to read on the current server. Split it into smaller files and upload them.',
            );
        }

        try {
            return match ($kind) {
                'pdf' => $this->pdf($localPath),
                'docx' => $this->docx($localPath),
                default => ExtractionResult::failed('Only PDF and Word (DOCX) files can be read.'),
            };
        } catch (Throwable $e) {
            report($e);

            return ExtractionResult::failed(
                'The file could not be read. It may be damaged or password-protected.',
            );
        }
    }

    private function pdf(string $path): ExtractionResult
    {
        $config = new Config;
        $config->setRetainImageContent(false);
        $config->setDecodeMemoryLimit(64 * 1024 * 1024);

        $pages = (new Parser([], $config))->parseFile($path)->getPages();
        if ($pages === []) {
            return ExtractionResult::failed('The PDF has no pages.');
        }

        $texts = [];
        $unreadable = [];
        foreach (array_values($pages) as $i => $page) {
            $text = self::tidy($page->getText());
            $texts[] = $text;
            if (mb_strlen(preg_replace('/\s+/', '', $text) ?? '') < self::MIN_PAGE_CHARS) {
                $unreadable[] = $i + 1;
            }
        }

        $count = count($texts);
        if (count($unreadable) === $count) {
            return ExtractionResult::failed(
                'No text could be read. This looks like a scanned document; reading scans is not available yet.',
                pages: $count,
            );
        }

        return new ExtractionResult(
            status: $unreadable === [] ? ExtractionStatus::Done : ExtractionStatus::Partial,
            text: implode("\f", $texts),
            pages: $count,
            unreadablePages: $unreadable,
        );
    }

    private function docx(string $path): ExtractionResult
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            return ExtractionResult::failed('The Word file could not be opened. It may be damaged.');
        }

        try {
            $xml = $zip->getFromName('word/document.xml');
            $props = $zip->getFromName('docProps/app.xml');
        } finally {
            $zip->close();
        }

        if ($xml === false) {
            return ExtractionResult::failed('This does not look like a Word document.');
        }

        // Paragraphs, line breaks and tabs become whitespace before the tags go.
        $xml = str_replace(['</w:p>', '<w:br/>', '<w:cr/>', '<w:tab/>'], ["\n", "\n", "\n", "\t"], $xml);
        $text = self::tidy(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));

        if (mb_strlen(preg_replace('/\s+/', '', $text) ?? '') < self::MIN_PAGE_CHARS) {
            return ExtractionResult::failed('The Word document has no readable text.');
        }

        // Word records its own page count; useful for display, not for citations.
        $pages = $props !== false && preg_match('/<Pages>(\d+)<\/Pages>/', $props, $m) ? (int) $m[1] : null;

        return new ExtractionResult(ExtractionStatus::Done, $text, $pages);
    }

    private static function tidy(string $text): string
    {
        $text = str_replace(["\r\n", "\r", "\f"], "\n", $text);
        $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text) ?? $text;
        $text = preg_replace("/ *\n */", "\n", $text) ?? $text;
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        return trim($text);
    }
}
