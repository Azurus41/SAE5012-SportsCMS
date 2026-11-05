// Règles de compatibilité entre type de visualisation et type de variables (cf. sujet :
// un camembert = 1 variable catégorielle + 1 numérique, un nuage de points = 2 numériques…).

export const AGGREGATES = {
  sum: 'Somme',
  mean: 'Moyenne',
  count: 'Effectif',
  last: 'Dernière valeur',
  max: 'Maximum',
  min: 'Minimum',
  median: 'Médiane',
  std: 'Écart-type',
};

export const CHART_TYPES = {
  bar: {
    label: 'Diagramme en barres',
    fields: [
      { key: 'x', label: 'Catégories (axe X)', kinds: ['categorical'], required: true },
      { key: 'y', label: 'Valeur (axe Y)', kinds: ['numeric'], required: false, hint: 'Vide = effectif par catégorie' },
    ],
    aggregate: true,
  },
  pie: {
    label: 'Camembert / anneau',
    fields: [
      { key: 'x', label: 'Légende (catégorielle)', kinds: ['categorical'], required: true },
      { key: 'y', label: 'Valeur (numérique)', kinds: ['numeric'], required: false, hint: 'Vide = effectif par catégorie' },
    ],
    aggregate: true,
  },
  line: {
    label: 'Courbe',
    fields: [
      { key: 'x', label: 'Axe X (ordre des points)', kinds: ['categorical', 'numeric'], required: true },
      { key: 'series', label: 'Séries (numériques)', kinds: ['numeric'], required: true, multiple: true },
    ],
    aggregate: false,
  },
  scatter: {
    label: 'Nuage de points',
    fields: [
      { key: 'x', label: 'Axe X (numérique)', kinds: ['numeric'], required: true },
      { key: 'y', label: 'Axe Y (numérique)', kinds: ['numeric'], required: true },
      { key: 'color', label: 'Couleur (catégorielle)', kinds: ['categorical'], required: false },
    ],
    aggregate: false,
  },
  histogram: {
    label: 'Histogramme',
    fields: [{ key: 'x', label: 'Variable (numérique)', kinds: ['numeric'], required: true }],
    aggregate: false,
  },
  kpi: {
    label: 'Chiffres clés',
    fields: [{ key: 'series', label: 'Variables (numériques)', kinds: ['numeric'], required: true, multiple: true }],
    aggregate: true,
  },
  ranking: {
    label: 'Classement',
    fields: [
      { key: 'x', label: 'Nom (catégorielle)', kinds: ['categorical'], required: true },
      { key: 'y', label: 'Classer selon (numérique)', kinds: ['numeric'], required: true },
      { key: 'series', label: 'Colonnes affichées en plus', kinds: ['numeric'], required: false, multiple: true },
    ],
    aggregate: true,
  },
  versus: {
    label: 'Face-à-face',
    fields: [
      { key: 'x', label: 'Joueurs / équipes (catégorielle)', kinds: ['categorical'], required: true },
      { key: 'series', label: 'Statistiques comparées (numériques)', kinds: ['numeric'], required: true, multiple: true },
    ],
    aggregate: true,
  },
  heatmap: {
    label: 'Heatmap sur terrain',
    fields: [
      { key: 'x', label: 'Position en longueur 0–100 (numérique)', kinds: ['numeric'], required: true },
      { key: 'y', label: 'Position en largeur 0–100 (numérique)', kinds: ['numeric'], required: true },
      { key: 'value', label: 'Poids (numérique)', kinds: ['numeric'], required: false, hint: 'Vide = 1 par ligne' },
      { key: 'color', label: 'Choix proposé au lecteur (catégorielle)', kinds: ['categorical'], required: false, hint: 'ex. le joueur' },
    ],
    aggregate: false,
  },
};

export const KIND_LABELS = { categorical: 'catégorielle', numeric: 'numérique' };

// Renvoie la liste des problèmes d'une visualisation ; liste vide = visualisation valide.
export function validateChart(spec, variables) {
  const errors = [];
  const type = CHART_TYPES[spec?.chartType];
  if (!spec?.datasetId) errors.push('Choisissez un jeu de données.');
  if (!type) {
    errors.push('Choisissez un type de visualisation.');
    return errors;
  }
  if (!variables || variables.length === 0) return errors;
  const byName = Object.fromEntries(variables.map((v) => [v.name, v]));
  for (const field of type.fields) {
    const value = spec[field.key];
    const names = field.multiple ? (Array.isArray(value) ? value : []) : value ? [value] : [];
    if (field.required && names.length === 0) {
      errors.push(`« ${field.label} » est obligatoire pour un ${type.label.toLowerCase()}.`);
      continue;
    }
    for (const name of names) {
      const variable = byName[name];
      if (!variable) {
        errors.push(`La variable « ${name} » n'existe pas dans ce jeu de données.`);
      } else if (!field.kinds.includes(variable.kind)) {
        errors.push(
          `« ${name} » est ${KIND_LABELS[variable.kind]} : ${type.label.toLowerCase()} attend une variable ` +
            `${field.kinds.map((k) => KIND_LABELS[k]).join(' ou ')} pour « ${field.label} ».`,
        );
      }
    }
  }
  if (type.aggregate && spec.aggregate && !AGGREGATES[spec.aggregate]) {
    errors.push('Agrégation inconnue.');
  }
  return errors;
}

// Types de graphiques réalisables avec les variables d'un jeu de données (pour griser les autres).
export function availableChartTypes(variables) {
  const kinds = new Set((variables || []).map((v) => v.kind));
  const numericCount = (variables || []).filter((v) => v.kind === 'numeric').length;
  return Object.entries(CHART_TYPES)
    .filter(([key]) => {
      if (key === 'bar' || key === 'pie') return kinds.has('categorical');
      if (key === 'ranking' || key === 'versus') return kinds.has('categorical') && numericCount >= 1;
      if (key === 'scatter' || key === 'heatmap') return numericCount >= 2;
      return numericCount >= 1;
    })
    .map(([key]) => key);
}
