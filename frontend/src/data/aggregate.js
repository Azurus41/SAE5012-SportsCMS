import { mean, sum, max, min, bin, extent, median, deviation } from 'd3-array';

const REDUCERS = {
  sum: (vals) => sum(vals),
  mean: (vals) => mean(vals),
  count: (vals) => vals.length,
  last: (vals) => vals[vals.length - 1],
  max: (vals) => max(vals),
  min: (vals) => min(vals),
  median: (vals) => median(vals),
  // Écart-type d'échantillon (n − 1) ; 0 s'il n'y a qu'une valeur.
  std: (vals) => deviation(vals) ?? 0,
};

// Densité sur une grille (heatmap) : x et y sont des positions de 0 à 100 sur le terrain.
export function densityGrid(rows, x, y, value, cols = 12, lines = 8) {
  const grid = Array.from({ length: lines }, () => new Array(cols).fill(0));
  let total = 0;
  for (const r of rows) {
    const px = r[x];
    const py = r[y];
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    const w = value ? (Number.isFinite(r[value]) ? r[value] : 0) : 1;
    const ci = Math.min(cols - 1, Math.max(0, Math.floor((px / 100) * cols)));
    const li = Math.min(lines - 1, Math.max(0, Math.floor((py / 100) * lines)));
    grid[li][ci] += w;
    total += w;
  }
  return { grid, total, max: max(grid.flat()) || 0 };
}

export function reduce(values, aggregate = 'sum') {
  const clean = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (aggregate === 'count') return values.length;
  if (clean.length === 0) return 0;
  return (REDUCERS[aggregate] || REDUCERS.sum)(clean);
}

// Regroupe les lignes par catégorie et calcule une valeur par groupe (ordre d'apparition conservé).
export function groupBy(rows, x, y, aggregate = 'sum') {
  const groups = new Map();
  for (const row of rows) {
    const key = row[x] === '' || row[x] === undefined ? '(vide)' : String(row[x]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(y ? row[y] : 1);
  }
  const agg = y ? aggregate : 'count';
  return [...groups.entries()].map(([label, vals]) => ({ label, value: reduce(vals, agg) }));
}

export function histogram(rows, x, bins = 12) {
  const values = rows.map((r) => r[x]).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  const [lo, hi] = extent(values);
  if (lo === undefined) return [];
  return bin()
    .domain([lo, hi])
    .thresholds(bins)(values)
    .map((b) => ({ x0: b.x0, x1: b.x1, count: b.length }));
}

export function formatNumber(n, digits = 1) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '–';
  const abs = Math.abs(n);
  const d = Number.isInteger(n) ? 0 : abs >= 100 ? 0 : digits;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}
