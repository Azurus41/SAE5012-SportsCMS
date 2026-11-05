import { useMemo, useState } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line, arc as d3arc, pie as d3pie } from 'd3-shape';
import { extent, max, min } from 'd3-array';
import { groupBy, histogram, reduce, formatNumber, densityGrid } from '../data/aggregate.js';
import { AGGREGATES } from '../data/chartRules.js';
import { Legend, Tooltip, colorFor, pointer, useHidden, useWidth } from './common.jsx';

const fmt = (n) => formatNumber(n);

// ---------- Barres horizontales (lisibles sur mobile, comme la figure 2 de la maquette) ----------
export function BarChart({ rows, spec }) {
  const [sorted, setSorted] = useState(false);
  const [hover, setHover] = useState(null);
  const data = useMemo(() => {
    const d = groupBy(rows, spec.x, spec.y, spec.aggregate || 'sum');
    return sorted ? [...d].sort((a, b) => b.value - a.value) : d;
  }, [rows, spec.x, spec.y, spec.aggregate, sorted]);
  const top = max(data, (d) => Math.abs(d.value)) || 1;
  return (
    <div className="bar-chart">
      <div className="chart-tools">
        <span className="chart-measure">
          {spec.y ? `${AGGREGATES[spec.aggregate || 'sum']} de ${spec.y}` : 'Effectif'} par {spec.x}
        </span>
        <button type="button" className="link-button" onClick={() => setSorted((s) => !s)} aria-pressed={sorted}>
          {sorted ? 'Ordre d’origine' : 'Trier par valeur'}
        </button>
      </div>
      <ul className="bars">
        {data.map((d, i) => {
          // Couleur choisie par l'auteur pour la catégorie, sinon couleur par défaut du graphique, sinon accent du thème.
          const color = spec.colors?.[d.label] || spec.colors?.__default || 'var(--accent)';
          return (
            <li
              key={d.label}
              className={hover && hover !== d.label ? 'is-dim' : ''}
              onMouseEnter={() => setHover(d.label)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="bar-label">
                <span>{d.label}</span>
                <strong>{fmt(d.value)}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(Math.abs(d.value) / top) * 100}%`, background: color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Camembert / anneau ----------
export function PieChart({ rows, spec }) {
  const [hidden, toggle] = useHidden();
  const [active, setActive] = useState(null);
  const all = useMemo(() => groupBy(rows, spec.x, spec.y, spec.aggregate || 'sum'), [rows, spec.x, spec.y, spec.aggregate]);
  const visible = all.filter((d) => !hidden.has(d.label) && d.value > 0);
  const total = visible.reduce((s, d) => s + d.value, 0) || 1;
  const size = 160;
  const radius = size / 2;
  const arcs = d3pie()
    .sort(null)
    .value((d) => d.value)(visible);
  const arcGen = d3arc().innerRadius(radius * 0.62);
  const focus = visible.find((d) => d.label === active) || visible[0];
  const legend = all.map((d, i) => ({
    key: d.label,
    label: d.label,
    color: colorFor(d.label, i, spec.colors),
    extra: hidden.has(d.label) ? '' : `${Math.round((d.value / total) * 100)} %`,
  }));
  const colorOf = (label) => legend.find((l) => l.key === label)?.color;
  return (
    <div className="pie-chart">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Répartition par ${spec.x}`}
      >
        <g transform={`translate(${radius},${radius})`}>
          {arcs.map((a) => {
            const isActive = a.data.label === focus?.label;
            return (
              <path
                key={a.data.label}
                d={arcGen.outerRadius(isActive ? radius : radius - 4)(a)}
                fill={colorOf(a.data.label)}
                stroke="var(--surface)"
                strokeWidth="1.5"
                tabIndex={0}
                aria-label={`${a.data.label} : ${Math.round((a.data.value / total) * 100)} %`}
                onMouseEnter={() => setActive(a.data.label)}
                onFocus={() => setActive(a.data.label)}
              />
            );
          })}
          {focus && (
            <>
              <text className="pie-center" textAnchor="middle" dy="0.1em">
                {Math.round((focus.value / total) * 100)} %
              </text>
              <text className="pie-center-label" textAnchor="middle" dy="1.9em">
                {focus.label.length > 18 ? `${focus.label.slice(0, 17)}…` : focus.label}
              </text>
            </>
          )}
        </g>
      </svg>
      <Legend items={legend} hidden={hidden} onToggle={toggle} />
    </div>
  );
}

// ---------- Courbe(s) ----------
export function LineChart({ rows, spec }) {
  const [box, width] = useWidth();
  const [hidden, toggle] = useHidden();
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tip, setTip] = useState(null);
  const series = (spec.series || []).map((name, i) => ({ name, color: colorFor(name, i, spec.colors) }));
  const shown = series.filter((s) => !hidden.has(s.name));
  const height = 220;
  const m = { top: 14, right: 16, bottom: 28, left: 38 };
  const labels = rows.map((r) => String(r[spec.x]));
  const x = scalePoint().domain(labels).range([m.left, width - m.right]).padding(0.2);
  const values = shown.flatMap((s) => rows.map((r) => r[s.name])).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  const [lo, hi] = values.length ? extent(values) : [0, 1];
  const pad = (hi - lo) * 0.15 || 1;
  const y = scaleLinear()
    .domain([spec.zero ? Math.min(0, lo) : lo - pad, hi + pad])
    .nice()
    .range([height - m.bottom, m.top]);
  const step = labels.length > 12 ? Math.ceil(labels.length / (width < 500 ? 5 : 10)) : 1;

  const onMove = (event) => {
    const { x: px } = pointer(event, box.current);
    const pos = px - 12;
    let best = 0;
    labels.forEach((l, i) => {
      if (Math.abs(x(l) - pos) < Math.abs(x(labels[best]) - pos)) best = i;
    });
    setHoverIndex(best);
    const p = pointer(event, box.current);
    setTip({
      x: Math.min(p.x, width - 170),
      y: p.y,
      title: labels[best],
      lines: shown.map((s) => ({ label: s.name, value: fmt(rows[best][s.name]), color: s.color })),
    });
  };

  return (
    <div className="line-chart" ref={box}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Évolution de ${shown.map((s) => s.name).join(', ')} selon ${spec.x}`}
        onMouseMove={onMove}
        onTouchStart={onMove}
        onMouseLeave={() => {
          setHoverIndex(null);
          setTip(null);
        }}
      >
        {y.ticks(4).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x1={m.left - 4} x2={width - m.right} className="grid" />
            <text x={0} dy="0.32em" className="tick">
              {fmt(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 ? (
            <text key={l + i} x={x(l)} y={height - 8} textAnchor="middle" className="tick">
              {l.length > 10 ? `${l.slice(0, 9)}…` : l}
            </text>
          ) : null,
        )}
        {hoverIndex !== null && (
          <line className="guide" x1={x(labels[hoverIndex])} x2={x(labels[hoverIndex])} y1={m.top} y2={height - m.bottom} />
        )}
        {shown.map((s) => {
          const pts = rows.map((r, i) => [x(labels[i]), y(r[s.name])]).filter(([, py]) => !Number.isNaN(py));
          return (
            <g key={s.name}>
              <path d={d3line()(pts)} fill="none" stroke={s.color} strokeWidth="2" className="line-path" />
              {pts.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={hoverIndex === i ? 5 : 3} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
      {series.length > 1 && (
        <Legend items={series.map((s) => ({ key: s.name, label: s.name, color: s.color }))} hidden={hidden} onToggle={toggle} />
      )}
    </div>
  );
}

// ---------- Nuage de points ----------
export function ScatterPlot({ rows, spec }) {
  const [box, width] = useWidth();
  const [hidden, toggle] = useHidden();
  const [tip, setTip] = useState(null);
  const [active, setActive] = useState(null);
  const height = Math.min(360, Math.max(240, width * 0.55));
  const m = { top: 12, right: 16, bottom: 40, left: 46 };
  const clean = rows.filter((r) => Number.isFinite(r[spec.x]) && Number.isFinite(r[spec.y]));
  const categories = spec.color ? [...new Set(clean.map((r) => String(r[spec.color])))] : [];
  const colorMap = Object.fromEntries(categories.map((c, i) => [c, colorFor(c, i, spec.colors)]));
  const visible = clean.filter((r) => !spec.color || !hidden.has(String(r[spec.color])));
  const x = scaleLinear().domain(extent(clean, (r) => r[spec.x])).nice().range([m.left, width - m.right]);
  const y = scaleLinear().domain(extent(clean, (r) => r[spec.y])).nice().range([height - m.bottom, m.top]);
  const r = clean.length > 200 ? 2.5 : 4.5;

  const show = (event, row, i) => {
    const p = pointer(event, box.current);
    setActive(i);
    setTip({
      x: Math.min(p.x, width - 190),
      y: p.y,
      title: spec.color ? String(row[spec.color]) : null,
      lines: Object.entries(row)
        .filter(([k]) => k !== spec.color)
        .slice(0, 6)
        .map(([k, v]) => ({ label: k, value: typeof v === 'number' ? fmt(v) : v })),
    });
  };

  return (
    <div className="scatter-plot" ref={box}>
      <svg width={width} height={height} role="img" aria-label={`${spec.y} en fonction de ${spec.x}`}>
        {y.ticks(5).map((t) => (
          <g key={`y${t}`} transform={`translate(0,${y(t)})`}>
            <line x1={m.left} x2={width - m.right} className="grid" />
            <text x={m.left - 6} dy="0.32em" textAnchor="end" className="tick">
              {fmt(t)}
            </text>
          </g>
        ))}
        {x.ticks(width < 500 ? 4 : 8).map((t) => (
          <text key={`x${t}`} x={x(t)} y={height - m.bottom + 16} textAnchor="middle" className="tick">
            {fmt(t)}
          </text>
        ))}
        <text x={width - m.right} y={height - 4} textAnchor="end" className="axis-label">
          {spec.x} →
        </text>
        <text x={m.left} y={m.top - 2} className="axis-label" dy="-0.2em">
          ↑ {spec.y}
        </text>
        {visible.map((row, i) => (
          <circle
            key={i}
            cx={x(row[spec.x])}
            cy={y(row[spec.y])}
            r={active === i ? r + 3 : r}
            fill={spec.color ? colorMap[String(row[spec.color])] : 'var(--accent)'}
            fillOpacity={active === null || active === i ? 0.8 : 0.35}
            stroke="var(--surface)"
            strokeWidth="1"
            onMouseEnter={(e) => show(e, row, i)}
            onTouchStart={(e) => show(e, row, i)}
            onMouseLeave={() => {
              setActive(null);
              setTip(null);
            }}
          />
        ))}
      </svg>
      <Tooltip tip={tip} />
      {categories.length > 0 && (
        <Legend
          items={categories.map((c) => ({ key: c, label: c, color: colorMap[c] }))}
          hidden={hidden}
          onToggle={toggle}
        />
      )}
    </div>
  );
}

// ---------- Histogramme ----------
export function Histogram({ rows, spec }) {
  const [box, width] = useWidth();
  const [bins, setBins] = useState(spec.bins || 10);
  const [tip, setTip] = useState(null);
  const [active, setActive] = useState(null);
  const data = useMemo(() => histogram(rows, spec.x, bins), [rows, spec.x, bins]);
  const height = 220;
  const m = { top: 10, right: 12, bottom: 30, left: 36 };
  if (!data.length) return <p className="chart-empty">Aucune valeur numérique.</p>;
  const x = scaleLinear()
    .domain([min(data, (d) => d.x0), max(data, (d) => d.x1)])
    .range([m.left, width - m.right]);
  const y = scaleLinear()
    .domain([0, max(data, (d) => d.count) || 1])
    .nice()
    .range([height - m.bottom, m.top]);
  const color = spec.colors?.[spec.x] || 'var(--accent)';
  return (
    <div className="histogram" ref={box}>
      <div className="chart-tools">
        <label className="range-label">
          Classes : <strong>{bins}</strong>
          <input type="range" min="3" max="30" value={bins} onChange={(e) => setBins(Number(e.target.value))} />
        </label>
      </div>
      <svg width={width} height={height} role="img" aria-label={`Distribution de ${spec.x}`}>
        {y.ticks(4).map((t) => (
          <g key={t} transform={`translate(0,${y(t)})`}>
            <line x1={m.left} x2={width - m.right} className="grid" />
            <text x={m.left - 6} dy="0.32em" textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <rect
            key={i}
            x={x(d.x0) + 1}
            y={y(d.count)}
            width={Math.max(0, x(d.x1) - x(d.x0) - 2)}
            height={y(0) - y(d.count)}
            fill={color}
            opacity={active === null || active === i ? 1 : 0.45}
            onMouseEnter={(e) => {
              setActive(i);
              const p = pointer(e, box.current);
              setTip({
                x: Math.min(p.x, width - 170),
                y: p.y,
                title: `${fmt(d.x0)} – ${fmt(d.x1)}`,
                lines: [{ label: 'Effectif', value: d.count }],
              });
            }}
            onMouseLeave={() => {
              setActive(null);
              setTip(null);
            }}
          />
        ))}
        {x.ticks(width < 500 ? 4 : 8).map((t) => (
          <text key={t} x={x(t)} y={height - 10} textAnchor="middle" className="tick">
            {fmt(t)}
          </text>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------- Chiffres clés ----------
export function KeyFigures({ rows, spec }) {
  const aggregate = spec.aggregate || 'last';
  return (
    <div className="key-figures">
      {(spec.series || []).map((name) => {
        const values = rows.map((r) => r[name]);
        const value = reduce(values, aggregate);
        const first = values.find((v) => Number.isFinite(v));
        const last = [...values].reverse().find((v) => Number.isFinite(v));
        const variation = aggregate === 'last' && first ? ((last - first) / Math.abs(first)) * 100 : null;
        return (
          <div className="metric" key={name}>
            <p className="metric-value">{fmt(value)}</p>
            <p className="metric-label">{name}</p>
            {variation !== null && rows.length > 1 && (
              <p className={`metric-trend ${variation >= 0 ? 'up' : 'down'}`}>
                {variation >= 0 ? '+' : ''}
                {formatNumber(variation, 0)} % depuis le début
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Valeur d'en-tête pour une courbe à une série (« 7,2 → 10,4 » dans la maquette).
export function lineHeadline(rows, spec) {
  if (spec.chartType !== 'line' || (spec.series || []).length !== 1 || rows.length < 2) return null;
  const name = spec.series[0];
  const values = rows.map((r) => r[name]).filter(Number.isFinite);
  return `${fmt(values[0])} → ${fmt(values[values.length - 1])}`;
}

// ---------- Classement ----------
export function Ranking({ rows, spec }) {
  const [order, setOrder] = useState(spec.order || 'desc');
  const [showAll, setShowAll] = useState(false);
  const extra = spec.series || [];
  const data = useMemo(() => {
    const groups = new Map();
    for (const r of rows) {
      const key = String(r[spec.x]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    const agg = spec.aggregate || 'sum';
    const list = [...groups.entries()].map(([label, rs]) => ({
      label,
      value: reduce(rs.map((r) => r[spec.y]), agg),
      extra: Object.fromEntries(extra.map((c) => [c, reduce(rs.map((r) => r[c]), agg)])),
    }));
    return list.sort((a, b) => (order === 'desc' ? b.value - a.value : a.value - b.value));
  }, [rows, spec.x, spec.y, spec.aggregate, extra.join('|'), order]); // eslint-disable-line react-hooks/exhaustive-deps
  const limit = spec.limit || 10;
  const shown = showAll ? data : data.slice(0, limit);
  return (
    <div className="ranking">
      <div className="chart-tools">
        <span className="chart-measure">Classé selon {spec.y}</span>
        <button type="button" className="link-button" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>
          {order === 'desc' ? 'Du plus grand au plus petit ↓' : 'Du plus petit au plus grand ↑'}
        </button>
      </div>
      <div className="data-table-wrap">
        <table className="data-table ranking-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{spec.x}</th>
              <th scope="col" className="num">
                {spec.y}
              </th>
              {extra.map((c) => (
                <th key={c} scope="col" className="num">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((d, i) => (
              <tr key={d.label} className={i < 3 ? 'is-podium' : ''}>
                <td className="rank">{i + 1}</td>
                <th scope="row">{d.label}</th>
                <td className="num strong">{fmt(d.value)}</td>
                {extra.map((c) => (
                  <td key={c} className="num">
                    {fmt(d.extra[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > limit && (
        <button type="button" className="link-button" onClick={() => setShowAll((s) => !s)}>
          {showAll ? `Afficher les ${limit} premiers` : `Afficher les ${data.length} lignes`}
        </button>
      )}
    </div>
  );
}

// ---------- Face-à-face : le lecteur peut changer les deux protagonistes ----------
export function Versus({ rows, spec }) {
  const entities = useMemo(() => [...new Set(rows.map((r) => String(r[spec.x])))], [rows, spec.x]);
  const [pickLeft, setLeft] = useState(spec.left);
  const [pickRight, setRight] = useState(spec.right);
  // Si la variable change dans l'éditeur, on retombe sur les deux premières valeurs disponibles.
  const left = entities.includes(pickLeft) ? pickLeft : entities.includes(spec.left) ? spec.left : entities[0];
  const right = entities.includes(pickRight) ? pickRight : entities.includes(spec.right) ? spec.right : entities[1];
  const agg = spec.aggregate || 'mean';
  const value = (entity, col) => reduce(rows.filter((r) => String(r[spec.x]) === entity).map((r) => r[col]), agg);
  const leftColor = spec.colors?.left || 'var(--accent)';
  const rightColor = spec.colors?.right || '#e2723b';
  const picker = (val, set, label) => (
    <label className="versus-pick">
      <span className="sr-only">{label}</span>
      <select value={val || ''} onChange={(e) => set(e.target.value)}>
        {entities.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="versus">
      <div className="versus-head">
        <span className="versus-side" style={{ color: leftColor }}>
          {picker(left, setLeft, 'Protagoniste de gauche')}
        </span>
        <span className="versus-vs" aria-hidden="true">
          VS
        </span>
        <span className="versus-side right" style={{ color: rightColor }}>
          {picker(right, setRight, 'Protagoniste de droite')}
        </span>
      </div>
      <ul className="versus-rows">
        {(spec.series || []).map((col) => {
          const a = value(left, col);
          const b = value(right, col);
          const top = Math.max(Math.abs(a), Math.abs(b)) || 1;
          return (
            <li key={col}>
              <span className={`versus-val ${a > b ? 'is-best' : ''}`}>{fmt(a)}</span>
              <div className="versus-bar left">
                <i style={{ width: `${(Math.abs(a) / top) * 100}%`, background: leftColor }} />
              </div>
              <span className="versus-label">{col}</span>
              <div className="versus-bar">
                <i style={{ width: `${(Math.abs(b) / top) * 100}%`, background: rightColor }} />
              </div>
              <span className={`versus-val ${b > a ? 'is-best' : ''}`}>{fmt(b)}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted tiny">{AGGREGATES[agg]} par {spec.x.toLowerCase()} · la valeur la plus haute est en gras.</p>
    </div>
  );
}

// ---------- Heatmap de présence sur un terrain ----------
export function Heatmap({ rows, spec }) {
  const [box, width] = useWidth();
  const [tip, setTip] = useState(null);
  const [choice, setChoice] = useState('');
  const options = useMemo(() => (spec.color ? [...new Set(rows.map((r) => String(r[spec.color])))] : []), [rows, spec.color]);
  const subset = useMemo(
    () => (spec.color && choice ? rows.filter((r) => String(r[spec.color]) === choice) : rows),
    [rows, spec.color, choice],
  );
  const [cols, lines] = spec.grid === 'fine' ? [24, 16] : [12, 8];
  const { grid, max: top, total } = useMemo(() => densityGrid(subset, spec.x, spec.y, spec.value, cols, lines), [subset, spec.x, spec.y, spec.value, cols, lines]);
  const W = width;
  const H = Math.round(width * 0.62);
  const cw = W / cols;
  const ch = H / lines;
  const color = spec.colors?.heat || 'var(--accent)';
  return (
    <div className="heatmap" ref={box}>
      {options.length > 0 && (
        <div className="chart-tools">
          <label className="range-label">
            {spec.color} :{' '}
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">Tous</option>
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <span className="muted small">{total} action(s)</span>
        </div>
      )}
      <svg width={W} height={H} role="img" aria-label={`Heatmap de présence (${total} actions)`} className="pitch">
        <rect x="0" y="0" width={W} height={H} className="pitch-bg" />
        {grid.map((line, li) =>
          line.map((v, ci) =>
            v > 0 ? (
              <rect
                key={`${li}-${ci}`}
                x={ci * cw}
                y={li * ch}
                width={cw}
                height={ch}
                fill={color}
                fillOpacity={0.12 + 0.78 * (v / top)}
                onMouseEnter={(e) => {
                  const p = pointer(e, box.current);
                  setTip({
                    x: Math.min(p.x, W - 160),
                    y: p.y,
                    title: `Zone ${ci + 1}×${li + 1}`,
                    lines: [
                      { label: spec.value || 'Actions', value: fmt(v) },
                      { label: 'Part', value: `${formatNumber((v / total) * 100, 1)} %` },
                    ],
                  });
                }}
                onMouseLeave={() => setTip(null)}
              />
            ) : null,
          ),
        )}
        <PitchLines W={W} H={H} />
      </svg>
      <Tooltip tip={tip} />
      <div className="heat-scale">
        <span className="muted tiny">Moins</span>
        <i style={{ background: `linear-gradient(90deg, transparent, ${color})` }} />
        <span className="muted tiny">Plus</span>
        <span className="muted tiny">· sens du jeu →</span>
      </div>
    </div>
  );
}

function PitchLines({ W, H }) {
  const s = (v) => (v / 100) * W;
  const t = (v) => (v / 100) * H;
  return (
    <g className="pitch-lines" fill="none">
      <rect x="1" y="1" width={W - 2} height={H - 2} />
      <line x1={W / 2} y1="0" x2={W / 2} y2={H} />
      <circle cx={W / 2} cy={H / 2} r={t(15)} />
      <rect x="1" y={t(21)} width={s(16)} height={t(58)} />
      <rect x={W - s(16) - 1} y={t(21)} width={s(16)} height={t(58)} />
      <rect x="1" y={t(37)} width={s(5.5)} height={t(26)} />
      <rect x={W - s(5.5) - 1} y={t(37)} width={s(5.5)} height={t(26)} />
    </g>
  );
}

export const RENDERERS = {
  bar: BarChart,
  pie: PieChart,
  line: LineChart,
  scatter: ScatterPlot,
  histogram: Histogram,
  kpi: KeyFigures,
  ranking: Ranking,
  versus: Versus,
  heatmap: Heatmap,
};
