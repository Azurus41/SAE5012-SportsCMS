<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'topic')]
class Topic
{
    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 30)]
        private string $code,
        #[ORM\Column(length: 60)]
        private string $label,
    ) {
    }

    public function getCode(): string
    {
        return $this->code;
    }

    public function getLabel(): string
    {
        return $this->label;
    }
}
