import { THEME_FIELDS } from './themeFields.js';

// Formulaire des paramètres de thème (réutilisé par la page Thème du designer et l'onglet Apparence de l'éditeur).
export default function ThemeForm({ values, onChange, fields }) {
  const list = fields ? THEME_FIELDS.filter((f) => fields.includes(f.key)) : THEME_FIELDS;
  const set = (key, v) => {
    const next = { ...values };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className="theme-form">
      {list.map((f) => {
        const custom = values?.[f.key] !== undefined;
        return (
          <div key={f.key} className={`theme-field ${custom ? 'is-custom' : ''}`}>
            <label htmlFor={`theme-${f.key}`}>{f.label}</label>
            <div className="theme-input">
              {f.type === 'color' && (
                <input id={`theme-${f.key}`} type="color" value={values?.[f.key] || f.default} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.type === 'number' && (
                <>
                  <input
                    id={`theme-${f.key}`}
                    type="range"
                    min={f.min}
                    max={f.max}
                    value={values?.[f.key] ?? f.default}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                  />
                  <output className="small">{values?.[f.key] ?? f.default} px</output>
                </>
              )}
              {f.type === 'select' && (
                <select id={`theme-${f.key}`} value={values?.[f.key] || f.default} onChange={(e) => set(f.key, e.target.value)}>
                  {Object.entries(f.options).map(([k, [label]]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              {custom && (
                <button type="button" className="link-button small" onClick={() => set(f.key, undefined)}>
                  Défaut
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
