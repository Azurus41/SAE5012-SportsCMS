<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'dataset_variable')]
#[ORM\UniqueConstraint(name: 'uq_variable', columns: ['dataset_id', 'name'])]
class DatasetVariable
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    public ?int $id = null;

    public function __construct(
        #[ORM\ManyToOne(inversedBy: 'variables')]
        #[ORM\JoinColumn(name: 'dataset_id', nullable: false, onDelete: 'CASCADE')]
        public Dataset $dataset,
        #[ORM\Column(length: 160)]
        public string $name,
        // categorical | numeric, choisi par le fournisseur de données.
        #[ORM\Column(length: 20)]
        public string $kind,
        #[ORM\Column(type: Types::SMALLINT)]
        public int $position,
    ) {
    }
}
