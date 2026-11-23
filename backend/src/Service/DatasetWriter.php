<?php

namespace App\Service;

use App\Entity\Dataset;
use App\Entity\DatasetVariable;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

// Enregistrement d'un jeu de données : lien vers les données + type de chaque variable.
class DatasetWriter
{
    private const KNOWN = ['id', 'name', 'description', 'url', 'sourceType', 'jsonPath', 'delimiter', 'proxy', 'apiKeyEnv', 'providerId', 'rows', 'variables', 'createdAt'];

    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function save(array $in, ?Dataset $existing, User $actor, ?string $newId = null): Dataset
    {
        $url = Input::string($in, 'url', 200000, 'Lien vers les données');
        if (!$url) {
            Input::fail('Le lien vers les données est obligatoire.');
        }
        $variables = $in['variables'] ?? [];
        if (!\is_array($variables) || [] === $variables) {
            Input::fail('Aucune variable identifiée.');
        }

        $ds = $existing ?? new Dataset($newId ?? Ids::make('ds'), $actor);
        $ds->name = trim((string) Input::string($in, 'name', 160, 'Nom')) ?: 'Jeu de données';
        $ds->description = Input::string($in, 'description', 5000, 'Description');
        $ds->url = $url;
        $ds->sourceType = Input::oneOf($in, 'sourceType', ['csv', 'json', 'api'], 'Type de source', 'csv');
        $ds->jsonPath = Input::string($in, 'jsonPath', 255, 'Chemin JSON');
        $delimiter = $in['delimiter'] ?? null;
        $ds->csvDelimiter = \is_string($delimiter) && 1 === mb_strlen($delimiter) ? $delimiter : null;
        $ds->useProxy = 'api' === $ds->sourceType && true === ($in['proxy'] ?? false);
        $keyEnv = $in['apiKeyEnv'] ?? null;
        $ds->apiKeyEnv = \is_string($keyEnv) && preg_match('/^[A-Z][A-Z0-9_]{0,79}$/', $keyEnv) ? $keyEnv : null;
        $ds->rowCount = Input::int($in, 'rows', 0);
        $ds->options = Input::extras($in, self::KNOWN);

        $this->writeVariables($ds, $variables);
        if (!$existing) {
            $this->em->persist($ds);
        }

        return $ds;
    }

    // Mise à jour en place (par nom) : pas de suppression/réinsertion qui heurterait la contrainte d'unicité.
    private function writeVariables(Dataset $ds, array $items): void
    {
        $current = [];
        foreach ($ds->variables as $v) {
            $current[$v->name] = $v;
        }
        $seen = [];
        $position = 0;
        foreach ($items as $item) {
            $name = \is_array($item) ? trim((string) ($item['name'] ?? '')) : '';
            $kind = \is_array($item) ? ($item['kind'] ?? null) : null;
            if ('' === $name || mb_strlen($name) > 160 || !\in_array($kind, ['categorical', 'numeric'], true)) {
                Input::fail('Variable invalide (nom et type « categorical » ou « numeric » attendus).');
            }
            if (isset($seen[$name])) {
                Input::fail("La variable « $name » apparaît deux fois.");
            }
            $seen[$name] = true;
            if (isset($current[$name])) {
                $current[$name]->kind = $kind;
                $current[$name]->position = $position;
            } else {
                $ds->variables->add(new DatasetVariable($ds, $name, $kind, $position));
            }
            ++$position;
        }
        foreach ($current as $name => $v) {
            if (!isset($seen[$name])) {
                $ds->variables->removeElement($v);
                $this->em->remove($v);
            }
        }
    }
}
