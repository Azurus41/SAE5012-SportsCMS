// Paramètres que les designers peuvent modifier en ligne. Chaque paramètre est une variable CSS :
// le thème n'est qu'une surcouche appliquée par-dessus le design responsive de base.

export const THEME_FIELDS = [
  { key: 'accent', cssVar: '--accent', label: 'Couleur principale (liens, boutons, graphiques)', type: 'color', default: '#2458e8' },
  { key: 'accentSoft', cssVar: '--accent-soft', label: 'Fond des étiquettes', type: 'color', default: '#eef3ff' },
  { key: 'pageBg', cssVar: '--page-bg', label: 'Fond de page', type: 'color', default: '#ffffff' },
  { key: 'text', cssVar: '--text', label: 'Couleur du texte', type: 'color', default: '#171a1e' },
  { key: 'headerBg', cssVar: '--header-bg', label: 'Fond de l’en-tête du site', type: 'color', default: '#ffffff' },
  { key: 'headerText', cssVar: '--header-text', label: 'Texte de l’en-tête du site', type: 'color', default: '#171a1e' },
  { key: 'titleColor', cssVar: '--title-color', label: 'Couleur du titre des articles', type: 'color', default: '#171a1e' },
  { key: 'titleSize', cssVar: '--title-size', label: 'Taille du titre des articles (px, écran large)', type: 'number', min: 28, max: 80, unit: 'px', default: 56 },
  { key: 'headingColor', cssVar: '--heading-color', label: 'Couleur des intertitres', type: 'color', default: '#171a1e' },
  { key: 'bodySize', cssVar: '--body-size', label: 'Taille du texte courant (px)', type: 'number', min: 14, max: 22, unit: 'px', default: 16 },
  { key: 'blockBg', cssVar: '--block-bg', label: 'Fond des blocs graphiques', type: 'color', default: '#ffffff' },
  { key: 'blockBorder', cssVar: '--border', label: 'Couleur des bordures', type: 'color', default: '#dee1e5' },
  { key: 'radius', cssVar: '--radius', label: 'Arrondi des boutons et cartes (px)', type: 'number', min: 0, max: 16, unit: 'px', default: 4 },
  {
    key: 'font',
    cssVar: '--font-body',
    label: 'Police',
    type: 'select',
    default: 'sans',
    options: {
      sans: ['Inter (linéale)', "'Inter', system-ui, sans-serif"],
      serif: ['Georgia (à empattements)', "Georgia, 'Times New Roman', serif"],
      condensed: ['Système condensée', "'Arial Narrow', 'Roboto Condensed', system-ui, sans-serif"],
      mono: ['Machine à écrire', "ui-monospace, 'Cascadia Mono', Consolas, monospace"],
    },
  },
];

// Sous-ensemble que chaque auteur peut régler pour ses propres articles (cf. explicitation de la SAÉ).
export const ARTICLE_APPEARANCE_FIELDS = ['font', 'accent', 'titleColor', 'headingColor', 'titleSize', 'bodySize', 'blockBg'];

export const PAGE_SCOPES = {
  home: 'Accueil',
  articles: 'Liste des articles',
  article: 'Pages article',
  auteurs: 'Auteurs',
};

export function themeStyle(values) {
  const style = {};
  if (!values) return style;
  for (const f of THEME_FIELDS) {
    const v = values[f.key];
    if (v === undefined || v === '' || v === null) continue;
    if (f.type === 'select') {
      if (f.options[v]) style[f.cssVar] = f.options[v][1];
    } else {
      style[f.cssVar] = f.type === 'number' ? `${v}${f.unit || ''}` : v;
    }
  }
  return style;
}

export function pageKeyFromPath(pathname) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/articles/')) return 'article';
  if (pathname.startsWith('/articles')) return 'articles';
  if (pathname.startsWith('/auteurs')) return 'auteurs';
  return null;
}
