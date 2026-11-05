import { useEffect, useMemo, useState } from 'react';
import { loadDataset } from '../data/datasetLoader.js';
import { validateChart } from '../data/chartRules.js';
import { formatNumber } from '../data/aggregate.js';
import { RENDERERS, lineHeadline } from './charts.jsx';

// Affiche une visualisation : télécharge le CSV par son lien, vérifie la cohérence des variables,
// puis dessine le graphique interactif. Un tableau des données est proposé pour l'accessibilité.
export default function ChartBlock({ spec, datasets, framed = true }) {
  const dataset = datasets?.find((d) => d.id === spec.datasetId);
  const [state, setState] = useState({ status: 'loading' });
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!dataset) {
      setState({ status: 'error', message: 'Jeu de données introuvable.' });
      return undefined;
    }
    let alive = true;
    setState({ status: 'loading' });
    loadDataset(dataset).then(
      (data) => alive && setState({ status: 'ready', data }),
      (err) => alive && setState({ status: 'error', message: err.message }),
    );
    return () => {
      alive = false;
    };
  }, [dataset]);

  const rows = useMemo(() => {
    if (state.status !== 'ready') return [];
    const f = spec.filter;
    return f?.column && f.value !== undefined && f.value !== ''
      ? state.data.typed.filter((r) => String(r[f.column]) === String(f.value))
      : state.data.typed;
  }, [state, spec.filter]);

  const errors = dataset ? validateChart(spec, dataset.variables) : [];
  const Renderer = RENDERERS[spec.chartType];
  const headline = lineHeadline(rows, spec);
  const columns = usedColumns(spec);

  let body;
  if (errors.length) {
    body = (
      <ul className="chart-errors" role="alert">
        {errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    );
  } else if (state.status === 'loading') {
    body = <div className="chart-skeleton" aria-busy="true">Chargement des données…</div>;
  } else if (state.status === 'error') {
    body = (
      <p className="chart-errors" role="alert">
        {state.message}
      </p>
    );
  } else {
    body = <Renderer rows={rows} spec={spec} />;
  }

  const isKpi = spec.chartType === 'kpi';
  return (
    <figure className={`chart-block ${framed && !isKpi ? 'is-framed' : ''} ${isKpi ? 'is-kpi' : ''}`}>
      {(spec.title || headline) && (
        <div className="chart-heading">
          <div>
            {spec.title && <p className="chart-title">{spec.title}</p>}
            {spec.subtitle && <p className="chart-subtitle">{spec.subtitle}</p>}
          </div>
          {headline && <p className="chart-headline">{headline}</p>}
        </div>
      )}
      {body}
      {state.status === 'ready' && !errors.length && !isKpi && (
        <div className="chart-footer">
          {spec.caption && <figcaption>{spec.caption}</figcaption>}
          <button type="button" className="link-button" aria-expanded={showTable} onClick={() => setShowTable((s) => !s)}>
            {showTable ? 'Masquer les données' : 'Voir les données'}
          </button>
        </div>
      )}
      {showTable && (
        <div className="data-table-wrap">
          <table className="data-table">
            <caption>
              Source : {dataset.name} · {rows.length} ligne(s)
            </caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c}>{typeof r[c] === 'number' ? formatNumber(r[c], 2) : r[c]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

function usedColumns(spec) {
  const cols = [spec.x, spec.y, spec.color, spec.value, ...(spec.series || [])].filter(Boolean);
  return [...new Set(cols)];
}
