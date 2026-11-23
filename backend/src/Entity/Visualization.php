<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Paramètres d'une visualisation (bloc « chart ») : jeu de données, type, variables, couleurs.
#[ORM\Entity]
#[ORM\Table(name: 'visualization')]
class Visualization
{
    public const CHART_TYPES = ['bar', 'pie', 'line', 'scatter', 'histogram', 'kpi', 'ranking', 'versus', 'heatmap'];
    public const AGGREGATES = ['sum', 'mean', 'count', 'last', 'max', 'min', 'median', 'std'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    // Nul tant que l'auteur n'a pas choisi de jeu de données (brouillon).
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'dataset_id', nullable: true)]
    public ?Dataset $dataset = null;

    #[ORM\Column(name: 'chart_type', length: 20)]
    public string $chartType = 'bar';

    #[ORM\Column(name: 'x_var', length: 160, nullable: true)]
    public ?string $xVar = null;

    #[ORM\Column(name: 'y_var', length: 160, nullable: true)]
    public ?string $yVar = null;

    #[ORM\Column(name: 'color_var', length: 160, nullable: true)]
    public ?string $colorVar = null;

    #[ORM\Column(name: 'value_var', length: 160, nullable: true)]
    public ?string $valueVar = null;

    #[ORM\Column(length: 20, nullable: true)]
    public ?string $aggregate = null;

    #[ORM\Column(length: 200, nullable: true)]
    public ?string $title = null;

    #[ORM\Column(length: 200, nullable: true)]
    public ?string $subtitle = null;

    // Séries, couleurs par série/catégorie, filtre, classes, largeur, protagonistes du face-à-face…
    #[ORM\Column(type: Types::JSON, nullable: true)]
    public ?array $options = null;

    public function __construct(
        #[ORM\OneToOne(inversedBy: 'visualization')]
        #[ORM\JoinColumn(name: 'block_id', nullable: false, unique: true, onDelete: 'CASCADE')]
        public Block $block,
    ) {
    }
}
