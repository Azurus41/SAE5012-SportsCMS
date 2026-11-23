<?php

namespace App\Controller;

use App\Entity\Dataset;
use App\Entity\Visualization;
use App\Service\DatasetWriter;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Routing\Attribute\Route;

// Jeux de données : le CMS ne stocke que le lien vers les données et le type de chaque variable.
#[Route('/api/datasets')]
class DatasetController extends ApiController
{
    #[Route('', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $all = $this->em->getRepository(Dataset::class)->findBy([], ['createdAt' => 'DESC']);

        return $this->ok(array_map(fn (Dataset $d) => $this->out->dataset($d), $all));
    }

    #[Route('', methods: ['POST'])]
    public function create(Request $request, DatasetWriter $writer): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->manageDatasets($user));
        $ds = $writer->save($this->body($request), null, $user);
        $this->em->flush();

        return $this->ok($this->out->dataset($ds), 201);
    }

    #[Route('/{id}', methods: ['PUT'])]
    public function update(string $id, Request $request, DatasetWriter $writer): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->manageDatasets($user));
        $ds = $this->em->find(Dataset::class, $id) ?? $this->notFound('Jeu de données introuvable.');
        $writer->save($this->body($request), $ds, $user);
        $this->em->flush();

        return $this->ok($this->out->dataset($ds));
    }

    #[Route('/{id}', methods: ['DELETE'])]
    public function delete(string $id): JsonResponse
    {
        $this->guard($this->can->manageDatasets($this->currentUser()));
        $ds = $this->em->find(Dataset::class, $id) ?? $this->notFound('Jeu de données introuvable.');
        $used = $this->em->getRepository(Visualization::class)->count(['dataset' => $ds]);
        if ($used > 0) {
            throw new HttpException(409, 'Ce jeu de données est utilisé par un article.');
        }
        $this->em->remove($ds);
        $this->em->flush();

        return $this->ok(true);
    }
}
