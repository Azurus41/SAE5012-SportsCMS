<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

// Médiathèque : toute image ajoutée à un article y est conservée et réutilisable.
#[ORM\Entity]
#[ORM\Table(name: 'media')]
class Media
{
    #[ORM\Column(type: Types::TEXT)]
    public string $url;

    #[ORM\Column(length: 255)]
    public string $alt = '';

    #[ORM\Column(name: 'mime_type', length: 60)]
    public string $mimeType = 'image/jpeg';

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    public ?int $width = null;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    public ?int $height = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    public \DateTimeImmutable $createdAt;

    public function __construct(
        #[ORM\Id]
        #[ORM\Column(length: 40)]
        public string $id,
        #[ORM\Column(length: 255)]
        public string $filename,
        #[ORM\ManyToOne]
        #[ORM\JoinColumn(name: 'uploader_id', nullable: false)]
        public User $uploader,
    ) {
        $this->createdAt = new \DateTimeImmutable();
    }
}
