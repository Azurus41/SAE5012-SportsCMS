<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Security\Core\User\LegacyPasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'app_user')]
class User implements UserInterface, LegacyPasswordAuthenticatedUserInterface
{
    // Visiteur = non connecté : il n'a pas de compte.
    public const ROLES = ['subscriber', 'author', 'editor', 'designer', 'provider', 'admin'];

    #[ORM\Id]
    #[ORM\Column(length: 40)]
    private string $id;

    #[ORM\Column(length: 180, unique: true)]
    private string $email;

    #[ORM\Column(name: 'display_name', length: 120)]
    private string $name;

    #[ORM\Column(name: 'password_hash', length: 255)]
    private string $password;

    // Sel (base64) des anciennes empreintes PBKDF2 ; vidé dès que l'empreinte est convertie.
    #[ORM\Column(name: 'legacy_salt', length: 64, nullable: true)]
    private ?string $legacySalt = null;

    #[ORM\Column(length: 20)]
    private string $role = 'subscriber';

    #[ORM\Column]
    private bool $banned = false;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $id, string $email, string $name, string $role = 'subscriber')
    {
        $this->id = $id;
        $this->email = mb_strtolower(trim($email));
        $this->name = $name;
        $this->role = $role;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): void
    {
        $this->role = $role;
    }

    public function isBanned(): bool
    {
        return $this->banned;
    }

    public function setBanned(bool $banned): void
    {
        $this->banned = $banned;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $hash): void
    {
        $this->password = $hash;
    }

    public function setLegacyCredentials(string $hash, string $saltBase64): void
    {
        $this->password = $hash;
        $this->legacySalt = $saltBase64;
    }

    public function clearLegacySalt(): void
    {
        $this->legacySalt = null;
    }

    // Les empreintes PBKDF2 du front ont été calculées sur les octets du sel (et non sur sa forme base64).
    public function getSalt(): ?string
    {
        if (null === $this->legacySalt) {
            return null;
        }

        return base64_decode($this->legacySalt, true) ?: null;
    }

    public function getUserIdentifier(): string
    {
        return $this->email;
    }

    public function getRoles(): array
    {
        return ['ROLE_USER', 'ROLE_'.strtoupper($this->role)];
    }

    public function eraseCredentials(): void
    {
    }
}
