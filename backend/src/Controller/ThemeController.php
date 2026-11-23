<?php

namespace App\Controller;

use App\Entity\Theme;
use App\Service\Input;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

// Thèmes des designers : site entier, une page ou un article.
#[Route('/api/themes')]
class ThemeController extends ApiController
{
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $themes = $this->em->getRepository(Theme::class)->findAll();

        return $this->ok(array_map(fn (Theme $t) => $this->out->theme($t), $themes));
    }

    #[Route('', methods: ['PUT'])]
    public function save(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->editTheme($user));
        $in = $this->body($request);
        $scope = Input::oneOf($in, 'scope', Theme::SCOPES, 'Portée', 'site');
        $target = 'site' === $scope ? '' : trim((string) Input::string($in, 'target', 120, 'Cible', true));
        $values = $in['values'] ?? [];
        if (!\is_array($values) || \strlen(json_encode($values)) > 20000) {
            Input::fail('Paramètres de thème invalides.');
        }
        $values = array_filter($values, fn ($v, $k) => \is_string($k) && (\is_scalar($v) || null === $v), \ARRAY_FILTER_USE_BOTH);

        $theme = $this->em->getRepository(Theme::class)->findOneBy(['scope' => $scope, 'target' => $target]);
        if (!$theme) {
            $theme = new Theme($scope, $target);
            $this->em->persist($theme);
        }
        $theme->values = $values;
        $theme->updatedBy = $user;
        $theme->updatedAt = new \DateTimeImmutable();
        $this->em->flush();

        return $this->ok($this->out->theme($theme));
    }
}
