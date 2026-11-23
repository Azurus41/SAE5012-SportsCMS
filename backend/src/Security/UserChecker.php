<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

// Un compte banni par la modération ne peut plus se connecter.
// Le contrôle a lieu après la vérification du mot de passe : on ne révèle rien sans les bons identifiants.
class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
    }

    public function checkPostAuth(UserInterface $user, ?TokenInterface $token = null): void
    {
        if ($user instanceof User && $user->isBanned()) {
            throw new CustomUserMessageAccountStatusException('Ce compte a été suspendu par la modération.');
        }
    }
}
