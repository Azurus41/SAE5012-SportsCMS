<?php

namespace App\Controller;

use App\Entity\Article;
use App\Entity\Block;
use App\Entity\Comment;
use App\Entity\Rating;
use App\Entity\Report;
use App\Service\ArticleWriter;
use App\Service\Ids;
use App\Service\Input;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class ArticleController extends ApiController
{
    // Visiteurs : articles publiés d'auteurs non bannis. Auteurs : + leurs brouillons.
    // Éditeurs : + tous les brouillons. Administrateur : tout (y compris supprimés).
    #[Route('/articles', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $user = $this->currentUser();
        $articles = $this->em->createQueryBuilder()
            ->select('a', 'b', 'v', 'r')
            ->from(Article::class, 'a')
            ->join('a.author', 'u')
            ->leftJoin('a.blocks', 'b')
            ->leftJoin('b.visualization', 'v')
            ->leftJoin('a.reports', 'r')
            ->orderBy('a.publishedAt', 'DESC')
            ->addOrderBy('a.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
        $visible = array_filter($articles, fn (Article $a) => $this->can->readArticle($user, $a));

        return $this->ok(array_values(array_map(fn (Article $a) => $this->out->article($a), $visible)));
    }

    #[Route('/articles/{idOrSlug}', methods: ['GET'])]
    public function show(string $idOrSlug): JsonResponse
    {
        return $this->ok($this->out->article($this->readable($idOrSlug)));
    }

    #[Route('/articles', methods: ['POST'])]
    public function create(Request $request, ArticleWriter $writer): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->createArticle($user));
        $article = $writer->save($this->body($request), null, $user);
        $this->em->flush();

        return $this->ok($this->out->article($article), 201);
    }

    #[Route('/articles/{id}', methods: ['PUT'])]
    public function update(string $id, Request $request, ArticleWriter $writer): JsonResponse
    {
        $user = $this->requireUser();
        $article = $this->find($id);
        $this->guard($this->can->editArticle($user, $article), 'Vous ne pouvez modifier que vos propres articles.');
        $writer->save($this->body($request), $article, $user);
        $this->em->flush();

        return $this->ok($this->out->article($article));
    }

    // Suppression logique : l'administrateur peut restaurer l'article.
    #[Route('/articles/{id}', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $user = $this->requireUser();
        $article = $this->find($id);
        $this->guard($this->can->deleteArticle($user, $article));
        if ('deleted' !== $article->status) {
            $article->previousStatus = $article->status;
            $article->status = 'deleted';
            $this->em->flush();
        }

        return $this->ok($this->out->article($article));
    }

    #[Route('/articles/{id}/restore', methods: ['POST'])]
    public function restore(string $id): JsonResponse
    {
        $this->guard($this->can->moderate($this->currentUser()));
        $article = $this->find($id);
        $article->status = \in_array($article->previousStatus, Article::STATUSES, true) ? $article->previousStatus : 'published';
        $article->previousStatus = null;
        $this->em->flush();

        return $this->ok($this->out->article($article));
    }

    #[Route('/articles/{id}/reports', methods: ['POST'])]
    public function report(string $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->report($user));
        $article = $this->readable($id);
        $reason = trim((string) Input::string($this->body($request), 'reason', 300, 'Motif')) ?: 'Signalement';
        $already = $article->reports->exists(fn ($k, Report $r) => $r->user->getId() === $user->getId());
        if (!$already) {
            $article->reports->add(new Report($article, $user, $reason));
            $this->em->flush();
        }

        return $this->ok($this->out->article($article));
    }

    #[Route('/articles/{id}/reports', methods: ['DELETE'])]
    public function clearReports(string $id): JsonResponse
    {
        $this->guard($this->can->moderate($this->currentUser()));
        $article = $this->find($id);
        $article->reports->clear();
        $this->em->flush();

        return $this->ok($this->out->article($article));
    }

    // ---- Notes des blocs ----

    #[Route('/articles/{id}/ratings', methods: ['GET'])]
    public function ratings(string $id): JsonResponse
    {
        return $this->ok($this->ratingsOf($this->readable($id)));
    }

    #[Route('/ratings/summary', methods: ['GET'])]
    public function ratingsSummary(): JsonResponse
    {
        $rows = $this->em->createQueryBuilder()
            ->select('a.id AS articleId', 'AVG(r.value) AS average', 'COUNT(r.id) AS count')
            ->from(Rating::class, 'r')
            ->join('r.block', 'b')
            ->join('b.article', 'a')
            ->groupBy('a.id')
            ->getQuery()
            ->getArrayResult();

        return $this->ok(array_map(fn ($r) => [
            'articleId' => $r['articleId'],
            'average' => (float) $r['average'],
            'count' => (int) $r['count'],
        ], $rows));
    }

    #[Route('/articles/{id}/blocks/{blockId}/rating', methods: ['PUT'])]
    public function rate(string $id, string $blockId, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->rate($user), 'Abonnez-vous pour noter les blocs.');
        $article = $this->readable($id);
        $block = $article->findBlock($blockId) ?? $this->notFound('Bloc introuvable.');
        $value = $this->body($request)['value'] ?? null;
        if (!\is_int($value) || $value < 0 || $value > 5) {
            Input::fail('Note entre 0 et 5.');
        }
        $rating = $this->em->getRepository(Rating::class)->findOneBy(['block' => $block, 'user' => $user]);
        if ($rating) {
            $rating->value = $value;
            $rating->updatedAt = new \DateTimeImmutable();
        } else {
            $this->em->persist(new Rating($block, $user, $value));
        }
        $this->em->flush();

        return $this->ok($this->ratingsOf($article));
    }

    // ---- Commentaires ----

    #[Route('/articles/{id}/comments', methods: ['GET'])]
    public function comments(string $id): JsonResponse
    {
        $article = $this->readable($id);
        $comments = $this->em->getRepository(Comment::class)->findBy(['article' => $article], ['createdAt' => 'ASC']);

        return $this->ok(array_map(fn (Comment $c) => $this->out->comment($c), $comments));
    }

    #[Route('/articles/{id}/comments', methods: ['POST'])]
    public function addComment(string $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->comment($user), 'Connectez-vous en tant qu’abonné pour commenter.');
        $article = $this->readable($id);
        $text = trim((string) Input::string($this->body($request), 'text', 5000, 'Commentaire'));
        if ('' === $text) {
            Input::fail('Le commentaire est vide.');
        }
        $comment = new Comment(Ids::make('c'), $article, $user, $text);
        $this->em->persist($comment);
        $this->em->flush();

        return $this->ok($this->out->comment($comment), 201);
    }

    #[Route('/comments/{id}', methods: ['DELETE'])]
    public function deleteComment(string $id): Response
    {
        $user = $this->requireUser();
        $comment = $this->em->find(Comment::class, $id) ?? $this->notFound('Commentaire introuvable.');
        $this->guard($this->can->deleteComment($user, $comment));
        $this->em->remove($comment);
        $this->em->flush();

        return $this->ok(true);
    }

    // ---- Outils ----

    private function find(string $id): Article
    {
        return $this->em->find(Article::class, $id) ?? $this->notFound('Article introuvable.');
    }

    // Article lisible par l'utilisateur courant (sinon 404, pour ne pas révéler les brouillons).
    private function readable(string $idOrSlug): Article
    {
        $article = $this->em->find(Article::class, $idOrSlug)
            ?? $this->em->getRepository(Article::class)->findOneBy(['slug' => $idOrSlug]);
        if (!$article || !$this->can->readArticle($this->currentUser(), $article)) {
            $this->notFound('Article introuvable.');
        }

        return $article;
    }

    private function ratingsOf(Article $article): array
    {
        $ratings = $this->em->createQueryBuilder()
            ->select('r', 'b')
            ->from(Rating::class, 'r')
            ->join('r.block', 'b')
            ->where('b.article = :a')
            ->setParameter('a', $article)
            ->getQuery()
            ->getResult();

        return array_map(fn (Rating $r) => $this->out->rating($r), $ratings);
    }
}
