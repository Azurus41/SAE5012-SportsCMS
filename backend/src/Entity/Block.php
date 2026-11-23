<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Bloc d'un article. « uid » est l'identifiant choisi par l'éditeur (ex. b-k3j2h1) : il reste stable
// d'un enregistrement à l'autre, ce qui conserve les notes des abonnés quand l'article est modifié.
#[ORM\Entity]
#[ORM\Table(name: 'block')]
#[ORM\UniqueConstraint(name: 'uq_block_uid', columns: ['article_id', 'uid'])]
class Block
{
    public const TYPES = ['heading', 'text', 'image', 'chart', 'quote'];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    #[ORM\Column(type: Types::SMALLINT)]
    public int $position = 0;

    #[ORM\Column(length: 20)]
    public string $type = 'text';

    // 2, 3 ou 4 pour un titre.
    #[ORM\Column(name: 'heading_level', type: Types::SMALLINT, nullable: true)]
    public ?int $headingLevel = null;

    // Texte, titre ou citation.
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    public ?string $body = null;

    #[ORM\Column(length: 200, nullable: true)]
    public ?string $cite = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'media_id', nullable: true, onDelete: 'SET NULL')]
    public ?Media $media = null;

    #[ORM\Column(length: 255, nullable: true)]
    public ?string $alt = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    public ?string $caption = null;

    // Autres réglages du bloc transmis par l'éditeur (conservés tels quels).
    #[ORM\Column(type: Types::JSON, nullable: true)]
    public ?array $options = null;

    #[ORM\OneToOne(targetEntity: Visualization::class, mappedBy: 'block', cascade: ['persist', 'remove'])]
    public ?Visualization $visualization = null;

    public function __construct(
        #[ORM\ManyToOne(inversedBy: 'blocks')]
        #[ORM\JoinColumn(name: 'article_id', nullable: false, onDelete: 'CASCADE')]
        public Article $article,
        #[ORM\Column(length: 40)]
        public string $uid,
    ) {
    }
}
