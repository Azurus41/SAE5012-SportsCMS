// API simulée : même interface que httpApi.js, données conservées dans le localStorage du navigateur.
// Elle applique les mêmes contrôles de droits que l'API Symfony devra appliquer (réponse 403 simulée).
import { createSeed } from './seed.js';
import { ACCOUNTS } from './accounts.js';
import can from '../auth/permissions.js';
import { verifyPassword } from '../auth/password.js';

// v2 : comptes avec e-mail et mot de passe (les anciennes données de démonstration sont ignorées).
const KEY = 'touchline-db-v2';
const SESSION_KEY = 'touchline-session-v2';

// Ce que l'API renvoie sur un utilisateur : jamais l'empreinte du mot de passe.
const publicUser = (u) => (u ? { id: u.id, name: u.name, role: u.role, banned: !!u.banned } : null);
const sessionUser = (u) => (u ? { ...publicUser(u), email: u.email } : null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* stockage indisponible : on repart des données de démonstration */
  }
  return createSeed();
}

let db = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota dépassé ou navigation privée : les données restent en mémoire */
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const delay = (value) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), 60));
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function currentUser() {
  let id = null;
  try {
    id = localStorage.getItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  return db.users.find((u) => u.id === id) || null;
}

function guard(allowed, message = 'Action non autorisée pour votre rôle.') {
  if (!allowed) throw new ApiError(403, message);
}

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const mockApi = {
  mode: 'mock',

  session: {
    async current() {
      return delay(sessionUser(currentUser()));
    },
    async login(email, password) {
      const user = db.users.find((u) => u.email?.toLowerCase() === String(email).trim().toLowerCase());
      const account = user && ACCOUNTS[user.id];
      const ok = account ? await verifyPassword(String(password), account.salt, account.hash) : false;
      if (!ok) throw new ApiError(401, 'E-mail ou mot de passe incorrect.');
      if (user.banned) throw new ApiError(403, 'Ce compte a été suspendu par la modération.');
      try {
        localStorage.setItem(SESSION_KEY, user.id);
      } catch {
        /* ignore */
      }
      return delay(sessionUser(user));
    },
    async logout() {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      return delay(null);
    },
  },

  users: {
    async list() {
      return delay(db.users.map(publicUser));
    },
    async setBanned(id, banned) {
      guard(can.banAuthor(currentUser()));
      const user = db.users.find((u) => u.id === id);
      if (!user) throw new ApiError(404, 'Utilisateur introuvable.');
      user.banned = banned;
      persist();
      return delay(publicUser(user));
    },
  },

  articles: {
    async list() {
      return delay(db.articles);
    },
    async get(idOrSlug) {
      const a = db.articles.find((x) => x.id === idOrSlug || x.slug === idOrSlug);
      if (!a) throw new ApiError(404, 'Article introuvable.');
      return delay(a);
    },
    async save(input) {
      const user = currentUser();
      const existing = input.id ? db.articles.find((a) => a.id === input.id) : null;
      if (existing) guard(can.editArticle(user, existing), 'Vous ne pouvez modifier que vos propres articles.');
      else guard(can.createArticle(user));
      if (input.status === 'published' && input.type === 'dashboard') {
        const hasChart = (input.blocks || []).some((b) => b.type === 'chart');
        if (!hasChart) throw new ApiError(422, 'Un article de type narration doit contenir au moins une visualisation.');
      }
      if (!input.title?.trim()) throw new ApiError(422, 'Le titre est obligatoire.');
      let slug = slugify(input.slug || input.title) || uid('article');
      if (db.articles.some((a) => a.slug === slug && a.id !== input.id)) slug = `${slug}-${Date.now() % 10000}`;
      const now = new Date().toISOString();
      const article = {
        reports: [],
        themeOverride: null,
        bannerMediaId: null,
        ...existing,
        ...input,
        slug,
        id: existing?.id || uid('a'),
        authorId: existing?.authorId || input.authorId || user.id,
        updatedAt: now,
        publishedAt:
          input.status === 'published' ? existing?.publishedAt || input.publishedAt || now : existing?.publishedAt || null,
      };
      if (existing) Object.assign(existing, article);
      else db.articles.unshift(article);
      persist();
      return delay(article);
    },
    async remove(id) {
      const a = db.articles.find((x) => x.id === id);
      guard(can.deleteArticle(currentUser(), a));
      a.previousStatus = a.status;
      a.status = 'deleted';
      persist();
      return delay(a);
    },
    async restore(id) {
      guard(can.moderate(currentUser()));
      const a = db.articles.find((x) => x.id === id);
      a.status = a.previousStatus && a.previousStatus !== 'deleted' ? a.previousStatus : 'published';
      persist();
      return delay(a);
    },
    async report(id, reason) {
      const user = currentUser();
      guard(can.report(user));
      const a = db.articles.find((x) => x.id === id);
      if (!a.reports.some((r) => r.userId === user.id)) {
        a.reports.push({ userId: user.id, reason, createdAt: new Date().toISOString() });
      }
      persist();
      return delay(a);
    },
    async clearReports(id) {
      guard(can.moderate(currentUser()));
      const a = db.articles.find((x) => x.id === id);
      a.reports = [];
      persist();
      return delay(a);
    },
  },

  datasets: {
    async list() {
      return delay(db.datasets);
    },
    async save(input) {
      const user = currentUser();
      guard(can.manageDatasets(user));
      if (!input.url) throw new ApiError(422, 'Le lien vers les données est obligatoire.');
      if (!input.variables?.length) throw new ApiError(422, 'Aucune variable identifiée.');
      const existing = input.id ? db.datasets.find((d) => d.id === input.id) : null;
      const ds = {
        ...existing,
        ...input,
        id: existing?.id || uid('ds'),
        providerId: existing?.providerId || user.id,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      if (existing) Object.assign(existing, ds);
      else db.datasets.unshift(ds);
      persist();
      return delay(ds);
    },
    async remove(id) {
      guard(can.manageDatasets(currentUser()));
      const used = db.articles.some((a) => a.status !== 'deleted' && a.blocks.some((b) => b.datasetId === id));
      if (used) throw new ApiError(409, 'Ce jeu de données est utilisé par un article.');
      db.datasets = db.datasets.filter((d) => d.id !== id);
      persist();
      return delay(true);
    },
  },

  // Simule le dépôt d'un fichier sur le serveur : renvoie le lien à enregistrer avec le jeu de données.
  files: {
    async upload(file) {
      guard(can.manageDatasets(currentUser()) || can.createArticle(currentUser()));
      const text = await file.text();
      const url = `data:text/csv;charset=utf-8,${encodeURIComponent(text)}`;
      return delay({ url, name: file.name, size: file.size });
    },
  },

  media: {
    async list() {
      return delay(db.media);
    },
    async add({ name, dataUrl, alt, width, height }) {
      guard(can.createArticle(currentUser()) || can.editTheme(currentUser()));
      const media = {
        id: uid('m'),
        name,
        url: dataUrl,
        alt: alt || '',
        width,
        height,
        uploaderId: currentUser().id,
        createdAt: new Date().toISOString(),
      };
      db.media.unshift(media);
      persist();
      return delay(media);
    },
  },

  ratings: {
    async list(articleId) {
      return delay(db.ratings.filter((r) => r.articleId === articleId));
    },
    // Moyenne des notes de blocs par article (tri « Mieux notés »).
    async summary() {
      const by = new Map();
      for (const r of db.ratings) {
        const s = by.get(r.articleId) || { articleId: r.articleId, total: 0, count: 0 };
        s.total += r.value;
        s.count += 1;
        by.set(r.articleId, s);
      }
      return delay([...by.values()].map((s) => ({ articleId: s.articleId, count: s.count, average: s.total / s.count })));
    },
    async rate(articleId, blockId, value) {
      const user = currentUser();
      guard(can.rate(user), 'Abonnez-vous pour noter les blocs.');
      if (!Number.isInteger(value) || value < 0 || value > 5) throw new ApiError(422, 'Note entre 0 et 5.');
      const existing = db.ratings.find((r) => r.blockId === blockId && r.userId === user.id);
      if (existing) existing.value = value;
      else db.ratings.push({ articleId, blockId, userId: user.id, value });
      persist();
      return delay(db.ratings.filter((r) => r.articleId === articleId));
    },
  },

  comments: {
    async list(articleId) {
      return delay(db.comments.filter((c) => c.articleId === articleId));
    },
    async add(articleId, text) {
      const user = currentUser();
      guard(can.comment(user), 'Connectez-vous en tant qu’abonné pour commenter.');
      if (!text.trim()) throw new ApiError(422, 'Le commentaire est vide.');
      const c = { id: uid('c'), articleId, userId: user.id, text: text.trim(), createdAt: new Date().toISOString() };
      db.comments.push(c);
      persist();
      return delay(c);
    },
    async remove(id) {
      const c = db.comments.find((x) => x.id === id);
      guard(can.deleteComment(currentUser(), c));
      db.comments = db.comments.filter((x) => x.id !== id);
      persist();
      return delay(true);
    },
  },

  themes: {
    async list() {
      return delay(db.themes);
    },
    async save({ scope, target, values }) {
      guard(can.editTheme(currentUser()));
      const id = scope === 'site' ? 'site' : `${scope}:${target}`;
      const existing = db.themes.find((t) => t.id === id);
      const theme = { id, scope, target: scope === 'site' ? null : target, values, updatedBy: currentUser().id };
      if (existing) Object.assign(existing, theme);
      else db.themes.push(theme);
      persist();
      return delay(theme);
    },
  },

  // Réinitialise les données de démonstration (utile en soutenance).
  async reset() {
    db = createSeed();
    persist();
    return delay(true);
  },
};

export default mockApi;
