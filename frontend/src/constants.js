import fieldFootball from './assets/figma/field-football.svg';
import fieldBasketball from './assets/figma/field-basketball.svg';
import fieldTrack from './assets/figma/field-track.svg';

export const SPORTS = {
  football: 'Football',
  basketball: 'Basket-ball',
  athletisme: 'Athlétisme',
  tennis: 'Tennis',
};

export const TOPICS = {
  tactique: 'Tactique & stratégie',
  performance: 'Performance',
  culture: 'Culture & opinion',
};

// Schémas de terrain de la maquette (le tennis reprend le schéma du basket, comme dans Figma).
export const FIELD_BY_SPORT = {
  football: fieldFootball,
  basketball: fieldBasketball,
  athletisme: fieldTrack,
  tennis: fieldBasketball,
};

export const ARTICLE_TYPES = {
  classic: 'Article classique',
  dashboard: 'Narration (dashboard)',
};

export const BLOCK_LABELS = {
  heading: 'Titre',
  text: 'Texte',
  image: 'Image',
  chart: 'Graphique',
  quote: 'Citation',
};

export function readingTime(blocks = []) {
  const words = blocks
    .filter((b) => b.type === 'text' || b.type === 'heading' || b.type === 'quote')
    .reduce((n, b) => n + String(b.text || '').split(/\s+/).filter(Boolean).length, 0);
  const charts = blocks.filter((b) => b.type === 'chart').length;
  return Math.max(1, Math.round(words / 200 + charts * 0.5));
}

export function wordCount(blocks = []) {
  return blocks.reduce((n, b) => n + String(b.text || '').split(/\s+/).filter(Boolean).length, 0);
}

export function formatDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', opts);
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
