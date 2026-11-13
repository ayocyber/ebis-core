<?php

namespace App\Enums;

/** Evidence vault document type. Mirrors `VaultCategory` in resources/js/types/ebis.ts. */
enum VaultCategory: string
{
    case Company = 'company';
    case Certificate = 'certificate';
    case Insurance = 'insurance';
    case Financial = 'financial';
    case Experience = 'experience';
    case People = 'people';
    case Policy = 'policy';
    case Other = 'other';

    /** The kind of profile fact a document of this type proves. */
    public function factSource(): ProfileFactSource
    {
        return match ($this) {
            self::Certificate, self::Insurance => ProfileFactSource::Certificate,
            self::Financial => ProfileFactSource::FinancialStatement,
            self::Experience => ProfileFactSource::CaseStudy,
            self::People => ProfileFactSource::Cv,
            self::Policy => ProfileFactSource::Policy,
            self::Company, self::Other => ProfileFactSource::CompanyProfile,
        };
    }
}
