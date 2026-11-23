// Exporte les données de démonstration du front pour le back Symfony : backend/fixtures/seed.json.
//  - comptes de test (un par rôle) : e-mails et empreintes PBKDF2 de frontend/src/api/accounts.js,
//    donc les mêmes mots de passe que docs/comptes-de-test.md (aucun mot de passe en clair) ;
//  - jeux de données, articles, commentaires et notes de frontend/src/api/seed.js ;
//  - sports et sujets de frontend/src/constants.js.
// Usage : node scripts/export-seed.mjs   puis, côté serveur : php bin/console app:seed
import { readFileSync, writeFileSync } from 'node:fs';
import { createSeed } from '../frontend/src/api/seed.js';
import { ACCOUNTS, PBKDF2_ITERATIONS } from '../frontend/src/api/accounts.js';

const root = new URL('../', import.meta.url);

// constants.js importe des SVG (illisibles par Node) : on n'en extrait que les deux tables.
const constants = readFileSync(new URL('frontend/src/constants.js', root), 'utf8');
const table = (name) => {
  const match = constants.match(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\});`));
  if (!match) throw new Error(`${name} introuvable dans constants.js`);
  return Function(`return ${match[1]}`)();
};

const seed = createSeed();
const users = seed.users.map((u) => {
  const account = ACCOUNTS[u.id];
  if (!account) throw new Error(`Pas d'empreinte pour ${u.id} dans accounts.js`);
  return { id: u.id, name: u.name, role: u.role, banned: !!u.banned, email: account.email, salt: account.salt, hash: account.hash };
});

const out = {
  generatedBy: 'scripts/export-seed.mjs',
  pbkdf2Iterations: PBKDF2_ITERATIONS,
  sports: table('SPORTS'),
  topics: table('TOPICS'),
  users,
  datasets: seed.datasets,
  articles: seed.articles,
  comments: seed.comments,
  ratings: seed.ratings,
  themes: seed.themes,
};

writeFileSync(new URL('backend/fixtures/seed.json', root), `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `backend/fixtures/seed.json : ${users.length} comptes, ${out.datasets.length} jeux de données, ${out.articles.length} articles`,
);
