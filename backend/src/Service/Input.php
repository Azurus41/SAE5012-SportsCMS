<?php

namespace App\Service;

use Symfony\Component\HttpKernel\Exception\HttpException;

// Lecture et validation des champs envoyés par le front (erreur 422 avec un message lisible).
final class Input
{
    public static function fail(string $message, int $status = 422): never
    {
        throw new HttpException($status, $message);
    }

    public static function string(array $in, string $key, int $max, string $label, bool $required = false): ?string
    {
        $v = $in[$key] ?? null;
        if (null === $v || '' === $v) {
            if ($required) {
                self::fail("Le champ « $label » est obligatoire.");
            }

            return null;
        }
        if (!\is_string($v) && !\is_int($v) && !\is_float($v)) {
            self::fail("Le champ « $label » doit être un texte.");
        }
        $v = (string) $v;
        if (mb_strlen($v) > $max) {
            self::fail("Le champ « $label » ne doit pas dépasser $max caractères.");
        }

        return $v;
    }

    public static function oneOf(array $in, string $key, array $allowed, string $label, ?string $default = null): ?string
    {
        $v = $in[$key] ?? $default;
        if (null === $v) {
            return null;
        }
        if (!\in_array($v, $allowed, true)) {
            self::fail("Valeur invalide pour « $label ».");
        }

        return $v;
    }

    public static function int(array $in, string $key, ?int $min = null, ?int $max = null): ?int
    {
        $v = $in[$key] ?? null;
        if (null === $v || '' === $v || !is_numeric($v)) {
            return null;
        }
        $v = (int) $v;
        if ((null !== $min && $v < $min) || (null !== $max && $v > $max)) {
            return null;
        }

        return $v;
    }

    public static function objectOrNull(mixed $v): ?array
    {
        return \is_array($v) && [] !== $v ? $v : null;
    }

    // Champs non reconnus, conservés tels quels dans la colonne JSON « options ».
    public static function extras(array $in, array $known): ?array
    {
        $rest = array_diff_key($in, array_flip($known));

        return [] === $rest ? null : $rest;
    }
}
