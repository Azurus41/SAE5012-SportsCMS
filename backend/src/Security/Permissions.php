<?php

namespace App\Security;

use App\Entity\Article;
use App\Entity\Comment;
use App\Entity\User;

// Droits par rôle, tels que décrits dans le sujet de la SAÉ.
// Même tableau que frontend/src/auth/permissions.js (le front ne fait qu'adapter l'interface).
class Permissions
{
    private static function active(?User $u): bool
    {
        return null !== $u && !$u->isBanned();
    }

    private static function is(?User $u, string ...$roles): bool
    {
        return null !== $u && \in_array($u->getRole(), $roles, true);
    }

    public function rate(?User $u): bool
    {
        return self::active($u);
    }

    public function comment(?User $u): bool
    {
        return self::active($u);
    }

    public function report(?User $u): bool
    {
        return null !== $u;
    }

    public function createArticle(?User $u): bool
    {
        return self::active($u) && self::is($u, 'author', 'editor', 'admin');
    }

    public function editArticle(?User $u, Article $article): bool
    {
        return self::active($u)
            && (self::is($u, 'editor', 'admin') || (self::is($u, 'author') && $article->author->getId() === $u->getId()));
    }

    public function deleteArticle(?User $u, Article $article): bool
    {
        return self::is($u, 'editor', 'admin') || (self::is($u, 'author') && $article->author->getId() === $u->getId());
    }

    public function moderate(?User $u): bool
    {
        return self::is($u, 'admin');
    }

    public function manageUsers(?User $u): bool
    {
        return self::is($u, 'admin');
    }

    public function deleteComment(?User $u, Comment $comment): bool
    {
        return self::is($u, 'admin') || (null !== $u && $comment->user->getId() === $u->getId());
    }

    public function editTheme(?User $u): bool
    {
        return self::is($u, 'designer', 'admin');
    }

    public function manageDatasets(?User $u): bool
    {
        return self::is($u, 'provider', 'admin');
    }

    public function seeDrafts(?User $u): bool
    {
        return self::is($u, 'author', 'editor', 'admin');
    }

    // Lecture d'un article : publiés d'auteurs non bannis pour tous ; brouillons pour leur auteur,
    // les éditeurs et l'administrateur ; articles supprimés et auteurs bannis pour l'administrateur.
    public function readArticle(?User $u, Article $a): bool
    {
        if (self::is($u, 'admin')) {
            return true;
        }
        if ('deleted' === $a->status) {
            return false;
        }
        $own = null !== $u && $a->author->getId() === $u->getId();
        if ($a->author->isBanned() && !$own) {
            return false;
        }
        if ('published' === $a->status) {
            return true;
        }

        return $own || self::is($u, 'editor');
    }
}
