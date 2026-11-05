// Les données ne sont pas stockées dans le CMS : on ne conserve que leur lien (fichier CSV/JSON
// ou service d'open data), et le contenu est téléchargé au moment d'afficher la visualisation.
import { parseCsv, typedRows } from './csv.js';
import { parseJson } from './json.js';

const cache = new Map();

// Les fichiers de démonstration (« /datasets/… ») sont relatifs à la racine de l'application,
// qui peut être un sous-dossier (ex. deepdraft.fr/touchdown/).
export function resolveUrl(url) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/$/, '');
  return base && !url.startsWith(`${base}/`) ? `${base}${url}` : url;
}

// Les API qui exigent une clé passent par le proxy Symfony (/api/proxy?source=…) : la clé reste côté serveur.
export function sourceUrl(dataset) {
  const base = import.meta.env?.VITE_API_URL;
  if (dataset.sourceType === 'api' && dataset.proxy && base) {
    return `${base.replace(/\/$/, '')}/api/proxy/${encodeURIComponent(dataset.id)}`;
  }
  return dataset.url;
}

export async function fetchSource({ url, sourceType, jsonPath, delimiter }) {
  const res = await fetch(resolveUrl(url), { headers: sourceType === 'csv' ? {} : { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Impossible de charger les données (${res.status}).`);
  if (sourceType === 'json' || sourceType === 'api') {
    const json = await res.json();
    return { parsed: parseJson(json, jsonPath), raw: json };
  }
  const text = await res.text();
  return { parsed: parseCsv(text, { delimiter }), raw: null };
}

export function loadDataset(dataset) {
  if (!dataset?.url) return Promise.reject(new Error('Jeu de données sans lien.'));
  const key = `${dataset.url}|${dataset.jsonPath || ''}|${dataset.variables.map((v) => v.name + v.kind).join(',')}`;
  if (!cache.has(key)) {
    const promise = fetchSource({ ...dataset, url: sourceUrl(dataset), sourceType: dataset.sourceType || 'csv' }).then(({ parsed }) => ({
      ...parsed,
      typed: typedRows(parsed, dataset.variables),
    }));
    promise.catch(() => cache.delete(key));
    cache.set(key, promise);
  }
  return cache.get(key);
}
