<?php

namespace App\Command;

use App\Entity\Article;
use App\Entity\Comment;
use App\Entity\Rating;
use App\Entity\Sport;
use App\Entity\Theme;
use App\Entity\Topic;
use App\Entity\User;
use App\Service\ArticleWriter;
use App\Service\DatasetWriter;
use App\Service\Dates;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

// Remplit une base vide avec les données de backend/fixtures/seed.json (produit par scripts/export-seed.mjs) :
// sports, sujets, un compte de test par rôle (mots de passe de docs/comptes-de-test.md), jeux de données,
// articles de démonstration, commentaires et notes. Ne fait rien si des comptes existent déjà.
#[AsCommand(name: 'app:seed', description: 'Crée les comptes de test et les articles de démonstration (base vide uniquement).')]
class SeedCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ArticleWriter $articles,
        private readonly DatasetWriter $datasets,
        private readonly string $seedFile,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $seed = json_decode((string) file_get_contents($this->seedFile), true, 512, \JSON_THROW_ON_ERROR);

        $this->em->wrapInTransaction(function () use ($seed, $io) {
            foreach ($seed['sports'] as $code => $label) {
                $this->em->find(Sport::class, $code) ?? $this->em->persist(new Sport($code, $label));
            }
            foreach ($seed['topics'] as $code => $label) {
                $this->em->find(Topic::class, $code) ?? $this->em->persist(new Topic($code, $label));
            }
            $this->em->flush();
            $io->writeln(\sprintf('Sports et sujets : %d + %d', \count($seed['sports']), \count($seed['topics'])));

            if ($this->em->getRepository(User::class)->count([]) > 0) {
                $io->note('Des comptes existent déjà : comptes et articles de démonstration non recréés.');

                return;
            }

            $users = [];
            foreach ($seed['users'] as $u) {
                $user = new User($u['id'], $u['email'], $u['name'], $u['role']);
                // Empreinte PBKDF2 du dépôt : convertie en bcrypt/argon2 à la première connexion.
                $user->setLegacyCredentials($u['hash'], $u['salt']);
                $user->setBanned((bool) ($u['banned'] ?? false));
                $this->em->persist($user);
                $users[$u['id']] = $user;
            }
            $this->em->flush();

            foreach ($seed['datasets'] as $d) {
                // Les données de démonstration gardent leurs identifiants (ds-iris, a-pressing…).
                $ds = $this->datasets->save($d, null, $users[$d['providerId']], $d['id']);
                $ds->createdAt = Dates::parse($d['createdAt'] ?? null) ?? $ds->createdAt;
            }
            $this->em->flush();

            foreach ($seed['articles'] as $a) {
                $article = $this->articles->save($a, null, $users[$a['authorId']], $a['id']);
                if ($published = Dates::parse($a['publishedAt'] ?? null)) {
                    $article->publishedAt = $article->createdAt = $article->updatedAt = $published;
                }
            }
            $this->em->flush();

            foreach ($seed['comments'] as $c) {
                $comment = new Comment($c['id'], $this->em->find(Article::class, $c['articleId']), $users[$c['userId']], $c['text']);
                $comment->createdAt = Dates::parse($c['createdAt'] ?? null) ?? $comment->createdAt;
                $this->em->persist($comment);
            }
            foreach ($seed['ratings'] as $r) {
                $block = $this->em->find(Article::class, $r['articleId'])?->findBlock($r['blockId']);
                if ($block) {
                    $this->em->persist(new Rating($block, $users[$r['userId']], $r['value']));
                }
            }
            foreach ($seed['themes'] as $t) {
                $theme = new Theme($t['scope'], (string) ($t['target'] ?? ''));
                $theme->values = $t['values'] ?? [];
                $this->em->persist($theme);
            }
            $this->em->flush();

            $io->success(\sprintf(
                '%d comptes de test, %d jeux de données, %d articles, %d commentaires, %d notes.',
                \count($users),
                \count($seed['datasets']),
                \count($seed['articles']),
                \count($seed['comments']),
                \count($seed['ratings']),
            ));
            $io->writeln('Identifiants : docs/comptes-de-test.md');
        });

        return Command::SUCCESS;
    }
}
