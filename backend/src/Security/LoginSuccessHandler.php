<?php

namespace App\Security;

use App\Entity\User;
use App\Service\ApiNormalizer;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Http\Authentication\AuthenticationSuccessHandlerInterface;

class LoginSuccessHandler implements AuthenticationSuccessHandlerInterface
{
    public function __construct(private readonly ApiNormalizer $normalizer)
    {
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token): JsonResponse
    {
        $user = $token->getUser();

        return new JsonResponse($user instanceof User ? $this->normalizer->sessionUser($user) : null);
    }
}
