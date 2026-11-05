// Client de l'API Symfony (contrat décrit dans docs/api.md).
// Utilisé quand VITE_API_URL est définie ; la session repose sur un cookie (credentials: 'include').

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function call(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: isForm ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || data?.detail || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const enc = encodeURIComponent;

const httpApi = {
  mode: 'http',
  session: {
    current: () => call('GET', '/me').catch(() => null),
    login: (userId) => call('POST', '/login', { userId }),
  },
  users: {
    list: () => call('GET', '/users'),
    setBanned: (id, banned) => call('PATCH', `/users/${enc(id)}`, { banned }),
  },
  articles: {
    list: () => call('GET', '/articles'),
    get: (idOrSlug) => call('GET', `/articles/${enc(idOrSlug)}`),
    save: (article) =>
      article.id ? call('PUT', `/articles/${enc(article.id)}`, article) : call('POST', '/articles', article),
    remove: (id) => call('DELETE', `/articles/${enc(id)}`),
    restore: (id) => call('POST', `/articles/${enc(id)}/restore`),
    report: (id, reason) => call('POST', `/articles/${enc(id)}/reports`, { reason }),
    clearReports: (id) => call('DELETE', `/articles/${enc(id)}/reports`),
  },
  datasets: {
    list: () => call('GET', '/datasets'),
    save: (ds) => (ds.id ? call('PUT', `/datasets/${enc(ds.id)}`, ds) : call('POST', '/datasets', ds)),
    remove: (id) => call('DELETE', `/datasets/${enc(id)}`),
  },
  files: {
    upload: (file) => {
      const form = new FormData();
      form.append('file', file);
      return call('POST', '/files', form);
    },
  },
  media: {
    list: () => call('GET', '/media'),
    add: (media) => call('POST', '/media', media),
  },
  ratings: {
    list: (articleId) => call('GET', `/articles/${enc(articleId)}/ratings`),
    summary: () => call('GET', '/ratings/summary'),
    rate: (articleId, blockId, value) => call('PUT', `/articles/${enc(articleId)}/blocks/${enc(blockId)}/rating`, { value }),
  },
  comments: {
    list: (articleId) => call('GET', `/articles/${enc(articleId)}/comments`),
    add: (articleId, text) => call('POST', `/articles/${enc(articleId)}/comments`, { text }),
    remove: (id) => call('DELETE', `/comments/${enc(id)}`),
  },
  themes: {
    list: () => call('GET', '/themes'),
    save: (theme) => call('PUT', '/themes', theme),
  },
  reset: async () => {
    throw new Error('La réinitialisation n’existe qu’en mode démonstration.');
  },
};

export default httpApi;
