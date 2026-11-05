# Comptes de test

Un compte par rôle du sujet, pour tester le CMS (page **Connexion** : `/connexion`).
Générés le 2026-11-05 par `node scripts/create-test-accounts.mjs` (relancer le script change tous les mots de passe).

> Ce sont des comptes **de test** : ne les réutilisez nulle part ailleurs. Tant que le back Symfony n'est pas
> branché, la vérification se fait dans le navigateur (empreinte PBKDF2 dans `frontend/src/api/accounts.js`) :
> elle sert la démonstration, pas la sécurité. Pour le back, créer ces comptes en fixtures avec le
> `UserPasswordHasher` de Symfony et changer les mots de passe avant toute mise en production réelle.

Le rôle **visiteur** n'a pas de compte : c'est l'état « non connecté ».

| Rôle | Nom | E-mail | Mot de passe | Pour tester |
|---|---|---|---|---|
| Administrateur | Camille Admin | `admin@touchline.test` | `q6Nz-47Tz-FveX` | Tout : modération, bannissement, thèmes, données |
| Éditeur | Leo Martin | `editeur@touchline.test` | `t28r-hACZ-wwsL` | Crée et modifie tous les articles |
| Auteur | Alex Morgan | `auteur@touchline.test` | `gb6q-HwFP-sLNh` | Ne modifie que ses articles (dont un brouillon) |
| Auteur | Sam Okafor | `auteur2@touchline.test` | `aLF9-JcaP-xxrd` | Second auteur, pour tester les droits croisés |
| Auteur | Priya Shah | `auteur3@touchline.test` | `K7rf-Dbkx-eqxv` | Troisième auteur |
| Designer | Nora Design | `designer@touchline.test` | `7vrh-sMD4-tDtN` | Thème du site, des pages et des articles |
| Fournisseur de données | Dan Data | `fournisseur@touchline.test` | `79hV-2ZY6-u6uM` | Dépose et type les jeux de données |
| Abonné | Jamie Chen | `abonne@touchline.test` | `7QYA-9ph9-rj7d` | Note les blocs, commente, signale |

Un compte banni par l'administrateur ne peut plus se connecter.
