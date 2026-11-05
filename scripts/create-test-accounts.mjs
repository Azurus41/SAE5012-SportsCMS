// Génère les comptes de test (un par rôle) :
//  - frontend/src/api/accounts.js : e-mails + empreintes PBKDF2 (aucun mot de passe en clair dans le site) ;
//  - docs/comptes-de-test.md      : identifiants en clair pour les tests.
// Relancer ce script change TOUS les mots de passe.  Usage : node scripts/create-test-accounts.mjs
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const ITERATIONS = 120000;

const ACCOUNTS = [
  { id: 'u-admin', email: 'admin@touchline.test', role: 'admin', name: 'Camille Admin', note: 'Tout : modération, bannissement, thèmes, données' },
  { id: 'u-leo', email: 'editeur@touchline.test', role: 'editor', name: 'Leo Martin', note: 'Crée et modifie tous les articles' },
  { id: 'u-alex', email: 'auteur@touchline.test', role: 'author', name: 'Alex Morgan', note: 'Ne modifie que ses articles (dont un brouillon)' },
  { id: 'u-sam', email: 'auteur2@touchline.test', role: 'author', name: 'Sam Okafor', note: 'Second auteur, pour tester les droits croisés' },
  { id: 'u-priya', email: 'auteur3@touchline.test', role: 'author', name: 'Priya Shah', note: 'Troisième auteur' },
  { id: 'u-nora', email: 'designer@touchline.test', role: 'designer', name: 'Nora Design', note: 'Thème du site, des pages et des articles' },
  { id: 'u-dan', email: 'fournisseur@touchline.test', role: 'provider', name: 'Dan Data', note: 'Dépose et type les jeux de données' },
  { id: 'u-jamie', email: 'abonne@touchline.test', role: 'subscriber', name: 'Jamie Chen', note: 'Note les blocs, commente, signale' },
];

const ROLE_LABELS = {
  admin: 'Administrateur', editor: 'Éditeur', author: 'Auteur', designer: 'Designer',
  provider: 'Fournisseur de données', subscriber: 'Abonné',
};

// Mot de passe lisible et robuste : 3 groupes de 4 caractères sans caractères ambigus.
function password() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () => Array.from({ length: 4 }, () => chars[randomInt(chars.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

const rows = ACCOUNTS.map((a) => {
  const pwd = password();
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pwd, salt, ITERATIONS, 32, 'sha256');
  return { ...a, pwd, salt: salt.toString('base64'), hash: hash.toString('base64') };
});

const root = new URL('../', import.meta.url);

writeFileSync(
  new URL('frontend/src/api/accounts.js', root),
  `// Généré par scripts/create-test-accounts.mjs — ne pas modifier à la main.
// Empreintes PBKDF2-SHA256 (${ITERATIONS} itérations) : les mots de passe ne sont pas dans le site.
export const PBKDF2_ITERATIONS = ${ITERATIONS};

export const ACCOUNTS = ${JSON.stringify(
    Object.fromEntries(rows.map((r) => [r.id, { email: r.email, salt: r.salt, hash: r.hash }])),
    null,
    2,
  )};
`,
);

const date = new Date().toISOString().slice(0, 10);
writeFileSync(
  new URL('docs/comptes-de-test.md', root),
  `# Comptes de test

Un compte par rôle du sujet, pour tester le CMS (page **Connexion** : \`/connexion\`).
Générés le ${date} par \`node scripts/create-test-accounts.mjs\` (relancer le script change tous les mots de passe).

> Ce sont des comptes **de test** : ne les réutilisez nulle part ailleurs. Tant que le back Symfony n'est pas
> branché, la vérification se fait dans le navigateur (empreinte PBKDF2 dans \`frontend/src/api/accounts.js\`) :
> elle sert la démonstration, pas la sécurité. Pour le back, créer ces comptes en fixtures avec le
> \`UserPasswordHasher\` de Symfony et changer les mots de passe avant toute mise en production réelle.

Le rôle **visiteur** n'a pas de compte : c'est l'état « non connecté ».

| Rôle | Nom | E-mail | Mot de passe | Pour tester |
|---|---|---|---|---|
${rows.map((r) => `| ${ROLE_LABELS[r.role]} | ${r.name} | \`${r.email}\` | \`${r.pwd}\` | ${r.note} |`).join('\n')}

Un compte banni par l'administrateur ne peut plus se connecter.
`,
);

console.log(`${rows.length} comptes générés : frontend/src/api/accounts.js et docs/comptes-de-test.md`);
