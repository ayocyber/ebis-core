<?php

namespace App\Enums;

/** Mirrors `Buyer['type']` in resources/js/types/ebis.ts. */
enum BuyerType: string
{
    case Central = 'central';
    case Local = 'local';
    case Nhs = 'nhs';
    case Education = 'education';
    case Devolved = 'devolved';
    case Private = 'private';
    case International = 'international';
}
