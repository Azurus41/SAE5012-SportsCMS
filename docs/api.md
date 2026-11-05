# Contrat de l'API REST (back Symfony)

Le front React appelle ces routes quand `VITE_API_URL` est définie (voir `frontend/src/api/httpApi.js`).
Sans cette variable, il utilise l'API simulée `frontend/src/api/mockApi.js`, qui a **la même interface**
et applique **les mêmes droits** : elle sert de spécification exécutable pour le back.

- Préfixe : `/api`. Corps et réponses en JSON (`Content-Type: application/json`).
- Session par cookie (`credentials: 'include'`) ; CORS limité à l'origine du front.
- Erreurs : `{ "message": "…" }` avec 401 (non connecté), 403 (rôle insuffisant), 404, 409 (conflit), 422 (validation).
- Les droits sont vérifiés côté serveur (voters Symfony) selon `frontend/src/auth/permissions.js`.

## Droits par rôle

| Action | Visiteur | Abonné | Auteur | Éditeur | Designer | Fournisseur | Admin |
|---|---|---|---|---|---|---|---|
| Lire les articles publiés | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Noter un bloc (0 à 5), commenter, signaler | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Créer un article | | | ✓ | ✓ | | | ✓ |
| Modifier / supprimer un article | | | les siens | tous | | | tous |
| Modifier le thème (site, page, article) | | | | | ✓ | | ✓ |
| Déposer et typer des jeux de données | | | | | | ✓ | ✓ |
| Modérer (restaurer, bannir, signalements) | | | | | | | ✓ |

Chaque auteur peut aussi régler l'**apparence de ses propres articles** (`themeOverride`).

