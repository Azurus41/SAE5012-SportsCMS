<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AccountStatusException;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authentication\AuthenticationFailureHandlerInterface;

// Réponses attendues par le front : 401 (identifiants faux), 403 (compte banni), 429 (trop d'essais).
class LoginFailureHandler implements AuthenticationFailureHandlerInterface
{
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): JsonResponse
    {
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            return new JsonResponse(['message' => 'Trop de tentatives. Réessayez dans une minute.'], 429);
        }
        if ($exception instanceof CustomUserMessageAccountStatusException) {
            return new JsonResponse(['message' => $exception->getMessageKey()], 403);
        }
        if ($exception instanceof AccountStatusException) {
            return new JsonResponse(['message' => 'Ce compte ne peut pas se connecter.'], 403);
        }

        return new JsonResponse(['message' => 'E-mail ou mot de passe incorrect.'], 401);
    }
}
