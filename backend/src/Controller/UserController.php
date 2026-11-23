<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\Input;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/users')]
class UserController extends ApiController
{
    // Liste publique (noms des auteurs et des commentateurs) : sans e-mail.
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $users = $this->em->getRepository(User::class)->findBy([], ['createdAt' => 'ASC']);

        return $this->ok(array_map(fn (User $u) => $this->out->publicUser($u), $users));
    }

    // Administrateur : bannir / réintégrer, changer le rôle.
    #[Route('/{id}', methods: ['PATCH'])]
    public function update(string $id, Request $request): JsonResponse
    {
        $me = $this->requireUser();
        $this->guard($this->can->manageUsers($me));
        $user = $this->em->find(User::class, $id) ?? $this->notFound('Utilisateur introuvable.');
        $in = $this->body($request);
        if ($user->getId() === $me->getId() && (\array_key_exists('banned', $in) || \array_key_exists('role', $in))) {
            Input::fail('Vous ne pouvez pas modifier votre propre rôle ni vous bannir.', 403);
        }
        if (\array_key_exists('banned', $in)) {
            if ('admin' === $user->getRole() && $in['banned']) {
                Input::fail('Un administrateur ne peut pas être banni.', 403);
            }
            $user->setBanned((bool) $in['banned']);
        }
        if (\array_key_exists('role', $in)) {
            $user->setRole(Input::oneOf($in, 'role', User::ROLES, 'Rôle'));
        }
        $this->em->flush();

        return $this->ok($this->out->publicUser($user));
    }
}
