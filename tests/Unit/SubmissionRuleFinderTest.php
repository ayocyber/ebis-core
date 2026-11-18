<?php

use App\Support\Requirements\SubmissionRuleFinder;

function rulesFrom(string $text): array
{
    return collect((new SubmissionRuleFinder)->find([['name' => 'ITT.pdf', 'text' => $text]]))->keyBy('id')->all();
}

it('finds the rules a tender pack states', function () {
    $rules = rulesFrom(implode("\n\n", [
        '7. Submission instructions',
        'Tenders must be submitted via the ProContract e-tendering portal. Email submissions will not be accepted.',
        'All responses must be in PDF format, except the pricing schedule which must be returned as the original Excel file.',
        'Individual files must not exceed 25MB.',
        'Question 3 – Technical approach (maximum 15 pages).',
        'Q4. Social value: no more than 750 words.',
        'Use Arial 11pt font or larger on A4 pages.',
        'Each file name should follow the format Reference_Supplier_Document.',
    ]));

    expect(array_keys($rules))->toBe(['r-portal', 'r-format', 'r-size', 'r-pages', 'r-font', 'r-naming'])
        ->and($rules['r-portal']['value'])->toContain('ProContract')
        ->and($rules['r-portal']['source'])->toBe('ITT.pdf p.1')
        ->and($rules['r-size']['limit'])->toBe(25.0)
        ->and($rules['r-size']['value'])->toBe('Up to 25 MB per file')
        ->and($rules['r-font']['value'])->toBe('Arial 11pt minimum')
        ->and($rules['r-pages']['limits'])->toBe([
            ['about' => 'technical approach', 'unit' => 'pages', 'max' => 15],
            ['about' => 'social value', 'unit' => 'words', 'max' => 750],
        ]);
});

it('reads sizes in GB and limits written the other way round', function () {
    $rules = rulesFrom('The maximum file size is 1 GB. Case studies: 2 pages maximum. The whole response has a word limit of 3,000.');

    expect($rules['r-size']['limit'])->toBe(1024.0)
        ->and($rules['r-pages']['limits'])->toBe([
            ['about' => 'case studies', 'unit' => 'pages', 'max' => 2],
            ['about' => '', 'unit' => 'words', 'max' => 3000],
        ]);
});

it('invents nothing the pack does not say', function () {
    expect(rulesFrom('We are looking for a supplier to maintain our parks. The contract runs for 3 years.'))->toBe([]);
});
