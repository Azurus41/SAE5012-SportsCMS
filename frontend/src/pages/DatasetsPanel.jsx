import { useState } from 'react';
import api, { mutate, useApi } from '../api/index.js';
import { ROLES } from '../api/seed.js';
import { useSession } from '../auth/SessionContext.jsx';
import Icon from '../components/Icon.jsx';
import { useAction, useToast } from '../components/Toast.jsx';
import { describeVariables } from '../data/csv.js';
import { fetchSource } from '../data/datasetLoader.js';
import { findArrayPaths } from '../data/json.js';
import { KIND_LABELS } from '../data/chartRules.js';

const SOURCE_TYPES = {
  file: 'Fichier CSV',
  csv: 'Lien vers un CSV',
  json: 'Lien vers un JSON',
  api: 'API open data',
};

const API_EXAMPLES = [
  {
    label: 'TheSportsDB · classement Ligue 1 2024-2025 (clé de test publique « 123 »)',
    url: 'https://www.thesportsdb.com/api/v1/json/123/lookuptable.php?l=4334&s=2024-2025',
    jsonPath: 'table',
  },
  {
    label: 'football-data.org · classement (clé requise → proxy Symfony)',
    url: 'https://api.football-data.org/v4/competitions/FL1/standings',
    jsonPath: 'standings.0.table',
    proxy: true,
  },
];

