<?php

namespace App\Service;

use App\Entity\Article;
use App\Entity\Block;
use App\Entity\Dataset;
use App\Entity\Media;
use App\Entity\Sport;
use App\Entity\Topic;
use App\Entity\User;
use App\Entity\Visualization;
use Doctrine\ORM\EntityManagerInterface;

// Création et modification d'un article avec ses blocs (mêmes règles que l'API simulée du front).
// Les droits sont vérifiés par le contrôleur avant l'appel.
class ArticleWriter
{
    private const BLOCK_KEYS = ['id', 'type', 'level', 'text', 'cite', 'mediaId', 'alt', 'caption'];
    private const CHART_KEYS = ['datasetId', 'chartType', 'x', 'y', 'color', 'value', 'aggregate', 'title', 'subtitle'];

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function save(array $in, ?Article $existing, User $actor, ?string $newId = null): Article
    {
        $title = trim((string) Input::string($in, 'title', 200, 'Titre'));
        if ('' === $title) {
            Input::fail('Le titre est obligatoire.');
        }
        $blocks = $in['blocks'] ?? [];
        if (!\is_array($blocks) || !array_is_list($blocks)) {
            Input::fail('Liste de blocs invalide.');
        }
        if (\count($blocks) > 300) {
            Input::fail('Un article est limité à 300 blocs.');
        }
        $type = Input::oneOf($in, 'type', Article::TYPES, 'Type', $existing?->type ?? 'classic');
        $status = Input::oneOf($in, 'status', Article::STATUSES, 'Statut', 'draft');
        if ('published' === $status && 'dashboard' === $type) {
            $hasChart = (bool) array_filter($blocks, fn ($b) => \is_array($b) && 'chart' === ($b['type'] ?? null));
            if (!$hasChart) {
                Input::fail('Un article de type narration doit contenir au moins une visualisation.');
            }
        }
        $sport = $this->em->find(Sport::class, (string) ($in['sport'] ?? '')) ?? Input::fail('Sport inconnu.');
        $topic = $this->em->find(Topic::class, (string) ($in['topic'] ?? '')) ?? Input::fail('Sujet inconnu.');

        $article = $existing ?? new Article($newId ?? Ids::make('a'), $this->authorFor($in, $actor));
        $article->title = $title;
        $article->summary = (string) Input::string($in, 'summary', 5000, 'Résumé');
        $article->type = $type;
        $article->sport = $sport;
        $article->topic = $topic;
        $article->slug = $this->uniqueSlug((string) ($in['slug'] ?? '') ?: $title, $article->id);
        $article->bannerMedia = $this->media($in['bannerMediaId'] ?? null);
        $article->themeOverride = Input::objectOrNull($in['themeOverride'] ?? null);
        $now = new \DateTimeImmutable();
        $article->updatedAt = $now;
        if ('published' === $status) {
            $article->publishedAt ??= Dates::parse($in['publishedAt'] ?? null) ?? $now;
        }
        $article->status = $status;

        $this->writeBlocks($article, $blocks);
        if (!$existing) {
            $this->em->persist($article);
        }

        return $article;
    }

    // Un éditeur ou un administrateur peut créer un article au nom d'un autre auteur ; sinon l'auteur est l'utilisateur connecté.
    private function authorFor(array $in, User $actor): User
    {
        $id = $in['authorId'] ?? null;
        if (\is_string($id) && $id !== $actor->getId() && \in_array($actor->getRole(), ['editor', 'admin'], true)) {
            $author = $this->em->find(User::class, $id);
            if ($author && \in_array($author->getRole(), ['author', 'editor', 'admin'], true)) {
                return $author;
            }
        }

        return $actor;
    }

    private function uniqueSlug(string $wanted, string $articleId): string
    {
        $base = Ids::slugify($wanted) ?: Ids::make('article');
        $slug = $base;
        $repo = $this->em->getRepository(Article::class);
        while (($other = $repo->findOneBy(['slug' => $slug])) && $other->id !== $articleId) {
            $slug = substr($base, 0, 74).'-'.random_int(1000, 9999);
        }

        return $slug;
    }

    private function media(mixed $id): ?Media
    {
        return \is_string($id) && '' !== $id ? $this->em->find(Media::class, $id) : null;
    }

    private function writeBlocks(Article $article, array $items): void
    {
        $seen = [];
        foreach ($items as $position => $in) {
            if (!\is_array($in)) {
                Input::fail('Bloc invalide.');
            }
            $type = Input::oneOf($in, 'type', Block::TYPES, 'Type de bloc');
            if (null === $type) {
                Input::fail('Type de bloc manquant.');
            }
            $uid = $in['id'] ?? null;
            if (!Ids::isValid($uid) || isset($seen[$uid])) {
                $uid = Ids::make('b');
            }
            $seen[$uid] = true;

            $block = $article->findBlock($uid);
            if (!$block) {
                $block = new Block($article, $uid);
                $article->blocks->add($block);
            }
            $block->position = $position;
            $block->type = $type;
            $block->headingLevel = 'heading' === $type ? (Input::int($in, 'level', 2, 4) ?? 2) : null;
            $block->body = \in_array($type, ['heading', 'text', 'quote'], true) ? (string) Input::string($in, 'text', 15000, 'Texte') : null;
            $block->cite = 'quote' === $type ? Input::string($in, 'cite', 200, 'Auteur de la citation') : null;
            $block->media = 'image' === $type ? $this->media($in['mediaId'] ?? null) : null;
            $block->alt = 'image' === $type ? Input::string($in, 'alt', 255, 'Texte alternatif') : null;
            $block->caption = \in_array($type, ['image', 'chart'], true) ? Input::string($in, 'caption', 2000, 'Légende') : null;

            if ('chart' === $type) {
                $block->options = null;
                $this->writeVisualization($block, $in);
            } else {
                if ($block->visualization) {
                    $this->em->remove($block->visualization);
                    $block->visualization = null;
                }
                $block->options = Input::extras($in, self::BLOCK_KEYS);
            }
        }
        foreach ($article->blocks->toArray() as $block) {
            if (!isset($seen[$block->uid])) {
                $article->blocks->removeElement($block);
                $this->em->remove($block);
            }
        }
    }

    private function writeVisualization(Block $block, array $in): void
    {
        $v = $block->visualization ?? new Visualization($block);
        $block->visualization = $v;
        $datasetId = $in['datasetId'] ?? null;
        $v->dataset = null;
        if (\is_string($datasetId) && '' !== $datasetId) {
            $v->dataset = $this->em->find(Dataset::class, $datasetId) ?? Input::fail('Jeu de données introuvable pour un graphique.');
        }
        $v->chartType = Input::oneOf($in, 'chartType', Visualization::CHART_TYPES, 'Type de graphique', 'bar');
        $v->xVar = Input::string($in, 'x', 160, 'Variable x');
        $v->yVar = Input::string($in, 'y', 160, 'Variable y');
        $v->colorVar = Input::string($in, 'color', 160, 'Variable couleur');
        $v->valueVar = Input::string($in, 'value', 160, 'Variable valeur');
        $aggregate = $in['aggregate'] ?? null;
        $v->aggregate = \in_array($aggregate, Visualization::AGGREGATES, true) ? $aggregate : null;
        $v->title = Input::string($in, 'title', 200, 'Titre du graphique');
        $v->subtitle = Input::string($in, 'subtitle', 200, 'Sous-titre du graphique');
        $v->options = Input::extras($in, [...self::BLOCK_KEYS, ...self::CHART_KEYS]);
    }
}
