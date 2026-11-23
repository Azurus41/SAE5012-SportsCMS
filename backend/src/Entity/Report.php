<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Signalement d'un article (un par utilisateur).
#[ORM\Entity]
#[ORM\Table(name: 'report')]
#[ORM\UniqueConstraint(name: 'uq_report', columns: ['article_id', 'user_id'])]
class Report
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\ManyToOne(inversedBy: 'reports')]
        #[ORM\JoinColumn(name: 'article_id', nullable: false, onDelete: 'CASCADE')]
        public Article $article,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
        public User $user,
        #[ORM\Column(length: 300)]
        public string $reason,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }
}
