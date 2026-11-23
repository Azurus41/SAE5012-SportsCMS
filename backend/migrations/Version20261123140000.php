<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Schema\Table;
use Doctrine\DBAL\Types\Types;
use Doctrine\Migrations\AbstractMigration;

// Structure initiale de Touchline (reprend database/schema.sql, avec les identifiants publics du front en clé).
// Écrite avec l'API Schema de Doctrine : elle fonctionne sur MySQL 8, MariaDB (alwaysdata) et SQLite.
final class Version20261123140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Touchline : comptes, articles, blocs, visualisations, jeux de données, médias, notes, commentaires, signalements, thèmes';
    }

    public function up(Schema $schema): void
    {
        $user = $schema->createTable('app_user');
        $this->id($user, 40);
        $user->addColumn('email', Types::STRING, ['length' => 180]);
        $user->addColumn('display_name', Types::STRING, ['length' => 120]);
        $user->addColumn('password_hash', Types::STRING, ['length' => 255]);
        $user->addColumn('legacy_salt', Types::STRING, ['length' => 64, 'notnull' => false]);
        $user->addColumn('role', Types::STRING, ['length' => 20]);
        $user->addColumn('banned', Types::BOOLEAN);
        $user->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $user->addUniqueIndex(['email']);

        foreach (['sport', 'topic'] as $name) {
            $t = $schema->createTable($name);
            $t->addColumn('code', Types::STRING, ['length' => 30]);
            $t->addColumn('label', Types::STRING, ['length' => 60]);
            $t->setPrimaryKey(['code']);
        }

        $media = $schema->createTable('media');
        $this->id($media, 40);
        $media->addColumn('url', Types::TEXT);
        $media->addColumn('alt', Types::STRING, ['length' => 255]);
        $media->addColumn('mime_type', Types::STRING, ['length' => 60]);
        $media->addColumn('width', Types::SMALLINT, ['notnull' => false]);
        $media->addColumn('height', Types::SMALLINT, ['notnull' => false]);
        $media->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $media->addColumn('filename', Types::STRING, ['length' => 255]);
        $this->ref($media, 'uploader_id', $user, false);

        $dataset = $schema->createTable('dataset');
        $this->id($dataset, 40);
        $dataset->addColumn('name', Types::STRING, ['length' => 160]);
        $dataset->addColumn('description', Types::TEXT, ['notnull' => false]);
        $dataset->addColumn('source_type', Types::STRING, ['length' => 10]);
        $dataset->addColumn('url', Types::TEXT);
        $dataset->addColumn('json_path', Types::STRING, ['length' => 255, 'notnull' => false]);
        $dataset->addColumn('csv_delimiter', Types::STRING, ['length' => 1, 'notnull' => false]);
        $dataset->addColumn('use_proxy', Types::BOOLEAN);
        $dataset->addColumn('api_key_env', Types::STRING, ['length' => 80, 'notnull' => false]);
        $dataset->addColumn('row_count', Types::INTEGER, ['notnull' => false]);
        $dataset->addColumn('options', Types::JSON, ['notnull' => false]);
        $dataset->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $this->ref($dataset, 'provider_id', $user, false);

        $variable = $schema->createTable('dataset_variable');
        $this->autoId($variable);
        $variable->addColumn('name', Types::STRING, ['length' => 160]);
        $variable->addColumn('kind', Types::STRING, ['length' => 20]);
        $variable->addColumn('position', Types::SMALLINT);
        $this->ref($variable, 'dataset_id', $dataset, false, 'CASCADE');
        $variable->addUniqueIndex(['dataset_id', 'name'], 'uq_variable');

        $article = $schema->createTable('article');
        $this->id($article, 40);
        $article->addColumn('slug', Types::STRING, ['length' => 120]);
        $article->addColumn('title', Types::STRING, ['length' => 200]);
        $article->addColumn('summary', Types::TEXT);
        $article->addColumn('type', Types::STRING, ['length' => 20]);
        $article->addColumn('status', Types::STRING, ['length' => 20]);
        $article->addColumn('previous_status', Types::STRING, ['length' => 20, 'notnull' => false]);
        $article->addColumn('theme_override', Types::JSON, ['notnull' => false]);
        $article->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $article->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $article->addColumn('published_at', Types::DATETIME_IMMUTABLE, ['notnull' => false]);
        $this->ref($article, 'sport_code', $schema->getTable('sport'), false, null, 'code', 30);
        $this->ref($article, 'topic_code', $schema->getTable('topic'), false, null, 'code', 30);
        $this->ref($article, 'banner_media_id', $media, true, 'SET NULL');
        $this->ref($article, 'author_id', $user, false);
        $article->addUniqueIndex(['slug']);
        $article->addIndex(['status', 'published_at'], 'idx_article_listing');

        $block = $schema->createTable('block');
        $this->autoId($block);
        $block->addColumn('position', Types::SMALLINT);
        $block->addColumn('type', Types::STRING, ['length' => 20]);
        $block->addColumn('heading_level', Types::SMALLINT, ['notnull' => false]);
        $block->addColumn('body', Types::TEXT, ['notnull' => false]);
        $block->addColumn('cite', Types::STRING, ['length' => 200, 'notnull' => false]);
        $block->addColumn('alt', Types::STRING, ['length' => 255, 'notnull' => false]);
        $block->addColumn('caption', Types::TEXT, ['notnull' => false]);
        $block->addColumn('options', Types::JSON, ['notnull' => false]);
        $block->addColumn('uid', Types::STRING, ['length' => 40]);
        $this->ref($block, 'media_id', $media, true, 'SET NULL');
        $this->ref($block, 'article_id', $article, false, 'CASCADE');
        $block->addUniqueIndex(['article_id', 'uid'], 'uq_block_uid');

        $viz = $schema->createTable('visualization');
        $this->autoId($viz);
        $viz->addColumn('chart_type', Types::STRING, ['length' => 20]);
        foreach (['x_var', 'y_var', 'color_var', 'value_var'] as $col) {
            $viz->addColumn($col, Types::STRING, ['length' => 160, 'notnull' => false]);
        }
        $viz->addColumn('aggregate', Types::STRING, ['length' => 20, 'notnull' => false]);
        $viz->addColumn('title', Types::STRING, ['length' => 200, 'notnull' => false]);
        $viz->addColumn('subtitle', Types::STRING, ['length' => 200, 'notnull' => false]);
        $viz->addColumn('options', Types::JSON, ['notnull' => false]);
        $this->ref($viz, 'dataset_id', $dataset, true);
        $this->ref($viz, 'block_id', $block, false, 'CASCADE');
        $viz->addUniqueIndex(['block_id']);

        $rating = $schema->createTable('rating');
        $this->autoId($rating);
        $rating->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $rating->addColumn('value', Types::SMALLINT);
        $this->ref($rating, 'block_id', $block, false, 'CASCADE');
        $this->ref($rating, 'user_id', $user, false, 'CASCADE');
        $rating->addUniqueIndex(['block_id', 'user_id'], 'uq_rating');

        $comment = $schema->createTable('comment');
        $this->id($comment, 40);
        $comment->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $comment->addColumn('body', Types::TEXT);
        $comment->addColumn('parent_id', Types::STRING, ['length' => 40, 'notnull' => false]);
        $comment->addForeignKeyConstraint('comment', ['parent_id'], ['id'], ['onDelete' => 'CASCADE']);
        $this->ref($comment, 'article_id', $article, false, 'CASCADE');
        $this->ref($comment, 'user_id', $user, false, 'CASCADE');

        $report = $schema->createTable('report');
        $this->autoId($report);
        $report->addColumn('created_at', Types::DATETIME_IMMUTABLE);
        $report->addColumn('reason', Types::STRING, ['length' => 300]);
        $this->ref($report, 'article_id', $article, false, 'CASCADE');
        $this->ref($report, 'user_id', $user, false, 'CASCADE');
        $report->addUniqueIndex(['article_id', 'user_id'], 'uq_report');

        $theme = $schema->createTable('theme');
        $this->autoId($theme);
        $theme->addColumn('theme_values', Types::JSON);
        $theme->addColumn('updated_at', Types::DATETIME_IMMUTABLE);
        $theme->addColumn('scope', Types::STRING, ['length' => 10]);
        $theme->addColumn('target', Types::STRING, ['length' => 120]);
        $this->ref($theme, 'updated_by', $user, true, 'SET NULL');
        $theme->addUniqueIndex(['scope', 'target'], 'uq_theme_target');
    }

    public function down(Schema $schema): void
    {
        foreach (['theme', 'report', 'comment', 'rating', 'visualization', 'block', 'article', 'dataset_variable', 'dataset', 'media', 'topic', 'sport', 'app_user'] as $table) {
            $schema->dropTable($table);
        }
    }

    // MySQL/MariaDB valident chaque instruction DDL : pas de transaction englobante.
    public function isTransactional(): bool
    {
        return false;
    }

    private function id(Table $t, int $length): void
    {
        $t->addColumn('id', Types::STRING, ['length' => $length]);
        $t->setPrimaryKey(['id']);
    }

    private function autoId(Table $t): void
    {
        $t->addColumn('id', Types::INTEGER, ['autoincrement' => true]);
        $t->setPrimaryKey(['id']);
    }

    private function ref(Table $t, string $column, Table $target, bool $nullable, ?string $onDelete = null, string $targetColumn = 'id', ?int $length = null): void
    {
        $type = 'id' === $targetColumn && \in_array($target->getName(), ['block'], true) ? Types::INTEGER : Types::STRING;
        $options = ['notnull' => !$nullable];
        if (Types::STRING === $type) {
            $options['length'] = $length ?? 40;
        }
        $t->addColumn($column, $type, $options);
        $t->addForeignKeyConstraint($target->getName(), [$column], [$targetColumn], null === $onDelete ? [] : ['onDelete' => $onDelete]);
    }
}
