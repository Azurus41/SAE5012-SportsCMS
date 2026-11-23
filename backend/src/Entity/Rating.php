<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Note de 0 à 5 d'un abonné sur un bloc.
#[ORM\Entity]
#[ORM\Table(name: 'rating')]
#[ORM\UniqueConstraint(name: 'uq_rating', columns: ['block_id', 'user_id'])]
class Rating
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    #[ORM\Column(name: 'updated_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $updatedAt;

    public function __construct(
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'block_id', nullable: false, onDelete: 'CASCADE')]
        public Block $block,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
        public User $user,
        #[ORM\Column(type: Types::SMALLINT)]
        public int $value,
    ) {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
