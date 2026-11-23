<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'comment')]
class Comment
{
    // Réponses en fil (style forum) : prévu par le modèle, pas encore utilisé par le front.
    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'parent_id', nullable: true, onDelete: 'CASCADE')]
    public ?Comment $parent = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 40)]
        public string $id,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'article_id', nullable: false, onDelete: 'CASCADE')]
        public Article $article,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
        public User $user,
        #[ORM\Column(type: Types::TEXT)]
        public string $body,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }
}
