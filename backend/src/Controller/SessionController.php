<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\Ids;
use App\Service\Input;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class SessionController extends ApiController
{
    #[Route('/me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        $user = $this->currentUser();

        return $this->ok($user ? $this->out->sessionUser($user) : null);
    }

    // Traité par le pare-feu (json_login, config/packages/security.yaml) : on n'arrive ici que si le corps n'est pas du JSON.
    #[Route('/login', name: 'api_login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        throw new HttpException(400, 'Envoyez { "email": "…", "password": "…" } en JSON.');
    }

    // Traité par le pare-feu (logout) ; App\EventSubscriber\LogoutSubscriber renvoie 204.
    #[Route('/logout', name: 'api_logout', methods: ['POST'])]
    public function logout(): never
    {
        throw new \LogicException('Intercepté par le pare-feu.');
    }

    // Création d'un compte abonné. Les autres rôles sont attribués par l'administrateur.
    #[Route('/register', methods: ['POST'])]
    public function register(
        Request $request,
        UserRepository $users,
        UserPasswordHasherInterface $hasher,
        RateLimiterFactory $registrationLimiter,
    ): JsonResponse {
        if (!$registrationLimiter->create($request->getClientIp() ?? 'inconnu')->consume()->isAccepted()) {
            throw new HttpException(429, 'Trop de comptes créés depuis cette adresse. Réessayez plus tard.');
        }
        $in = $this->body($request);
        $name = trim((string) Input::string($in, 'name', 120, 'Nom'));
        $email = mb_strtolower(trim((string) Input::string($in, 'email', 180, 'E-mail', true)));
        $password = (string) ($in['password'] ?? '');
        if (mb_strlen($name) < 2) {
            Input::fail('Indiquez votre nom (2 caractères au moins).');
        }
        if (!filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            Input::fail('Adresse e-mail invalide.');
        }
        if (mb_strlen($password) < 10 || \strlen($password) > 4096) {
            Input::fail('Le mot de passe doit contenir au moins 10 caractères.');
        }
        if ($users->findOneByEmail($email)) {
            throw new HttpException(409, 'Un compte existe déjà avec cette adresse e-mail.');
        }
        $user = new User(Ids::make('u'), $email, $name, 'subscriber');
        $user->setPassword($hasher->hashPassword($user, $password));
        $this->em->persist($user);
        $this->em->flush();

        return $this->ok($this->out->sessionUser($user), 201);
    }
}
