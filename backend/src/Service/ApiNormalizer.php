<?php

namespace App\Service;

use App\Entity\Article;
use App\Entity\Block;
use App\Entity\Comment;
use App\Entity\Dataset;
use App\Entity\Media;
use App\Entity\Rating;
use App\Entity\Theme;
use App\Entity\User;

// Conversion des entités en JSON, au format de frontend/src/api/mockApi.js (contrat docs/api.md).
class ApiNormalizer
{
    // Ce que l'API renvoie sur un utilisateur : jamais l'empreinte du mot de passe, ni l'e-mail en public.
    public function publicUser(User $u): array
    {
        return ['id' => $u->getId(), 'name' => $u->getName(), 'role' => $u->getRole(), 'banned' => $u->isBanned()];
    }

    public function sessionUser(User $u): array
    {
        return $this->publicUser($u) + ['email' => $u->getEmail()];
    }

    public function article(Article $a): array
    {
        return [
            'id' => $a->id,
            'slug' => $a->slug,
            'title' => $a->title,
            'summary' => $a->summary,
            'type' => $a->type,
            'status' => $a->status,
            'previousStatus' => $a->previousStatus,
            'sport' => $a->sport->getCode(),
            'topic' => $a->topic->getCode(),
            'authorId' => $a->author->getId(),
            'bannerMediaId' => $a->bannerMedia?->id,
            'themeOverride' => $a->themeOverride,
            'createdAt' => Dates::format($a->createdAt),
            'updatedAt' => Dates::format($a->updatedAt),
            'publishedAt' => Dates::format($a->publishedAt),
            'reports' => array_values(array_map(fn ($r) => [
                'userId' => $r->user->getId(),
                'reason' => $r->reason,
                'createdAt' => Dates::format($r->createdAt),
            ], $a->reports->toArray())),
            'blocks' => array_map(fn (Block $b) => $this->block($b), $this->sortedBlocks($a)),
        ];
    }

    /** @return list<Block> */
    private function sortedBlocks(Article $a): array
    {
        $blocks = $a->blocks->toArray();
        usort($blocks, fn (Block $x, Block $y) => $x->position <=> $y->position);

        return $blocks;
    }

    public function block(Block $b): array
    {
        $fields = match ($b->type) {
            'heading' => ['level' => $b->headingLevel ?? 2, 'text' => $b->body ?? ''],
            'text' => ['text' => $b->body ?? ''],
            'quote' => ['text' => $b->body ?? '', 'cite' => $b->cite ?? ''],
            'image' => ['mediaId' => $b->media?->id, 'alt' => $b->alt ?? '', 'caption' => $b->caption],
            'chart' => $this->chart($b),
            default => [],
        };
        $extra = 'chart' === $b->type ? ($b->visualization?->options ?? []) : ($b->options ?? []);

        return ['id' => $b->uid, 'type' => $b->type] + array_filter($fields, fn ($v) => null !== $v) + $extra;
    }

    private function chart(Block $b): array
    {
        $v = $b->visualization;

        return [
            'datasetId' => $v?->dataset?->id,
            'chartType' => $v?->chartType,
            'x' => $v?->xVar,
            'y' => $v?->yVar,
            'color' => $v?->colorVar,
            'value' => $v?->valueVar,
            'aggregate' => $v?->aggregate,
            'title' => $v?->title,
            'subtitle' => $v?->subtitle,
            'caption' => $b->caption,
        ];
    }

    public function dataset(Dataset $d): array
    {
        $out = [
            'id' => $d->id,
            'name' => $d->name,
            'description' => $d->description ?? '',
            'url' => $d->url,
            'sourceType' => $d->sourceType,
            'jsonPath' => $d->jsonPath,
            'delimiter' => $d->csvDelimiter,
            'proxy' => $d->useProxy ?: null,
            'apiKeyEnv' => $d->apiKeyEnv,
            'providerId' => $d->provider->getId(),
            'rows' => $d->rowCount,
            'variables' => $this->variables($d),
            'createdAt' => Dates::format($d->createdAt),
        ];

        return array_filter($out, fn ($v) => null !== $v) + ($d->options ?? []);
    }

    private function variables(Dataset $d): array
    {
        $vars = $d->variables->toArray();
        usort($vars, fn ($a, $b) => $a->position <=> $b->position);

        return array_map(fn ($v) => ['name' => $v->name, 'kind' => $v->kind], $vars);
    }

    public function media(Media $m): array
    {
        return [
            'id' => $m->id,
            'name' => $m->filename,
            'url' => $m->url,
            'alt' => $m->alt,
            'width' => $m->width,
            'height' => $m->height,
            'uploaderId' => $m->uploader->getId(),
            'createdAt' => Dates::format($m->createdAt),
        ];
    }

    public function comment(Comment $c): array
    {
        return [
            'id' => $c->id,
            'articleId' => $c->article->id,
            'userId' => $c->user->getId(),
            'parentId' => $c->parent?->id,
            'text' => $c->body,
            'createdAt' => Dates::format($c->createdAt),
        ];
    }

    public function rating(Rating $r): array
    {
        return [
            'articleId' => $r->block->article->id,
            'blockId' => $r->block->uid,
            'userId' => $r->user->getId(),
            'value' => $r->value,
        ];
    }

    public function theme(Theme $t): array
    {
        return [
            'id' => 'site' === $t->scope ? 'site' : $t->scope.':'.$t->target,
            'scope' => $t->scope,
            'target' => 'site' === $t->scope ? null : $t->target,
            // Objet JSON même vide ({} et non []).
            'values' => (object) $t->values,
            'updatedBy' => $t->updatedBy?->getId(),
        ];
    }
}
