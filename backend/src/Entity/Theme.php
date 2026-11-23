<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Thème des designers (surcouche de variables CSS) : site, page ou article.
#[ORM\Entity]
#[ORM\Table(name: 'theme')]
#[ORM\UniqueConstraint(name: 'uq_theme_target', columns: ['scope', 'target'])]
class Theme
{
    public const SCOPES = ['site', 'page', 'article'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    // { "accent": "#2458e8", "titleSize": 56, … }
    #[ORM\Column(name: 'theme_values', type: Types::JSON)]
    public array $values = [];

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'updated_by', nullable: true, onDelete: 'SET NULL')]
    public ?User $updatedBy = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\Column(length: 10)]
        public string $scope,
        // '' pour le site, clé de page ou id d'article.
        #[ORM\Column(length: 120)]
        public string $target = '',
    ) {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
