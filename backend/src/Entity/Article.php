<?php

namespace App\Entity;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'article')]
#[ORM\Index(name: 'idx_article_listing', columns: ['status', 'published_at'])]
class Article
{
    public const TYPES = ['classic', 'dashboard'];
    public const STATUSES = ['draft', 'published'];

    #[ORM\Column(length: 120, unique: true)]
    public string $slug = '';

    #[ORM\Column(length: 200)]
    public string $title = '';

    #[ORM\Column(type: Types::TEXT)]
    public string $summary = '';

    #[ORM\Column(length: 20)]
    public string $type = 'classic';

    // draft | published | deleted (suppression logique)
    #[ORM\Column(length: 20)]
    public string $status = 'draft';

    // Pour restaurer un article supprimé par la modération.
    #[ORM\Column(name: 'previous_status', length: 20, nullable: true)]
    public ?string $previousStatus = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'sport_code', referencedColumnName: 'code', nullable: false)]
    public Sport $sport;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'topic_code', referencedColumnName: 'code', nullable: false)]
    public Topic $topic;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'banner_media_id', nullable: true, onDelete: 'SET NULL')]
    public ?Media $bannerMedia = null;

    // Apparence choisie par l'auteur (police, couleurs…).
    #[ORM\Column(name: 'theme_override', type: Types::JSON, nullable: true)]
    public ?array $themeOverride = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $createdAt;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $updatedAt;

    #[ORM\Column(name: 'published_at', type: Types::DATETIME_IMMUTABLE, nullable: true)]
    public ?\DateTimeImmutable $publishedAt = null;

    /** @var Collection<int, Block> */
    #[ORM\OneToMany(targetEntity: Block::class, mappedBy: 'article', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    public Collection $blocks;

    /** @var Collection<int, Report> */
    #[ORM\OneToMany(targetEntity: Report::class, mappedBy: 'article', cascade: ['persist'], orphanRemoval: true)]
    #[ORM\OrderBy(['createdAt' => 'ASC'])]
    public Collection $reports;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 40)]
        public string $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'author_id', nullable: false)]
        public User $author,
    ) {
        $this->createdAt = $this->updatedAt = new \DateTimeImmutable();
        $this->blocks = new ArrayCollection();
        $this->reports = new ArrayCollection();
    }

    public function findBlock(string $uid): ?Block
    {
        foreach ($this->blocks as $block) {
            if ($block->uid === $uid) {
                return $block;
            }
        }

        return null;
    }
}
