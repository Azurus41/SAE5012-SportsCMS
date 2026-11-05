import { useLayoutEffect, useRef, useState } from 'react';

// Palette par défaut : la couleur d'accent du thème puis des teintes distinguables (contraste ≥ 3:1 sur blanc).
export const PALETTE = ['var(--accent)', '#e2723b', '#1f9d6b', '#8a4fd8', '#d64545', '#1c8fbf', '#b98a00', '#72777e'];

export function colorFor(key, index, colors = {}) {
  return colors?.[key] || PALETTE[index % PALETTE.length];
}

// Largeur disponible du conteneur (les graphiques se redessinent au redimensionnement : mobile first).
export function useWidth(min = 260) {
  const ref = useRef(null);
  const [width, setWidth] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // Mesure immédiate (avant le premier affichage), puis suivi des redimensionnements.
    if (el.clientWidth) setWidth(Math.max(min, el.clientWidth));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(min, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, width];
}

export function Tooltip({ tip }) {
  if (!tip) return null;
  const style = { left: tip.x, top: tip.y };
  return (
    <div className="chart-tooltip" style={style} role="status">
      {tip.title && <strong>{tip.title}</strong>}
      {tip.lines.map((l, i) => (
        <span key={i}>
          {l.color && <i className="chart-key" style={{ background: l.color }} />}
          {l.label} <b>{l.value}</b>
        </span>
      ))}
    </div>
  );
}

// Légende interactive : cliquer sur un élément le masque ou l'affiche.
export function Legend({ items, hidden, onToggle }) {
  if (!items.length) return null;
  return (
    <ul className="chart-legend">
      {items.map((item) => {
        const off = hidden.has(item.key);
        return (
          <li key={item.key}>
            <button
              type="button"
              className={off ? 'is-off' : ''}
              aria-pressed={!off}
              onClick={() => onToggle(item.key)}
              title={off ? 'Afficher' : 'Masquer'}
            >
              <i className="chart-key" style={{ background: item.color }} />
              {item.label}
              {item.extra && <span className="chart-legend-extra">{item.extra}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function useHidden() {
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return [hidden, toggle];
}

// Position du curseur relative au conteneur du graphique, pour placer l'infobulle.
export function pointer(event, container) {
  const box = container.getBoundingClientRect();
  const src = event.touches?.[0] || event;
  return { x: src.clientX - box.left + 12, y: src.clientY - box.top + 12 };
}
