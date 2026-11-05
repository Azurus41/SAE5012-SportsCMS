import { useEffect, useState } from 'react';
import api, { mutate, useApi } from '../api/index.js';
import { useAction } from '../components/Toast.jsx';
import { BrandMark } from '../components/SiteChrome.jsx';
import ThemeForm from '../theme/ThemeForm.jsx';
import { PAGE_SCOPES, themeStyle } from '../theme/themeFields.js';

// Espace designer : surcouche de style pour tout le site, une page ou un article, enregistrée en base.
export default function ThemePanel() {
  const run = useAction();
  const { data: themes = [] } = useApi(() => api.themes.list(), []);
  const { data: articles = [] } = useApi(() => api.articles.list(), []);
  const [scope, setScope] = useState('site');
  const [target, setTarget] = useState('home');
  const [values, setValues] = useState({});

  const id = scope === 'site' ? 'site' : `${scope}:${target}`;
  const stored = themes.find((t) => t.id === id);
  useEffect(() => {
    setValues(stored?.values || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stored?.values && JSON.stringify(stored.values)]);

  const changeScope = (s) => {
    setScope(s);
    if (s === 'page') setTarget('home');
    if (s === 'article') setTarget(articles.find((a) => a.status !== 'deleted')?.id || '');
  };

  return (
    <section aria-labelledby="theme-title">
      <div className="section-heading">
        <div>
          <h2 id="theme-title">Thème</h2>
          <p className="muted small">
            Les thèmes ne sont qu’une surcouche de couleurs et de tailles appliquée au design responsive de base.
          </p>
        </div>
      </div>
      <div className="theme-layout">
        <div>
          <div className="field-row">
            <label className="field">
              <span>Portée</span>
              <select value={scope} onChange={(e) => changeScope(e.target.value)}>
                <option value="site">Tout le site</option>
                <option value="page">Une page</option>
                <option value="article">Un article</option>
              </select>
            </label>
            {scope === 'page' && (
              <label className="field">
                <span>Page</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {Object.entries(PAGE_SCOPES).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {scope === 'article' && (
              <label className="field">
                <span>Article</span>
                <select value={target} onChange={(e) => setTarget(e.target.value)}>
                  {articles
                    .filter((a) => a.status !== 'deleted')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <ThemeForm values={values} onChange={setValues} />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => run(mutate(api.themes.save({ scope, target, values })), 'Thème enregistré et appliqué.')}
            >
              Enregistrer le thème
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setValues({})}>
              Tout réinitialiser
            </button>
          </div>
        </div>
        <ThemePreview values={values} />
      </div>
    </section>
  );
}

export function ThemePreview({ values }) {
  return (
    <div className="theme-preview" style={themeStyle(values)} aria-label="Aperçu du thème">
      <div className="tp-header">
        <BrandMark />
        <span className="wordmark">touchline</span>
        <span className="tp-link">Articles</span>
      </div>
      <div className="tp-body">
        <span className="category is-primary">FOOTBALL</span>
        <p className="tp-title">Le pressing haut change le jeu</p>
        <p className="tp-heading">Le déplacement vers l’avant</p>
        <p className="tp-text">Pendant des années, la possession a été synonyme de contrôle.</p>
        <div className="tp-block">
          <div className="tp-bar" style={{ width: '62%' }} />
          <div className="tp-bar" style={{ width: '86%' }} />
        </div>
        <span className="btn btn-primary btn-sm">Publier un article</span>
      </div>
    </div>
  );
}
