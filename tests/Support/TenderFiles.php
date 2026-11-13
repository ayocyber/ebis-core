<?php

namespace Tests\Support;

use Illuminate\Http\UploadedFile;
use ZipArchive;

/** Real (tiny) PDF, DOCX and ZIP files, so text extraction is tested for real. */
class TenderFiles
{
    /**
     * A PDF with one page per entry; an empty string makes a page with no text,
     * like a scanned page.
     *
     * @param  list<string>  $pages
     */
    public static function pdf(string $name, array $pages): UploadedFile
    {
        $objects = [];
        $count = count($pages);
        $kids = implode(' ', array_map(fn (int $i) => (4 + $i * 2).' 0 R', range(0, $count - 1)));
        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[2] = "<< /Type /Pages /Kids [{$kids}] /Count {$count} >>";
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        foreach (array_values($pages) as $i => $text) {
            $page = 4 + $i * 2;
            $content = $page + 1;
            $stream = $text === ''
                ? ''
                : 'BT /F1 11 Tf 72 720 Td ('.addcslashes($text, '()\\').') Tj ET';
            $objects[$page] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {$content} 0 R >>";
            $objects[$content] = '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream";
        }

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        ksort($objects);
        foreach ($objects as $n => $body) {
            $offsets[$n] = strlen($pdf);
            $pdf .= "{$n} 0 obj\n{$body}\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = count($objects) + 1;
        $pdf .= "xref\n0 {$size}\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer\n<< /Size {$size} /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return self::file($name, $pdf);
    }

    public static function docx(string $name, string $text): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'docx');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
        $paragraphs = implode('', array_map(
            fn (string $p) => '<w:p><w:r><w:t>'.htmlspecialchars($p, ENT_XML1).'</w:t></w:r></w:p>',
            explode("\n", $text),
        ));
        $zip->addFromString('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'.$paragraphs.'</w:body></w:document>');
        $zip->addFromString('docProps/app.xml', '<?xml version="1.0"?><Properties><Pages>3</Pages></Properties>');
        $zip->close();

        return new UploadedFile($path, $name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }

    /**
     * @param  array<string, string|UploadedFile>  $entries  name => contents or an existing file
     */
    public static function zip(string $name, array $entries): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'zip');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        foreach ($entries as $entry => $contents) {
            $zip->addFromString($entry, $contents instanceof UploadedFile ? (string) file_get_contents($contents->getRealPath()) : $contents);
        }
        $zip->close();

        return new UploadedFile($path, $name, 'application/zip', null, true);
    }

    private static function file(string $name, string $contents): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'pdf');
        file_put_contents($path, $contents);

        return new UploadedFile($path, $name, 'application/pdf', null, true);
    }
}