## Session

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/me` | tous | Utilisateur connecté `{ id, name, role, banned, email }` ou `null` |
| POST | `/login` | — | `{ email, password }` → utilisateur ; 401 si identifiants faux, 403 si compte banni |
| POST | `/logout` | connecté | Ferme la session |

Les comptes de test de `docs/comptes-de-test.md` sont à recréer en fixtures Doctrine (mot de passe haché
par le `UserPasswordHasher` de Symfony). L'API ne renvoie jamais l'empreinte d'un mot de passe, et
`GET /users` ne renvoie pas les e-mails.

## Utilisateurs

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/users` | tous | `[{ id, name, role, banned }]` (pas d'e-mail en public) |
| PATCH | `/users/{id}` | admin | `{ banned: true|false }` |

## Articles

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/articles` | tous | Liste. Visiteurs : publiés d'auteurs non bannis. Auteurs : + leurs brouillons. Admin : tout |
| GET | `/articles/{id ou slug}` | tous | Article complet avec ses blocs |
| POST | `/articles` | auteur, éditeur, admin | Crée un article (auteur = utilisateur connecté) |
| PUT | `/articles/{id}` | propriétaire, éditeur, admin | Remplace l'article et ses blocs |
| DELETE | `/articles/{id}` | propriétaire, éditeur, admin | Suppression logique (`status = deleted`) |
| POST | `/articles/{id}/restore` | admin | Restaure le statut précédent |
| POST | `/articles/{id}/reports` | connecté | `{ reason }` — un signalement par utilisateur |
| DELETE | `/articles/{id}/reports` | admin | Classe les signalements |

Règles de validation : titre obligatoire ; un article `dashboard` publié contient au moins un bloc `chart` ;
chaque visualisation respecte les types de variables (`frontend/src/data/chartRules.js`) ; slug unique.

```json
{
  "id": "a-pressing",
  "slug": "le-pressing-haut-change-le-jeu",
  "title": "Le pressing haut change le jeu",
  "summary": "Ce que six semaines de données…",
  "type": "dashboard",
  "status": "published",
  "sport": "football",
  "topic": "tactique",
  "authorId": "u-alex",
  "bannerMediaId": null,
  "themeOverride": { "font": "serif", "accent": "#1f9d6b" },
  "publishedAt": "2026-10-06T08:00:00Z",
  "reports": [],
  "blocks": [
    { "id": "b-1", "type": "heading", "level": 2, "text": "Le déplacement vers l’avant" },
    { "id": "b-2", "type": "text", "text": "Pendant des années, **la possession**…" },
    { "id": "b-3", "type": "image", "mediaId": "m-1", "alt": "…", "caption": "…" },
    { "id": "b-4", "type": "quote", "text": "…", "cite": "Alex Morgan" },
    {
      "id": "b-5", "type": "chart",
      "datasetId": "ds-pressing", "chartType": "line",
      "x": "Semaine", "series": ["Récupérations hautes"],
      "title": "Récupérer le ballon plus haut", "subtitle": "…", "caption": "Fig. 1 — …",
      "colors": { "Récupérations hautes": "#2458e8" },
      "filter": null, "width": "half"
    }
  ]
}
```

Champs d'une visualisation selon `chartType` :

| Type | Champs |
|---|---|
| `bar`, `pie` | `x` (catégorielle), `y` (numérique, facultatif = effectif), `aggregate` |
| `line` | `x`, `series[]` (numériques) |
| `scatter` | `x`, `y` (numériques), `color` (catégorielle, facultatif) |
| `histogram` | `x` (numérique), `bins` |
| `kpi` | `series[]` (numériques), `aggregate` (`last`, `mean`, `std`…) |
| `ranking` | `x` (catégorielle), `y` (numérique), `series[]`, `aggregate`, `limit` |
| `versus` | `x` (catégorielle), `series[]`, `left`, `right`, `aggregate` |
| `heatmap` | `x`, `y` (positions 0–100), `value` (poids), `color` (choix du lecteur), `grid` |

`aggregate` ∈ `sum, mean, count, last, max, min, median, std`. Option commune : `filter: { column, value }`.

## Notes et commentaires

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/articles/{id}/ratings` | tous | `[{ blockId, userId, value }]` |
| PUT | `/articles/{id}/blocks/{blockId}/rating` | connecté non banni | `{ value: 0..5 }` (remplace la note précédente) |
| GET | `/ratings/summary` | tous | `[{ articleId, average, count }]` (tri « mieux notés ») |
| GET | `/articles/{id}/comments` | tous | Commentaires |
| POST | `/articles/{id}/comments` | connecté non banni | `{ text }` |
| DELETE | `/comments/{id}` | auteur du commentaire, admin | |

## Jeux de données

Le CMS ne stocke **que le lien** vers les données et le **type de chaque variable** ; le contenu est
téléchargé par le navigateur au moment d'afficher la visualisation.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/datasets` | tous | Liste avec variables |
| POST | `/datasets` | fournisseur, admin | Crée |
| PUT | `/datasets/{id}` | fournisseur, admin | Modifie (types des variables…) |
| DELETE | `/datasets/{id}` | fournisseur, admin | 409 si utilisé par un article |
| POST | `/files` | fournisseur, auteur, admin | Dépôt d'un CSV (multipart `file`) → `{ url, name, size }` |
| GET | `/proxy/{datasetId}` | tous | Relais vers une API open data qui exige une clé |

```json
{
  "id": "ds-classement",
  "name": "Classement de la ligue (JSON)",
  "description": "…",
  "sourceType": "json",
  "url": "/datasets/classement_ligue.json",
  "jsonPath": "standings.0.table",
  "proxy": false,
  "rows": 12,
  "variables": [
    { "name": "team.name", "kind": "categorical" },
    { "name": "points", "kind": "numeric" }
  ]
}
```

### Proxy des API à clé (football-data.org, API-Sports…)

La clé ne doit jamais arriver dans le navigateur. Le jeu de données enregistre `use_proxy = true` et
`api_key_env` (nom d'une variable d'environnement du serveur, ex. `FOOTBALL_DATA_KEY`). La route
`/api/proxy/{id}` lit l'URL en base, ajoute l'en-tête attendu (ex. `X-Auth-Token` pour football-data.org),
met la réponse en cache quelques minutes (quotas des paliers gratuits) et la renvoie telle quelle.
Seules les URL enregistrées en base peuvent être relayées (pas de proxy ouvert).

## Médiathèque et thèmes

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/media` | tous | Médias |
| POST | `/media` | auteur, éditeur, designer, admin | Image (le front la redimensionne avant envoi) |
| GET | `/themes` | tous | `[{ id, scope, target, values }]` |
| PUT | `/themes` | designer, admin | `{ scope: 'site'|'page'|'article', target, values }` |

Paramètres de thème (`values`) : `accent`, `accentSoft`, `pageBg`, `text`, `headerBg`, `headerText`,
`titleColor`, `titleSize`, `headingColor`, `bodySize`, `blockBg`, `blockBorder`, `radius`, `font`
(voir `frontend/src/theme/themeFields.js`).
