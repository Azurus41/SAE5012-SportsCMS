<?php

namespace App\Service;

// Identifiants publics lisibles, au même format que ceux du front (ex. a-k3j2h1x9, u-admin).
final class Ids
{
    public static function make(string $prefix): string
    {
        return $prefix.'-'.substr(base_convert(bin2hex(random_bytes(7)), 16, 36), 0, 10);
    }

    public static function isValid(mixed $id): bool
    {
        return \is_string($id) && 1 === preg_match('/^[A-Za-z0-9_-]{1,40}$/', $id);
    }

    // Même règle que slugify() de frontend/src/api/mockApi.js.
    public static function slugify(string $text): string
    {
        if (class_exists(\Normalizer::class)) {
            $text = preg_replace('/\p{Mn}+/u', '', \Normalizer::normalize($text, \Normalizer::FORM_D) ?: $text) ?? $text;
        } else {
            $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
        }
        $text = mb_strtolower($text);
        $text = preg_replace("/[’']/u", '-', $text) ?? $text;
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? $text;

        return substr(trim($text, '-'), 0, 80);
    }
}
