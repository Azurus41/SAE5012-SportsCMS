-- Touchline — structure relationnelle du CMS de data storytelling sportif (MySQL 8.4 / MariaDB 11).
-- Chargée automatiquement par le conteneur MySQL au premier démarrage (docker-entrypoint-initdb.d).
-- Les entités Doctrine du back Symfony devront reprendre ces tables et ces contraintes.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------------------
-- Utilisateurs et rôles
-- ---------------------------------------------------------------------------
CREATE TABLE app_user (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(180) NOT NULL UNIQUE,
  display_name  VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  -- visiteur = non connecté ; les autres rôles sont décrits dans le sujet.
  role          ENUM('subscriber','author','editor','designer','provider','admin') NOT NULL DEFAULT 'subscriber',
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Classement éditorial
-- ---------------------------------------------------------------------------
CREATE TABLE sport (
  code  VARCHAR(30) PRIMARY KEY,
  label VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE topic (
  code  VARCHAR(30) PRIMARY KEY,
  label VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Jeux de données : on ne stocke que le lien et le type des variables, jamais le contenu.
-- ---------------------------------------------------------------------------
CREATE TABLE dataset (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(160) NOT NULL,
  description  TEXT NULL,
  source_type  ENUM('csv','json','api') NOT NULL DEFAULT 'csv',
  url          VARCHAR(1000) NOT NULL,           -- fichier déposé (/uploads/…), lien CSV/JSON ou service open data
  json_path    VARCHAR(255) NULL,                -- ex. standings.0.table
  csv_delimiter CHAR(1) NULL DEFAULT ';',         -- (pas « delimiter » : mot interprété par le client mysql)
  use_proxy    BOOLEAN NOT NULL DEFAULT FALSE,   -- l'API exige une clé : appel par /api/proxy/{id}
  api_key_env  VARCHAR(80) NULL,                 -- NOM de la variable d'environnement qui contient la clé (jamais la clé)
  row_count    INT UNSIGNED NULL,
  provider_id  INT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dataset_provider FOREIGN KEY (provider_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dataset_variable (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT UNSIGNED NOT NULL,
  name       VARCHAR(160) NOT NULL,
  kind       ENUM('categorical','numeric') NOT NULL,  -- choisi par le fournisseur de données
  position   SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_variable (dataset_id, name),
  CONSTRAINT fk_variable_dataset FOREIGN KEY (dataset_id) REFERENCES dataset (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Médiathèque : toute image ajoutée à un article y est conservée et réutilisable.
-- ---------------------------------------------------------------------------
CREATE TABLE media (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  filename    VARCHAR(255) NOT NULL,
  url         VARCHAR(1000) NOT NULL,
  alt         VARCHAR(255) NOT NULL DEFAULT '',
  mime_type   VARCHAR(60) NOT NULL,
  width       SMALLINT UNSIGNED NULL,
  height      SMALLINT UNSIGNED NULL,
  uploader_id INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_media_uploader FOREIGN KEY (uploader_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Articles et blocs
-- ---------------------------------------------------------------------------
CREATE TABLE article (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(120) NOT NULL UNIQUE,
  title            VARCHAR(200) NOT NULL,
  summary          TEXT NOT NULL,
  type             ENUM('classic','dashboard') NOT NULL DEFAULT 'classic',
  status           ENUM('draft','published','deleted') NOT NULL DEFAULT 'draft',
  previous_status  ENUM('draft','published') NULL,   -- pour restaurer un article supprimé par la modération
  sport_code       VARCHAR(30) NOT NULL,
  topic_code       VARCHAR(30) NOT NULL,
  author_id        INT UNSIGNED NOT NULL,
  banner_media_id  INT UNSIGNED NULL,
  theme_override   JSON NULL,                        -- apparence choisie par l'auteur (police, couleurs…)
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  published_at     DATETIME NULL,
  KEY idx_article_listing (status, published_at),
  CONSTRAINT fk_article_author FOREIGN KEY (author_id) REFERENCES app_user (id),
  CONSTRAINT fk_article_sport  FOREIGN KEY (sport_code) REFERENCES sport (code),
  CONSTRAINT fk_article_topic  FOREIGN KEY (topic_code) REFERENCES topic (code),
  CONSTRAINT fk_article_banner FOREIGN KEY (banner_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE block (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_id    INT UNSIGNED NOT NULL,
  position      SMALLINT UNSIGNED NOT NULL,
  type          ENUM('heading','text','image','chart','quote') NOT NULL,
  heading_level TINYINT UNSIGNED NULL,               -- 2, 3 ou 4 pour un titre
  body          TEXT NULL,                           -- texte, titre ou citation
  cite          VARCHAR(200) NULL,
  media_id      INT UNSIGNED NULL,
  alt           VARCHAR(255) NULL,
  caption       VARCHAR(300) NULL,
  UNIQUE KEY uq_block_position (article_id, position),
  CONSTRAINT fk_block_article FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE,
  CONSTRAINT fk_block_media   FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT chk_heading_level CHECK (heading_level IS NULL OR heading_level BETWEEN 2 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paramètres d'une visualisation (un bloc « chart ») : jeu de données, type, variables, couleurs.
CREATE TABLE visualization (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  block_id    INT UNSIGNED NOT NULL UNIQUE,
  dataset_id  INT UNSIGNED NOT NULL,
  chart_type  ENUM('bar','pie','line','scatter','histogram','kpi','ranking','versus','heatmap') NOT NULL,
  x_var       VARCHAR(160) NULL,
  y_var       VARCHAR(160) NULL,
  color_var   VARCHAR(160) NULL,
  value_var   VARCHAR(160) NULL,
  aggregate   ENUM('sum','mean','count','last','max','min','median','std') NULL,
  title       VARCHAR(200) NULL,
  subtitle    VARCHAR(200) NULL,
  -- séries (courbes, chiffres clés, face-à-face), couleurs par série/catégorie, filtre, classes, largeur…
  options     JSON NULL,
  CONSTRAINT fk_visualization_block   FOREIGN KEY (block_id) REFERENCES block (id) ON DELETE CASCADE,
  CONSTRAINT fk_visualization_dataset FOREIGN KEY (dataset_id) REFERENCES dataset (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Interactions des abonnés
-- ---------------------------------------------------------------------------
CREATE TABLE rating (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  block_id   INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  value      TINYINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rating (block_id, user_id),
  CONSTRAINT fk_rating_block FOREIGN KEY (block_id) REFERENCES block (id) ON DELETE CASCADE,
  CONSTRAINT fk_rating_user  FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
  CONSTRAINT chk_rating_value CHECK (value BETWEEN 0 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comment (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  parent_id  INT UNSIGNED NULL,                      -- réponses en fil (style forum)
  body       TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_article FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_user    FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_parent  FOREIGN KEY (parent_id) REFERENCES comment (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE report (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  article_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  reason     VARCHAR(300) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (article_id, user_id),
  CONSTRAINT fk_report_article FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE,
  CONSTRAINT fk_report_user    FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Thèmes des designers (surcouche de variables CSS) : site, page ou article.
-- ---------------------------------------------------------------------------
CREATE TABLE theme (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scope       ENUM('site','page','article') NOT NULL,
  target      VARCHAR(120) NOT NULL DEFAULT '',      -- '' pour le site, clé de page ou id d'article
  theme_values JSON NOT NULL,                        -- { "accent": "#2458e8", "titleSize": 56, … }
  updated_by  INT UNSIGNED NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_theme_target (scope, target),
  CONSTRAINT fk_theme_user FOREIGN KEY (updated_by) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Données de référence
-- ---------------------------------------------------------------------------
INSERT INTO sport (code, label) VALUES
  ('football', 'Football'), ('basketball', 'Basket-ball'), ('athletisme', 'Athlétisme'), ('tennis', 'Tennis');

INSERT INTO topic (code, label) VALUES
  ('tactique', 'Tactique & stratégie'), ('performance', 'Performance'), ('culture', 'Culture & opinion');
