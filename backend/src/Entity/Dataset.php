<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Jeu de données : on ne stocke que le lien et le type des variables, jamais le contenu.
#[ORM\Entity]
#[ORM\Table(name: 'dataset')]
class Dataset
{
    #[ORM\Column(length: 160)]
    public string $name = '';

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    public ?string $description = null;

    #[ORM\Column(name: 'source_type', length: 10)]
    public string $sourceType = 'csv';

    // Fichier déposé (/uploads/…), lien CSV/JSON ou service open data.
    #[ORM\Column(type: Types::TEXT)]
    public string $url = '';

    #[ORM\Column(name: 'json_path', length: 255, nullable: true)]
    public ?string $jsonPath = null;

    #[ORM\Column(name: 'csv_delimiter', length: 1, nullable: true)]
    public ?string $csvDelimiter = null;

    // L'API exige une clé : appel par /api/proxy/{id}.
    #[ORM\Column(name: 'use_proxy')]
    public bool $useProxy = false;

    // NOM de la variable d'environnement qui contient la clé (jamais la clé elle-même).
    #[ORM\Column(name: 'api_key_env', length: 80, nullable: true)]
    public ?string $apiKeyEnv = null;

    #[ORM\Column(name: 'row_count', nullable: true)]
    public ?int $rowCount = null;

    // Autres réglages transmis par le front (conservés tels quels).
    #[ORM\Column(type: Types::JSON, nullable: true)]
    public ?array $options = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $createdAt;

    /** @var Collection<int, DatasetVariable> */
    #[ORM\OneToMany(targetEntity: DatasetVariable::class, mappedBy: 'dataset', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    public Collection $variables;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 40)]
        public string $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'provider_id', nullable: false)]
        public User $provider,
    ) {
        $this->createdAt = new \DateTimeImmutable();
        $this->variables = new ArrayCollection();
    }
}