// Espace du fournisseur de données : il dépose un jeu (CSV, JSON ou API), vérifie son chargement
// sous forme de tableau et choisit pour chaque variable si elle est catégorielle ou numérique.
export default function DatasetsPanel() {
  const { user } = useSession();
  const run = useAction();
  const { data: datasets = [] } = useApi(() => api.datasets.list(), []);
  const { data: users = [] } = useApi(() => api.users.list(), []);
  const [editing, setEditing] = useState(null);

  return (
    <section aria-labelledby="datasets-title">
      <div className="section-heading">
        <div>
          <h2 id="datasets-title">Jeux de données</h2>
          <p className="muted small">
            Le CMS conserve uniquement le lien vers les données et le type des variables ; le contenu est chargé au moment d’afficher les graphiques.
          </p>
        </div>
        {!editing && (
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            Ajouter un jeu de données
          </button>
        )}
      </div>

      {editing && <DatasetForm initial={editing} onDone={() => setEditing(null)} />}

      <ul className="dataset-cards">
        {datasets.map((d) => (
          <li key={d.id} className="dataset-card">
            <Icon name="file-spreadsheet" />
            <div className="dataset-info">
              <p className="strong">
                {d.name} <span className="category">{(d.sourceType || 'csv').toUpperCase()}</span>
              </p>
              <p className="muted small">{d.description}</p>
              <p className="muted tiny">
                {d.rows ? `${d.rows} lignes · ` : ''}
                {d.variables.filter((v) => v.kind === 'categorical').length} catégorielle(s) ·{' '}
                {d.variables.filter((v) => v.kind === 'numeric').length} numérique(s) · par {users.find((u) => u.id === d.providerId)?.name || '—'}
              </p>
              <p className="variables">
                {d.variables.map((v) => (
                  <span key={v.name} className={`var-chip is-${v.kind}`} title={KIND_LABELS[v.kind]}>
                    {v.kind === 'numeric' ? '#' : 'Aa'} {v.name}
                  </span>
                ))}
              </p>
            </div>
            <div className="dataset-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(d)}>
                Modifier
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => window.confirm(`Supprimer « ${d.name} » ?`) && run(mutate(api.datasets.remove(d.id)), 'Jeu de données supprimé.')}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted tiny">Connecté en tant que {ROLES[user?.role]}.</p>
    </section>
  );
}

// « www.thesportsdb.com · lookuptable » plutôt que « lookuptable.php ».
function defaultName(url) {
  try {
    const u = new URL(url, window.location.origin);
    const file = u.pathname.split('/').filter(Boolean).pop() || '';
    if (u.origin === window.location.origin) return file || 'Jeu de données';
    return `${u.hostname.replace(/^www\./, '')} · ${file.replace(/\.(php|json)$/, '')}`;
  } catch {
    return 'Jeu de données';
  }
}

function DatasetForm({ initial, onDone }) {
  const toast = useToast();
  const [type, setType] = useState(initial.id ? initial.sourceType || 'csv' : 'file');
  const [url, setUrl] = useState(initial.url && !initial.url.startsWith('data:') ? initial.url : '');
  const [file, setFile] = useState(null);
  const [jsonPath, setJsonPath] = useState(initial.jsonPath || '');
  const [proxy, setProxy] = useState(!!initial.proxy);
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [preview, setPreview] = useState(null);
  const [variables, setVariables] = useState(initial.variables || []);
  const [loading, setLoading] = useState(false);
  const [storedUrl, setStoredUrl] = useState(initial.url?.startsWith('data:') ? initial.url : null);

  const load = async () => {
    setLoading(true);
    setPreview(null);
    try {
      let source = url;
      let sourceType = type;
      if (type === 'file') {
        if (!file && !storedUrl) throw new Error('Choisissez un fichier CSV.');
        if (file) {
          const up = await api.files.upload(file);
          source = up.url;
          setStoredUrl(up.url);
          if (!name) setName(up.name);
        } else source = storedUrl;
        sourceType = 'csv';
      } else if (!url) throw new Error('Indiquez le lien vers les données.');
      if (type === 'api' && proxy) {
        toast('Cette source passe par le proxy Symfony (clé côté serveur) : l’aperçu sera disponible une fois l’API branchée.', 'info');
      }
      const { parsed, raw } = await fetchSource({ url: source, sourceType, jsonPath });
      const described = describeVariables(parsed);
      // On garde les choix déjà faits par le fournisseur pour les variables connues.
      const previous = Object.fromEntries(variables.map((v) => [v.name, v.kind]));
      setVariables(described.map((v) => ({ ...v, kind: previous[v.name] || v.kind })));
      setPreview({ ...parsed, paths: raw ? findArrayPaths(raw) : [] });
      if (!name && type !== 'file') setName(defaultName(url));
    } catch (e) {
      toast(
        e.message === 'Failed to fetch'
          ? 'Le serveur distant refuse l’accès depuis le navigateur (CORS) : cette source devra passer par le proxy Symfony.'
          : e.message,
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      await mutate(
        api.datasets.save({
          id: initial.id,
          name: name.trim() || 'Jeu de données',
          description,
          sourceType: type === 'file' ? 'csv' : type,
          url: type === 'file' ? storedUrl : url,
          jsonPath: type === 'json' || type === 'api' ? jsonPath : undefined,
          proxy: type === 'api' ? proxy : undefined,
          rows: preview?.rows.length ?? initial.rows,
          variables: variables.map(({ name: n, kind }) => ({ name: n, kind })),
        }),
      );
      toast('Jeu de données enregistré.', 'success');
      onDone();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const invalid = variables.filter((v) => v.kind === 'numeric' && v.invalidNumbers > 0);

  return (
    <div className="dataset-form">
      <div className="segmented" role="tablist" aria-label="Type de source">
        {Object.entries(SOURCE_TYPES).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={type === k} onClick={() => setType(k)}>
            {label}
          </button>
        ))}
      </div>

      {type === 'file' ? (
        <label className="field">
          <span>Fichier CSV (séparateur « ; », première ligne = noms des variables)</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
      ) : (
        <label className="field">
          <span>Lien {type === 'api' ? 'du service' : 'du fichier'}</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={type === 'csv' ? '/datasets/iris.csv' : 'https://…'} />
        </label>
      )}

      {type === 'api' && (
        <div className="api-examples">
          <p className="muted small">Exemples de services :</p>
          {API_EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              className="link-button small"
              onClick={() => {
                setUrl(ex.url);
                setJsonPath(ex.jsonPath);
                setProxy(!!ex.proxy);
              }}
            >
              {ex.label}
            </button>
          ))}
          <label className="check">
            <input type="checkbox" checked={proxy} onChange={(e) => setProxy(e.target.checked)} />
            Le service exige une clé : passer par le proxy du serveur (la clé n’est jamais envoyée au navigateur)
          </label>
        </div>
      )}

      {(type === 'json' || type === 'api') && (
        <label className="field">
          <span>Chemin vers le tableau dans la réponse (ex. standings.0.table)</span>
          <input value={jsonPath} onChange={(e) => setJsonPath(e.target.value)} placeholder="(racine)" />
          {preview?.paths?.length > 0 && (
            <span className="path-suggestions">
              {preview.paths.slice(0, 6).map((p) => (
                <button key={p} type="button" className="var-chip" onClick={() => setJsonPath(p)}>
                  {p || '(racine)'}
                </button>
              ))}
            </span>
          )}
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? 'Chargement…' : 'Charger et vérifier'}
        </button>
      </div>

      {preview && (
        <>
          {preview.issues.length > 0 && (
            <ul className="chart-errors" role="alert">
              {preview.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <p className="small">
            <strong>{preview.rows.length}</strong> individus · <strong>{preview.columns.length}</strong> variables identifiées
            {preview.delimiter ? ` · séparateur « ${preview.delimiter} »` : ''}
          </p>
          <div className="data-table-wrap preview-table">
            <table className="data-table">
              <caption className="sr-only">Aperçu des 12 premières lignes</caption>
              <thead>
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 12).map((r, i) => (
                  <tr key={i}>
                    {preview.columns.map((c) => (
                      <td key={c}>{r[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {variables.length > 0 && (
        <fieldset className="variables-form">
          <legend className="strong">Type de chaque variable</legend>
          <p className="muted small">Proposition automatique à vérifier : une variable « numérique » doit contenir des nombres, une « catégorielle » des libellés ou des codes.</p>
          {variables.map((v, i) => (
            <div className="variable-row" key={v.name}>
              <span className="variable-name">{v.name}</span>
              {v.distinct !== undefined && <span className="muted tiny">{v.distinct} valeurs distinctes</span>}
              <select
                aria-label={`Type de ${v.name}`}
                value={v.kind}
                onChange={(e) => setVariables(variables.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
              >
                <option value="categorical">Catégorielle</option>
                <option value="numeric">Numérique</option>
              </select>
            </div>
          ))}
          {invalid.length > 0 && (
            <p className="chart-errors small" role="alert">
              Attention : {invalid.map((v) => `« ${v.name} » (${v.invalidNumbers} valeur(s) non numérique(s))`).join(', ')}. Ces valeurs seront ignorées dans les graphiques.
            </p>
          )}
        </fieldset>
      )}

      <label className="field">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Description (affichée sous les articles)</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!variables.length}>
          Enregistrer
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Annuler
        </button>
      </div>
    </div>
  );
}
