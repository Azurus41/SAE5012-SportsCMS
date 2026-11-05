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

Sans back, le front fonctionne avec une **API simulée** (données dans le `localStorage` du navigateur).

**Connexion** : bouton « Connexion » de l'en-tête (page `/connexion`, d'après la maquette Figma).
Un compte de test existe pour chaque rôle (abonné, auteur, éditeur, designer, fournisseur de données,
administrateur) ; les identifiants sont dans [`docs/comptes-de-test.md`](docs/comptes-de-test.md).
Sans connexion, on navigue en **visiteur**. Le site ne contient que les empreintes PBKDF2 des mots de passe ;
`node scripts/create-test-accounts.mjs` régénère tous les comptes. Un administrateur peut remettre la démo
à zéro depuis Paramètres.

## Version en ligne

Démonstration publiée sur **https://deepdraft.fr/touchdown/** (hébergement alwaysdata, mode démonstration :
les données restent dans le navigateur de chaque visiteur). Pour republier après une modification :

```bash
./scripts/deploy-alwaysdata.sh
```

Le script lance les tests, construit le front pour le sous-dossier `/touchdown/` (`VITE_BASE`) et envoie
les fichiers par SSH avec la clé de déploiement `~/.ssh/alwaysdata_touchline`, autorisée dans
l'administration alwaysdata (Accès distant → SSH/SFTP → Clés SSH). Seuls les fichiers de Touchline sont remplacés.

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

1. Créer `backend/` en Symfony (`symfony new backend --webapp`) : entités Doctrine reprenant
   `database/schema.sql`, voters reprenant `frontend/src/auth/permissions.js`, contrôleurs de `docs/api.md`,
   back-office (EasyAdmin), proxy des API à clé.
2. Lancer le front avec `VITE_API_URL` pour qu'il utilise l'API Symfony au lieu de l'API simulée.
3. Publier les images sur un hub (`docker compose build && docker compose push`).
