# Touchline — CMS de data storytelling sportif (SAÉ 501.2)

CMS dans lequel des journalistes sportifs racontent matchs, équipes et saisons à partir de données
(CSV, JSON ou API open data), avec des visualisations interactives notées bloc par bloc par les abonnés.
Interface tirée de la maquette Figma « Touchline ».

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `frontend/` | Front React 18 + Vite : site public, éditeur d'articles, espace fournisseur de données, thèmes |
| `database/schema.sql` | Structure relationnelle MySQL (chargée par le conteneur `db`) |
| `docs/api.md` | Contrat de l'API REST à implémenter en Symfony, droits par rôle |
| `docker/`, `docker-compose.yml` | nginx (front + relais API), PHP-FPM (profil `back`), MySQL, phpMyAdmin |
| `non-code/` | Sujets de la SAÉ et livrables des TP Docker |

## Lancer le front

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (CSV, types de variables, règles des graphiques, agrégations)
```

Sans `VITE_API_URL`, le front fonctionne avec une **API simulée** (données dans le `localStorage` du navigateur) ;
avec `VITE_API_URL`, il appelle le back Symfony (voir plus bas).

**Connexion** : bouton « Connexion » de l'en-tête (page `/connexion`, d'après la maquette Figma).
Un compte de test existe pour chaque rôle (abonné, auteur, éditeur, designer, fournisseur de données,
administrateur) ; les identifiants sont dans [`docs/comptes-de-test.md`](docs/comptes-de-test.md).
Sans connexion, on navigue en **visiteur**. Le site ne contient que les empreintes PBKDF2 des mots de passe ;
`node scripts/create-test-accounts.mjs` régénère tous les comptes. Un administrateur peut remettre la démo
à zéro depuis Paramètres.

## Version en ligne

Site publié sur **https://deepdraft.fr/touchline/** (hébergement alwaysdata) avec le **back Symfony** :
les comptes, articles, notes, commentaires, jeux de données et thèmes sont enregistrés dans la base MySQL
(MariaDB) `azurus_touchline`. L'ancienne adresse `/touchdown/` redirige vers `/touchline/`.

Les comptes de test de [`docs/comptes-de-test.md`](docs/comptes-de-test.md) (un par rôle) existent en ligne
avec les mêmes mots de passe. Chacun peut aussi **créer un compte** abonné (page Connexion) ;
l'administrateur attribue ensuite les rôles depuis la page Auteurs.

### Où sont les fichiers sur alwaysdata

| Dossier (accessible en SFTP/FTP, ex. FileZilla) | Contenu |
|---|---|
| `~/touchline/` | Dépôt Git complet ; le back Symfony tourne depuis `~/touchline/backend` (hors du dossier web) |
| `~/touchline/backend/.env.local` | Secrets du serveur (mot de passe MySQL, `APP_SECRET`) — jamais versionné |
| `~/www/deepdraft/touchline/` | Front construit (`index.html`, `assets/`…), `api.php` (relais vers Symfony), `.htaccess` |
| `~/www/deepdraft/touchline/uploads/` | Fichiers déposés par les utilisateurs (CSV, images) — conservés entre deux mises en ligne |

### Mettre à jour le site

Depuis un terminal SSH sur alwaysdata (SSH web : administration → Accès distant → SSH → « par le Web ») :

```bash
bash ~/touchline/scripts/deploy-server.sh            # branche main
```

ou depuis votre poste : `./scripts/deploy-alwaysdata.sh` (clé SSH `~/.ssh/alwaysdata_touchline`). Le script récupère
la branche, installe les dépendances, applique les migrations Doctrine, construit le front pour `/touchline/` et le publie.
Vérification de bout en bout : `scripts/smoke-test-api.sh https://deepdraft.fr/touchline` (42 contrôles).

Première installation (déjà faite) : `git clone` du dépôt dans `~/touchline`, base MySQL créée dans l'administration,
puis `deploy-server.sh` crée `backend/.env.local` où l'on renseigne le mot de passe MySQL.

## Back Symfony (`backend/`)

API REST Symfony 7.4 + Doctrine ORM (contrat : [`docs/api.md`](docs/api.md)) :

- `src/Entity/` : utilisateurs, articles, blocs, visualisations, jeux de données, médias, notes, commentaires,
  signalements, thèmes ; structure créée par la migration `migrations/Version20261123140000.php` ;
- `src/Security/Permissions.php` : mêmes droits par rôle que `frontend/src/auth/permissions.js` ;
- connexion par `json_login` (session par cookie, 5 essais par minute), inscription limitée à 5 comptes par heure et par IP ;
- `php bin/console app:seed` : comptes de test et articles de démonstration (`fixtures/seed.json`,
  produit par `node scripts/export-seed.mjs` à partir des données du front) ; ne fait rien si des comptes existent.

```bash
cd backend
composer install
DATABASE_URL="sqlite:///%kernel.project_dir%/var/dev.db" php bin/console doctrine:migrations:migrate -n
DATABASE_URL="sqlite:///%kernel.project_dir%/var/dev.db" php bin/console app:seed
DATABASE_URL="sqlite:///%kernel.project_dir%/var/dev.db" php -S 127.0.0.1:8000 -t public
# front branché sur ce back : cd frontend && VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

## Lancer avec Docker

```bash
cp .env.example .env
docker compose up -d --build                  # front sur :8080, phpMyAdmin sur :8081
docker compose --profile back up -d --build   # + PHP-FPM, quand le dossier backend/ (Symfony) existe
```

## Fonctionnalités du front

- **Accueil** : objets de sport en 3D (three.js / WebGL) en orbite autour du bouton « Créer un article » ;
  chacun s'anime au survol (ballon dans le but, panier, rebond, médaille) et mène aux articles de son sport.
- **Articles** : recherche (Ctrl+K), filtres sport / sujet / date / temps de lecture, tri, pagination ;
  vue de modération pour l'administrateur (signalements, auteurs bannis, articles supprimés).
- **Page article** : blocs titre / texte / image / citation / graphique, sommaire suivi au défilement,
  note de 0 à 5 étoiles par bloc, commentaires, favoris, partage, signalement, sources des données.
- **Visualisations interactives** : barres, camembert, courbe, nuage de points, histogramme, chiffres clés
  (dernière valeur, moyenne, médiane, écart-type…), classement, face-à-face (le lecteur choisit les deux
  protagonistes), heatmap sur terrain. Infobulles, légendes cliquables, tri, nombre de classes réglable,
  tableau des données pour l'accessibilité.
- **Éditeur** (maquette « Article editor ») : blocs, annuler / rétablir, gras / italique / lien / liste,
  bannière, médiathèque partagée, choix du jeu de données, du type de graphique, des variables
  (les variables incompatibles sont désactivées) et des couleurs, aperçu, apparence propre à l'article.
- **Fournisseur de données** : dépôt d'un CSV, d'un lien CSV/JSON ou d'une API (ex. TheSportsDB),
  aperçu en tableau, problèmes détectés (séparateur, lignes incomplètes), type de chaque variable.
- **Designer** : thème du site, d'une page ou d'un article (couleurs, tailles, police), aperçu en direct.

## Suite du projet

1. Back-office (EasyAdmin) sur les entités de `backend/src/Entity/`.
2. Proxy des API open data à clé (`/api/proxy/{id}`, prévu dans `docs/api.md`, pas encore codé).
3. Réinitialisation de mot de passe par e-mail.
4. Publier les images sur un hub (`docker compose build && docker compose push`).
