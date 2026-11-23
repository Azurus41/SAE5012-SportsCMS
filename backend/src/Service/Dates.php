<?php

namespace App\Service;

// Dates échangées avec le front au format ISO 8601 en UTC (ex. 2026-10-06T08:00:00Z).
final class Dates
{
    public static function format(?\DateTimeInterface $d): ?string
    {
        return $d ? \DateTimeImmutable::createFromInterface($d)->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z') : null;
    }

    public static function parse(mixed $value): ?\DateTimeImmutable
    {
        if (!\is_string($value) || '' === $value) {
            return null;
        }
        try {
            return (new \DateTimeImmutable($value))->setTimezone(new \DateTimeZone(date_default_timezone_get()));
        } catch (\Exception) {
            return null;
        }
    }
}
