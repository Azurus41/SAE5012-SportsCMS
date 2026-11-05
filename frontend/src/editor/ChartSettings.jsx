import { useEffect, useState } from 'react';
import { AGGREGATES, CHART_TYPES, KIND_LABELS, availableChartTypes, validateChart } from '../data/chartRules.js';
import { loadDataset } from '../data/datasetLoader.js';
import { PALETTE } from '../charts/common.jsx';

const DEFAULT_HEX = ['#2458e8', '#e2723b', '#1f9d6b', '#8a4fd8', '#d64545', '#1c8fbf', '#b98a00', '#72777e'];

// Panneau « Bloc » de l'éditeur pour une visualisation : jeu de données, type, variables, couleurs.
// Les variables incompatibles avec le type choisi sont désactivées (ex. pas de variable numérique en légende de camembert).
export default function ChartSettings({ block, datasets, onChange }) {
  const dataset = datasets.find((d) => d.id === block.datasetId);
  const type = CHART_TYPES[block.chartType];
  const allowed = dataset ? availableChartTypes(dataset.variables) : Object.keys(CHART_TYPES);
  const errors = validateChart(block, dataset?.variables);
  const categories = useCategories(block, dataset);

  const set = (patch) => onChange({ ...block, ...patch });

  const changeDataset = (id) => {
    const ds = datasets.find((d) => d.id === id);
    const types = ds ? availableChartTypes(ds.variables) : [];
    const chartType = types.includes(block.chartType) ? block.chartType : types[0];
    onChange({ ...block, datasetId: id, chartType, ...autoFields(chartType, ds), colors: {}, filter: null });
  };

  const changeType = (chartType) => onChange({ ...block, chartType, ...autoFields(chartType, dataset), colors: {} });

  // Clés dont l'auteur choisit la couleur : séries (courbe), catégories (barres, camembert, nuage) ou variable (histogramme).
  let colorKeys = [];
  if (block.chartType === 'line') colorKeys = block.series || [];
  else if (block.chartType === 'histogram') colorKeys = block.x ? [block.x] : [];
  else if (block.chartType === 'versus') colorKeys = ['left', 'right'];
  else if (block.chartType === 'heatmap') colorKeys = ['heat'];
  else if (['bar', 'pie', 'scatter'].includes(block.chartType)) colorKeys = categories;
  const colorLabels = { left: 'Protagoniste de gauche', right: 'Protagoniste de droite', heat: 'Couleur de la chaleur' };

  return (
    <div className="settings-section">
      <label className="field">
        <span>Jeu de données</span>
        <select value={block.datasetId || ''} onChange={(e) => changeDataset(e.target.value)}>
          <option value="">— Choisir —</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Type de visualisation</span>
        <select value={block.chartType || ''} onChange={(e) => changeType(e.target.value)} disabled={!dataset}>
          {Object.entries(CHART_TYPES).map(([key, t]) => (
            <option key={key} value={key} disabled={!allowed.includes(key)}>
              {t.label}
              {!allowed.includes(key) ? ' (variables incompatibles)' : ''}
            </option>
          ))}
        </select>
      </label>

      {dataset &&
        type?.fields.map((field) =>
          field.multiple ? (
            <fieldset className="field" key={field.key}>
              <legend>{field.label}</legend>
              {dataset.variables.map((v) => {
                const ok = field.kinds.includes(v.kind);
                const list = block[field.key] || [];
                return (
                  <label key={v.name} className={`check ${ok ? '' : 'is-disabled'}`}>
                    <input
                      type="checkbox"
                      disabled={!ok}
                      checked={list.includes(v.name)}
                      onChange={() =>
                        set({ [field.key]: list.includes(v.name) ? list.filter((x) => x !== v.name) : [...list, v.name] })
                      }
                    />
                    {v.name} <small className="muted">({KIND_LABELS[v.kind]})</small>
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <label className="field" key={field.key}>
              <span>
                {field.label}
                {field.hint && <small className="muted"> · {field.hint}</small>}
              </span>
              <select value={block[field.key] || ''} onChange={(e) => set({ [field.key]: e.target.value || null, colors: {} })}>
                <option value="">{field.required ? '— Choisir —' : '— Aucune —'}</option>
                {dataset.variables.map((v) => (
                  <option key={v.name} value={v.name} disabled={!field.kinds.includes(v.kind)}>
                    {v.name} ({KIND_LABELS[v.kind]})
                  </option>
                ))}
              </select>
            </label>
          ),
        )}

      {type?.aggregate && (block.y || block.chartType === 'kpi') && (
        <label className="field">
          <span>Agrégation</span>
          <select value={block.aggregate || (block.chartType === 'kpi' ? 'last' : 'sum')} onChange={(e) => set({ aggregate: e.target.value })}>
            {Object.entries(AGGREGATES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}

      {block.chartType === 'versus' && categories.length > 1 && (
        <div className="field-row">
          {['left', 'right'].map((side, i) => (
            <label className="field" key={side}>
              <span>{side === 'left' ? 'À gauche' : 'À droite'}</span>
              <select value={block[side] || categories[i]} onChange={(e) => set({ [side]: e.target.value })}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {block.chartType === 'ranking' && (
        <label className="field">
          <span>Lignes affichées avant « afficher tout »</span>
          <input type="number" min="3" max="50" value={block.limit || 10} onChange={(e) => set({ limit: Number(e.target.value) })} />
        </label>
      )}

      {block.chartType === 'heatmap' && (
        <label className="field">
          <span>Finesse de la grille</span>
          <select value={block.grid || 'normal'} onChange={(e) => set({ grid: e.target.value })}>
            <option value="normal">12 × 8 zones</option>
            <option value="fine">24 × 16 zones</option>
          </select>
        </label>
      )}

      {block.chartType === 'histogram' && (
        <label className="field">
          <span>Nombre de classes initial : {block.bins || 10}</span>
          <input type="range" min="3" max="30" value={block.bins || 10} onChange={(e) => set({ bins: Number(e.target.value) })} />
        </label>
      )}

      {dataset && (
        <div className="field-row">
          <label className="field">
            <span>Filtrer : variable</span>
            <select
              value={block.filter?.column || ''}
              onChange={(e) => set({ filter: e.target.value ? { column: e.target.value, value: '' } : null })}
            >
              <option value="">— Aucun filtre —</option>
              {dataset.variables
                .filter((v) => v.kind === 'categorical')
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
            </select>
          </label>
          {block.filter?.column && (
            <FilterValue block={block} dataset={dataset} onChange={(value) => set({ filter: { ...block.filter, value } })} />
          )}
        </div>
      )}

      <label className="field">
        <span>Titre du graphique</span>
        <input value={block.title || ''} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label className="field">
        <span>Sous-titre</span>
        <input value={block.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} />
      </label>
      <label className="field">
        <span>Légende (source, remarque)</span>
        <input value={block.caption || ''} onChange={(e) => set({ caption: e.target.value })} />
      </label>
      <label className="field">
        <span>Largeur dans l’article</span>
        <select value={block.width || 'full'} onChange={(e) => set({ width: e.target.value === 'full' ? undefined : e.target.value })}>
          <option value="full">Pleine largeur</option>
          <option value="half">Demi-largeur (côte à côte avec le graphique suivant)</option>
        </select>
      </label>

      {colorKeys.length > 0 && (
        <fieldset className="field colors">
          <legend>Couleurs</legend>
          {block.chartType === 'bar' && (
            <ColorInput
              label="Couleur par défaut des barres"
              value={block.colors?.__default}
              fallback={DEFAULT_HEX[0]}
              onChange={(c) => set({ colors: { ...block.colors, __default: c } })}
            />
          )}
          {colorKeys.slice(0, 12).map((key, i) => (
            <ColorInput
              key={key}
              label={colorLabels[key] || key}
              value={block.colors?.[key]}
              fallback={block.chartType === 'bar' ? block.colors?.__default || DEFAULT_HEX[0] : DEFAULT_HEX[i % PALETTE.length]}
              onChange={(c) => set({ colors: { ...block.colors, [key]: c } })}
            />
          ))}
          <button type="button" className="link-button small" onClick={() => set({ colors: {} })}>
            Couleurs par défaut
          </button>
        </fieldset>
      )}

      {errors.length > 0 && (
        <ul className="chart-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ColorInput({ label, value, fallback, onChange }) {
  return (
    <label className="color-input">
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
    </label>
  );
}

function FilterValue({ block, dataset, onChange }) {
  const [values, setValues] = useState([]);
  useEffect(() => {
    let alive = true;
    loadDataset(dataset).then((d) => alive && setValues([...new Set(d.typed.map((r) => String(r[block.filter.column])))].slice(0, 50)));
    return () => {
      alive = false;
    };
  }, [dataset, block.filter?.column]);
  return (
    <label className="field">
      <span>valeur</span>
      <select value={block.filter.value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Toutes —</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

// Catégories affichées (pour choisir leur couleur).
function useCategories(block, dataset) {
  const [cats, setCats] = useState([]);
  const column = block.chartType === 'scatter' ? block.color : ['bar', 'pie', 'versus'].includes(block.chartType) ? block.x : null;
  useEffect(() => {
    if (!dataset || !column) {
      setCats([]);
      return undefined;
    }
    let alive = true;
    loadDataset(dataset).then((d) => {
      if (!alive) return;
      const rows = block.filter?.column && block.filter.value
        ? d.typed.filter((r) => String(r[block.filter.column]) === block.filter.value)
        : d.typed;
      setCats([...new Set(rows.map((r) => String(r[column])))]);
    });
    return () => {
      alive = false;
    };
  }, [dataset, column, block.filter?.column, block.filter?.value]);
  return cats;
}

// Pré-remplit des variables compatibles quand on change de jeu de données ou de type.
export function autoFields(chartType, dataset) {
  if (!dataset || !chartType) return {};
  const cat = dataset.variables.filter((v) => v.kind === 'categorical').map((v) => v.name);
  const num = dataset.variables.filter((v) => v.kind === 'numeric').map((v) => v.name);
  switch (chartType) {
    case 'bar':
    case 'pie':
      return { x: cat[0] || null, y: num[0] || null, aggregate: 'sum', series: undefined, color: undefined };
    case 'line':
      return { x: cat[0] || num[0] || null, series: num.slice(0, 1), y: undefined, color: undefined };
    case 'scatter':
      return { x: num[0] || null, y: num[1] || null, color: cat[0] || null, series: undefined };
    case 'histogram':
      return { x: num[0] || null, bins: 10, y: undefined, series: undefined, color: undefined };
    case 'kpi':
      return { series: num.slice(0, 3), aggregate: 'last', x: undefined, y: undefined, color: undefined };
    case 'ranking':
      return { x: cat[0] || null, y: num[0] || null, series: num.slice(1, 3), aggregate: 'sum', color: undefined };
    case 'versus':
      return { x: cat[0] || null, series: num.slice(0, 4), aggregate: 'mean', y: undefined, color: undefined, left: undefined, right: undefined };
    case 'heatmap':
      return { x: num[0] || null, y: num[1] || null, value: undefined, series: undefined, color: undefined };
    default:
      return {};
  }
}
