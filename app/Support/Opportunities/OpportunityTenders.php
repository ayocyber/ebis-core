<?php

namespace App\Support\Opportunities;

use App\Models\Opportunity;
use App\Models\Tender;
use App\Models\User;
use App\Support\Tenders\DuplicateTender;
use App\Support\Tenders\TenderIntake;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;
use ZipArchive;

/**
 * "Bid for this": turns a published opportunity into the company's own tender.
 * The notice becomes a Word document (so its requirements are found like any
 * other document's) and the attachments that can be downloaded are added too.
 * Everything then goes through the normal intake.
 */
class OpportunityTenders
{
    private const MAX_BYTES = 25 * 1024 * 1024;

    private const MAX_ATTACHMENTS = 10;

    /** @var list<string> */
    private array $temp = [];

    /** Attachments that couldn't be fetched (behind a login, too big…), for the message. */
    public int $notFetched = 0;

    public function __construct(private TenderIntake $intake) {}

    public function start(Opportunity $o, User $by): Tender
    {
        try {
            $files = [$this->notice($o), ...$this->attachments($o)];

            try {
                return $this->intake->create($this->details($o), $files, $by);
            } catch (DuplicateTender $e) {
                // Already picked (same reference): open that one rather than make a copy.
                return $e->existing;
            }
        } finally {
            foreach ($this->temp as $path) {
                @unlink($path);
            }
        }
    }

    /** The tender this company already made from the opportunity, if any. */
    public static function existing(Opportunity $o): ?Tender
    {
        return Tender::where('source_url', $o->url)->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function details(Opportunity $o): array
    {
        return [
            'title' => Str::limit($o->title, 250),
            'reference' => Str::limit($o->notice_id, 100, ''),
            'summary' => $o->description ? Str::limit($o->description, 1990) : null,
            'buyer_name' => Str::limit($o->buyer_name, 250),
            'buyer_type' => $o->buyer_type->value,
            'buyer_location' => $o->regions ? Str::limit(implode(', ', $o->regions), 250) : null,
            'sector' => $o->cpv_label,
            'published_at' => $o->published_at,
            'deadline' => $o->deadline,
            'estimated_value' => $o->value,
            'currency' => $o->currency,
            'source_url' => $o->url,
            'portal_url' => $o->submission_url,
        ];
    }

    /**
     * The notice as a Word document, laid out so the requirement finder reads it:
     * numbered selection criteria under a "Selection criteria" heading, and the
     * award criteria as scored items with their weights.
     */
    private function notice(Opportunity $o): UploadedFile
    {
        $lines = [
            $o->title,
            "Published on {$o->sourceName()}: {$o->url}",
            "Buyer: {$o->buyer_name}. Reference: {$o->notice_id}. Deadline for tenders: ".$o->deadline->timezone('Europe/London')->format('j F Y, H:i').'.',
        ];
        if ($o->value) {
            $lines[] = 'Estimated value: £'.number_format($o->value).'.';
        }
        if ($o->submission_url) {
            $lines[] = "Full documents and submission: {$o->submission_url}";
        }

        $lines[] = '1. Description';
        foreach (preg_split('/\n+/', (string) $o->description) ?: [] as $p) {
            if (trim($p) !== '') {
                $lines[] = trim($p);
            }
        }

        $selection = array_values(array_filter($o->selection ?? [], fn (string $s) => ! ReleaseMapper::onlyPointsElsewhere($s)));
        if ($selection !== []) {
            $lines[] = '2. Selection criteria';
            foreach ($selection as $i => $text) {
                $lines[] = '2.'.($i + 1).' '.self::readableMoney((string) preg_replace('/\s+/', ' ', $text));
            }
        }

        if ($o->award_criteria) {
            $lines[] = '3. Award criteria';
            foreach ($o->award_criteria as $i => $c) {
                $lines[] = '3.'.($i + 1).' '.$c['name'].': scored'.($c['weight'] !== null ? ", worth {$c['weight']}% of the marks." : '.');
            }
        }

        $path = $this->tempFile();
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
        $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
        $paragraphs = implode('', array_map(
            fn (string $p) => '<w:p><w:r><w:t xml:space="preserve">'.htmlspecialchars($p, ENT_XML1 | ENT_QUOTES, 'UTF-8').'</w:t></w:r></w:p>',
            $lines,
        ));
        $zip->addFromString('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'.$paragraphs.'</w:body></w:document>');
        $zip->close();

        return new UploadedFile($path, "Tender notice - {$o->sourceName()}.docx", 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', null, true);
    }

    /**
     * Attachments published with the notice that can be downloaded without a login.
     *
     * @return list<UploadedFile>
     */
    private function attachments(Opportunity $o): array
    {
        $files = [];
        foreach (array_slice($o->documents ?? [], 0, self::MAX_ATTACHMENTS) as $doc) {
            $file = $this->download($doc['url'], $doc['title']);
            if ($file !== null) {
                $files[] = $file;
            } else {
                $this->notFetched++;
            }
        }

        return $files;
    }

    private function download(string $url, string $title): ?UploadedFile
    {
        // Only the government sites themselves: buyer portals need a login.
        if (! preg_match('#^https://www\.(contractsfinder|find-tender)\.service\.gov\.uk/#i', $url)) {
            return null;
        }

        try {
            $path = $this->tempFile();
            $res = Http::timeout(30)->withOptions(['sink' => $path])->withUserAgent('ProcurPilot tender search')->get($url);
            if (! $res->successful() || filesize($path) === 0 || filesize($path) > self::MAX_BYTES) {
                return null;
            }

            $name = self::fileName((string) $res->header('Content-Disposition')) ?? Str::slug(Str::limit($title, 60, ''), ' ');
            $type = strtolower((string) $res->header('Content-Type'));
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION)) ?: match (true) {
                str_contains($type, 'pdf') => 'pdf',
                str_contains($type, 'wordprocessingml') => 'docx',
                str_contains($type, 'zip') => 'zip',
                default => '',
            };
            if (! in_array($ext, ['pdf', 'docx', 'zip'], true)) {
                return null;
            }
            $name = pathinfo($name, PATHINFO_FILENAME).'.'.$ext;

            return new UploadedFile($path, $name, null, null, true);
        } catch (Throwable) {
            return null;
        }
    }

    private static function fileName(string $disposition): ?string
    {
        if (preg_match("/filename\\*=UTF-8''([^;]+)/i", $disposition, $m)) {
            return basename(rawurldecode(trim($m[1], '"')));
        }

        return preg_match('/filename="?([^";]+)"?/i', $disposition, $m) ? basename(trim($m[1])) : null;
    }

    /** "10 Million GBP" → "£10 million", so amounts are understood. */
    private static function readableMoney(string $s): string
    {
        return (string) preg_replace_callback(
            '/(?<![£\w])(\d[\d,]*(?:\.\d+)?)\s*(million|m)?\s*(?:GBP|pounds(?: sterling)?)\b/i',
            fn (array $m) => '£'.$m[1].(! empty($m[2]) ? ' million' : ''),
            $s,
        );
    }

    private function tempFile(): string
    {
        return $this->temp[] = (string) tempnam(sys_get_temp_dir(), 'opp');
    }
}
