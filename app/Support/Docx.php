<?php

namespace App\Support;

use ZipArchive;

/**
 * Writes a plain Word document: headings and paragraphs, nothing else.
 * Enough for documents the app generates; no library needed.
 */
class Docx
{
    /** @var list<string> */
    private array $body = [];

    public function heading(string $text, int $level = 1): self
    {
        $size = [1 => 32, 2 => 26][$level] ?? 24;
        $this->body[] = '<w:p><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="'.$size.'"/></w:rPr>'
            .self::text($text).'</w:r></w:p>';

        return $this;
    }

    public function paragraph(string $text, bool $bold = false): self
    {
        $this->body[] = '<w:p><w:r>'.($bold ? '<w:rPr><w:b/></w:rPr>' : '').self::text($text).'</w:r></w:p>';

        return $this;
    }

    /** Several paragraphs, split on blank lines; single line breaks are kept. */
    public function paragraphs(string $text): self
    {
        foreach (preg_split('/\R\s*\R/', trim($text)) ?: [] as $block) {
            if (trim($block) === '') {
                continue;
            }
            $lines = preg_split('/\R/', trim($block)) ?: [];
            $runs = implode('<w:br/>', array_map(fn (string $l) => self::text(rtrim($l)), $lines));
            $this->body[] = '<w:p><w:r>'.$runs.'</w:r></w:p>';
        }

        return $this;
    }

    public function save(string $path): void
    {
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
            .implode('', $this->body).'</w:body></w:document>');
        $zip->close();
    }

    private static function text(string $s): string
    {
        return '<w:t xml:space="preserve">'.htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8').'</w:t>';
    }
}
