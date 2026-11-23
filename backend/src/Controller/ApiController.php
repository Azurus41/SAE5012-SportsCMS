<?php

namespace App\Controller;

use App\Entity\User;
use App\Security\Permissions;
use App\Service\ApiNormalizer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Contracts\Service\Attribute\Required;

// Outils communs aux contrôleurs de l'API : utilisateur connecté, lecture du JSON, refus d'accès.
abstract class ApiController extends AbstractController
{
    protected EntityManagerInterface $em;
    protected Permissions $can;
    protected ApiNormalizer $out;

    #[Required]
    public function setApiServices(EntityManagerInterface $em, Permissions $can, ApiNormalizer $out): void
    {
        $this->em = $em;
        $this->can = $can;
        $this->out = $out;
    }

    protected function currentUser(): ?User
    {
        $user = $this->getUser();

        return $user instanceof User ? $user : null;
    }

    // 401 si personne n'est connecté.
    protected function requireUser(): User
    {
        return $this->currentUser() ?? throw new HttpException(401, 'Connectez-vous pour effectuer cette action.');
    }

    // 401 si non connecté, 403 si le rôle ne le permet pas.
    protected function guard(bool $allowed, string $message = 'Action non autorisée pour votre rôle.'): void
    {
        if (!$allowed) {
            throw new HttpException($this->currentUser() ? 403 : 401, $this->currentUser() ? $message : 'Connectez-vous pour effectuer cette action.');
        }
    }

    protected function notFound(string $message): never
    {
        throw new HttpException(404, $message);
    }

    protected function body(Request $request): array
    {
        if ('' === $request->getContent()) {
            return [];
        }
        try {
            $data = json_decode($request->getContent(), true, 64, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new HttpException(400, 'Corps de requête JSON invalide.');
        }
        if (!\is_array($data)) {
            throw new HttpException(400, 'Un objet JSON est attendu.');
        }

        return $data;
    }

    protected function ok(mixed $data, int $status = 200): JsonResponse
    {
        return new JsonResponse($data, $status);
    }
}
