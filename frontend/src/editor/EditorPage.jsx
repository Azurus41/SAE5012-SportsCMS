import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { mutate, useApi } from '../api/index.js';
import { slugify } from '../api/mockApi.js';
import { ROLES } from '../api/seed.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import BlockView from '../blocks/BlockView.jsx';
import ChartBlock from '../charts/ChartBlock.jsx';
import { BrandMark } from '../components/SiteChrome.jsx';
import Icon from '../components/Icon.jsx';
import { useToast } from '../components/Toast.jsx';
import { ARTICLE_TYPES, BLOCK_LABELS, SPORTS, TOPICS, readingTime, wordCount } from '../constants.js';
import { validateChart } from '../data/chartRules.js';
import ChartSettings, { autoFields } from './ChartSettings.jsx';
import { compressImage } from './imageUpload.js';
import ThemeForm from '../theme/ThemeForm.jsx';
import { ARTICLE_APPEARANCE_FIELDS, themeStyle } from '../theme/themeFields.js';

const newId = () => `b-${Math.random().toString(36).slice(2, 10)}`;

function emptyArticle(user) {
  return {
    title: '',
    summary: '',
    slug: '',
    sport: 'football',
    topic: 'tactique',
    type: 'dashboard',
    status: 'draft',
    authorId: user?.id,
    bannerMediaId: null,
    blocks: [{ id: newId(), type: 'heading', level: 2, text: '' }, { id: newId(), type: 'text', text: '' }],
  };
}

export default function EditorPage() {
  const { id } = useParams();
  const { user, ready } = useSession();
  const isNew = !id || id === 'nouveau';
  const { data: loaded, error } = useApi(() => (isNew ? Promise.resolve(null) : api.articles.get(id)), [id]);

  if (!ready) return null;
  if (isNew && !can.createArticle(user)) {
    return <Denied message="Seuls les auteurs, éditeurs et administrateurs peuvent créer des articles." login={!user} />;
  }
  if (!isNew && error) return <Denied message="Article introuvable." />;
  if (!isNew && !loaded) return <p className="container page-pad muted">Chargement…</p>;
  if (!isNew && !can.editArticle(user, loaded)) {
    return <Denied message="Vous ne pouvez modifier que vos propres articles (les éditeurs et administrateurs peuvent modifier tous les articles)." />;
  }
  return <Editor key={loaded?.id || 'new'} initial={loaded || emptyArticle(user)} user={user} />;
}

function Denied({ message, login = false }) {
  const location = useLocation();
  return (
    <section className="container page-pad">
      <h1 className="page-title">{login ? 'Connexion requise' : 'Accès refusé'}</h1>
      <p className="lead-sm">{message}</p>
      <div className="form-actions">
        {login && (
          <Link to={`/connexion?next=${encodeURIComponent(location.pathname)}`} className="btn btn-primary">
            Se connecter
          </Link>
        )}
        <Link to="/articles" className={`btn ${login ? 'btn-secondary' : 'btn-primary'}`}>
          Retour aux articles
        </Link>
      </div>
    </section>
  );
}

// Historique pour annuler / rétablir. Les frappes successives dans un même champ sont regroupées.
function useHistory(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const lastKey = useRef({ key: null, at: 0 });
  const set = useCallback((updater, key) => {
    setState((s) => {
      const next = typeof updater === 'function' ? updater(s.present) : updater;
      const now = Date.now();
      const coalesce = key && lastKey.current.key === key && now - lastKey.current.at < 1000;
      lastKey.current = { key, at: now };
      return {
        past: coalesce ? s.past : [...s.past.slice(-80), s.present],
        present: next,
        future: [],
      };
    });
  }, []);
  const undo = useCallback(
    () =>
      setState((s) =>
        s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s,
      ),
    [],
  );
  const redo = useCallback(
    () => setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)),
    [],
  );
  return { draft: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

function Editor({ initial, user }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { draft, set, undo, redo, canUndo, canRedo } = useHistory(initial);
  const [savedVersion, setSavedVersion] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('article');
  const [drawer, setDrawer] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preview, setPreview] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertAfter, setInsertAfter] = useState(null);
  const textareas = useRef({});
  const { data: datasets = [] } = useApi(() => api.datasets.list(), []);
  const { data: media = [] } = useApi(() => api.media.list(), []);
  const { data: users = [] } = useApi(() => api.users.list(), []);

  const dirty = JSON.stringify(draft) !== savedVersion;
  const selected = draft.blocks.find((b) => b.id === selectedId);
  const author = users.find((u) => u.id === draft.authorId) || user;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Raccourcis : Ctrl+Z / Ctrl+Y (ou Maj+Ctrl+Z), Ctrl+S.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        save();
      } else if (k === 'z' && !e.shiftKey && !isTextField(e.target)) {
        e.preventDefault();
        undo();
      } else if ((k === 'y' || (k === 'z' && e.shiftKey)) && !isTextField(e.target)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const update = (patch, key) => set((d) => ({ ...d, ...patch }), key);
  const updateBlock = (blockId, patch, key) =>
    set((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }), key && `${blockId}:${key}`);
  const replaceBlock = (block) => set((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === block.id ? block : b)) }));

  const insertBlock = (type, extra = {}) => {
    let block = { id: newId(), type, ...extra };
    if (type === 'heading') block = { level: 2, text: '', ...block };
    if (type === 'text' || type === 'quote') block = { text: '', ...block };
    if (type === 'chart') {
      const ds = datasets[0];
      const chartType = ds?.variables.some((v) => v.kind === 'categorical') ? 'bar' : 'histogram';
      block = { datasetId: ds?.id, chartType, colors: {}, title: '', caption: ds ? `Source : ${ds.name}` : '', ...autoFields(chartType, ds), ...block };
    }
    set((d) => {
      const idx = insertAfter ? d.blocks.findIndex((b) => b.id === insertAfter) : selectedId ? d.blocks.findIndex((b) => b.id === selectedId) : -1;
      const at = idx >= 0 ? idx + 1 : d.blocks.length;
      const blocks = [...d.blocks];
      blocks.splice(at, 0, block);
      return { ...d, blocks };
    });
    setSelectedId(block.id);
    setInsertOpen(false);
    setInsertAfter(null);
    if (type === 'chart' || type === 'image') setTab('bloc');
    if (type === 'image') setDrawer('media');
    requestAnimationFrame(() => document.getElementById(`block-${block.id}`)?.querySelector('input, textarea')?.focus());
    return block;
  };

  const moveBlock = (blockId, delta) =>
    set((d) => {
      const i = d.blocks.findIndex((b) => b.id === blockId);
      const j = i + delta;
      if (j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });

  const removeBlock = (blockId) => {
    set((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== blockId) }));
    setSelectedId(null);
  };

  const duplicateBlock = (blockId) =>
    set((d) => {
      const i = d.blocks.findIndex((b) => b.id === blockId);
      const blocks = [...d.blocks];
      blocks.splice(i + 1, 0, { ...structuredClone(d.blocks[i]), id: newId() });
      return { ...d, blocks };
    });

  // Gras, italique, lien, liste : on entoure la sélection du bloc texte actif.
  const format = (kind) => {
    if (!selected || !['text', 'quote'].includes(selected.type)) {
      toast('Sélectionnez d’abord un bloc de texte.');
      return;
    }
    const el = textareas.current[selected.id];
    const value = selected.text || '';
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const sel = value.slice(start, end) || (kind === 'link' ? 'texte du lien' : 'texte');
    let insert = sel;
    if (kind === 'bold') insert = `**${sel}**`;
    if (kind === 'italic') insert = `*${sel}*`;
    if (kind === 'link') {
      const url = window.prompt('Adresse du lien (https://…)', 'https://');
      if (!url) return;
      insert = `[${sel}](${url})`;
    }
    if (kind === 'list') insert = sel.split('\n').map((l) => `- ${l.replace(/^- /, '')}`).join('\n');
    const text = value.slice(0, start) + insert + value.slice(end);
    updateBlock(selected.id, { text });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start, start + insert.length);
    });
  };

  const convertSelected = (value) => {
    if (!selected || !['text', 'heading', 'quote'].includes(selected.type)) return;
    if (value === 'text') replaceBlock({ id: selected.id, type: 'text', text: selected.text || '' });
    else if (value === 'quote') replaceBlock({ id: selected.id, type: 'quote', text: selected.text || '', cite: '' });
    else replaceBlock({ id: selected.id, type: 'heading', level: Number(value.slice(1)), text: selected.text || '' });
  };

  const problems = () => {
    const out = [];
    if (!draft.title.trim()) out.push('Ajoutez un titre.');
    if (!draft.summary.trim()) out.push('Ajoutez un résumé.');
    if (draft.type === 'dashboard' && !draft.blocks.some((b) => b.type === 'chart')) {
      out.push('Un article « narration » doit contenir au moins une visualisation.');
    }
    draft.blocks
      .filter((b) => b.type === 'chart')
      .forEach((b, i) => {
        const ds = datasets.find((d) => d.id === b.datasetId);
        const errs = validateChart(b, ds?.variables);
        if (errs.length) out.push(`Graphique ${i + 1} : ${errs[0]}`);
      });
    return out;
  };

  async function save(status = draft.status) {
    if (saving) return;
    if (status === 'published') {
      const issues = problems();
      if (issues.length) {
        toast(issues[0], 'error');
        return;
      }
    } else if (!draft.title.trim()) {
      toast('Ajoutez un titre avant d’enregistrer.', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = await mutate(api.articles.save({ ...draft, status }));
      set(saved);
      setSavedVersion(JSON.stringify(saved));
      toast(status === 'published' ? 'Article publié.' : 'Brouillon enregistré.', 'success');
      if (!draft.id) navigate(`/editeur/${saved.id}`, { replace: true });
      if (status === 'published' && draft.status !== 'published') navigate(`/articles/${saved.slug}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const uploadImage = async (file, asBanner = false) => {
    try {
      const img = await compressImage(file);
      const m = await mutate(api.media.add({ ...img, alt: '' }));
      if (asBanner) update({ bannerMediaId: m.id });
      return m;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  };

  const usedDatasets = datasets.filter((d) => draft.blocks.some((b) => b.type === 'chart' && b.datasetId === d.id));
  const banner = media.find((m) => m.id === draft.bannerMediaId);
  const selectedKind = selected?.type === 'heading' ? `h${selected.level || 2}` : selected?.type === 'quote' ? 'quote' : 'text';

  return (
    <div className="editor">
      <header className="editor-header">
        <div className="editor-identity">
          <Link to="/" aria-label="Accueil">
            <BrandMark large />
          </Link>
          <Link to="/articles" className="muted small back-link">
            ← Tous les articles
          </Link>
          <span className="v-divider" aria-hidden="true" />
          <span className="editor-role">Éditeur · {ROLES[user.role]}</span>
        </div>
        <div className="publishing-actions">
          <span className="muted small save-state" aria-live="polite">
            {saving ? 'Enregistrement…' : dirty ? '● Modifications non enregistrées' : '✓  Toutes les modifications enregistrées'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => save(draft.status === 'published' ? 'published' : 'draft')}>
            {draft.status === 'published' ? 'Enregistrer' : 'Enregistrer le brouillon'}
          </button>
          <button type="button" className="btn btn-secondary" aria-pressed={preview} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Modifier' : 'Aperçu'}
          </button>
          {draft.status !== 'published' && (
            <button type="button" className="btn btn-primary" onClick={() => save('published')}>
              Publier l’article <span aria-hidden="true">↗</span>
            </button>
          )}
          <button type="button" className="icon-button" title="Réglages de l’article" onClick={() => { setSidebarOpen(true); setTab('article'); }}>
            <Icon name="settings-2" label="Réglages de l’article" />
          </button>
          <details className="more-menu">
            <summary className="icon-button" title="Plus d’actions">
              <Icon name="ellipsis" label="Plus d’actions" />
            </summary>
            <div className="menu-pop">
              {draft.id && (
                <Link to={`/articles/${draft.slug}`} className="menu-item">
                  Voir la page publique
                </Link>
              )}
              {draft.status === 'published' && (
                <button type="button" className="menu-item" onClick={() => save('draft')}>
                  Repasser en brouillon
                </button>
              )}
              {draft.id && can.deleteArticle(user, draft) && (
                <button
                  type="button"
                  className="menu-item danger"
                  onClick={async () => {
                    if (!window.confirm('Supprimer cet article ?')) return;
                    await mutate(api.articles.remove(draft.id));
                    navigate('/articles');
                  }}
                >
                  Supprimer l’article
                </button>
              )}
            </div>
          </details>
        </div>
      </header>

      <div className="formatting-toolbar" role="toolbar" aria-label="Mise en forme">
        <div className="block-tools">
          <div className="insert-wrap">
            <button
              type="button"
              className="insert-block"
              aria-haspopup="menu"
              aria-expanded={insertOpen}
              onClick={() => setInsertOpen((o) => !o)}
              title="Insérer un bloc"
            >
              +
            </button>
            {insertOpen && <InsertMenu onPick={insertBlock} onClose={() => setInsertOpen(false)} />}
          </div>
          <button type="button" className="icon-button" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
            <Icon name="undo-2" label="Annuler" />
          </button>
          <button type="button" className="icon-button" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
            <Icon name="redo-2" label="Rétablir" />
          </button>
          <span className="tool-sep" aria-hidden="true" />
          <label className="paragraph-select">
            <span className="sr-only">Style du bloc</span>
            <select value={selectedKind} onChange={(e) => convertSelected(e.target.value)} disabled={!selected || !['text', 'heading', 'quote'].includes(selected.type)}>
              <option value="text">Paragraphe</option>
              <option value="h2">Titre niveau 2</option>
              <option value="h3">Titre niveau 3</option>
              <option value="h4">Titre niveau 4</option>
              <option value="quote">Citation</option>
            </select>
          </label>
          <span className="tool-sep" aria-hidden="true" />
          <button type="button" className="text-tool bold" onMouseDown={(e) => e.preventDefault()} onClick={() => format('bold')} title="Gras">
            B
          </button>
          <button type="button" className="text-tool italic" onMouseDown={(e) => e.preventDefault()} onClick={() => format('italic')} title="Italique">
            I
          </button>
          <button type="button" className="icon-button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('link')} title="Lien">
            <Icon name="link" label="Lien" />
          </button>
          <button type="button" className="icon-button" onMouseDown={(e) => e.preventDefault()} onClick={() => format('list')} title="Liste">
            <Icon name="list" label="Liste" />
          </button>
          <button type="button" className="icon-button" onClick={() => (selected ? convertSelected('quote') : insertBlock('quote'))} title="Citation">
            <Icon name="quote" label="Citation" />
          </button>
          <span className="tool-sep" aria-hidden="true" />
          <button type="button" className="icon-button" onClick={() => insertBlock('image')} title="Insérer une image">
            <Icon name="image" label="Insérer une image" />
          </button>
          <button type="button" className="icon-button" onClick={() => insertBlock('chart')} title="Insérer un graphique">
            <Icon name="chart" label="Insérer un graphique" />
          </button>
        </div>
        <label className="mode-select muted small">
          <span className="sr-only">Mode</span>
          <select value={preview ? 'preview' : 'visual'} onChange={(e) => setPreview(e.target.value === 'preview')}>
            <option value="visual">Éditeur visuel</option>
            <option value="preview">Aperçu lecteur</option>
          </select>
        </label>
      </div>

      <div className="authoring-workspace">
        <nav className="editor-nav" aria-label="Panneaux de l’éditeur">
          <button type="button" className="icon-button" aria-pressed={sidebarOpen} onClick={() => setSidebarOpen((o) => !o)} title="Afficher le panneau de réglages">
            <Icon name="panel-left" label="Panneau de réglages" />
          </button>
          <button type="button" className="icon-button" aria-pressed={drawer === 'outline'} onClick={() => setDrawer(drawer === 'outline' ? null : 'outline')} title="Plan de l’article">
            <Icon name="list-tree" label="Plan de l’article" />
          </button>
          <button type="button" className="icon-button" aria-pressed={drawer === 'media'} onClick={() => setDrawer(drawer === 'media' ? null : 'media')} title="Médiathèque">
            <Icon name="image" label="Médiathèque" />
          </button>
          <button type="button" className="icon-button" aria-pressed={drawer === 'datasets'} onClick={() => setDrawer(drawer === 'datasets' ? null : 'datasets')} title="Jeux de données">
            <Icon name="chart" label="Jeux de données" />
          </button>
        </nav>

        {drawer && (
          <Drawer
            mode={drawer}
            onClose={() => setDrawer(null)}
            draft={draft}
            media={media}
            datasets={datasets}
            selected={selected}
            onSelectBlock={(id) => {
              setSelectedId(id);
              document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onPickMedia={(m) => {
              if (selected?.type === 'image') updateBlock(selected.id, { mediaId: m.id, alt: selected.alt || m.alt });
              else insertBlock('image', { mediaId: m.id, alt: m.alt });
            }}
            onUpload={uploadImage}
            onUseDataset={(ds) => {
              if (selected?.type === 'chart') {
                const chartType = selected.chartType;
                replaceBlock({ ...selected, datasetId: ds.id, ...autoFields(chartType, ds), colors: {} });
              } else insertBlock('chart', { datasetId: ds.id, chartType: 'bar', ...autoFields('bar', ds), caption: `Source : ${ds.name}` });
              setTab('bloc');
            }}
          />
        )}

        <main className="writing-canvas" id="contenu" style={themeStyle(draft.themeOverride)}>
          {preview ? (
            <div className="editor-preview">
              <h1 className="article-title">{draft.title || 'Sans titre'}</h1>
              <p className="article-summary">{draft.summary}</p>
              {draft.blocks.map((b) => (
                <div className="article-block" key={b.id}>
                  <BlockView block={b} datasets={datasets} media={media} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="draft-meta">
                <span className="accent strong">{draft.status === 'published' ? 'PUBLIÉ' : 'BROUILLON'}</span>
                <span className="muted">/ {SPORTS[draft.sport]?.toUpperCase()}</span>
                <span className="muted">· {ARTICLE_TYPES[draft.type]}</span>
              </p>
              <label className="sr-only" htmlFor="title-input">
                Titre de l’article
              </label>
              <AutoTextarea
                id="title-input"
                className="title-input"
                placeholder="Titre de l’article"
                value={draft.title}
                onChange={(v) => update({ title: v }, 'title')}
              />
              <label className="sr-only" htmlFor="summary-input">
                Résumé
              </label>
              <AutoTextarea
                id="summary-input"
                className="summary-input"
                placeholder="Résumé : en une ou deux phrases, ce que le lecteur va apprendre."
                value={draft.summary}
                onChange={(v) => update({ summary: v }, 'summary')}
              />
              <BannerField banner={banner} onUpload={(f) => uploadImage(f, true)} onRemove={() => update({ bannerMediaId: null })} />

              {draft.blocks.map((block, index) => (
                <EditableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  total={draft.blocks.length}
                  selected={block.id === selectedId}
                  datasets={datasets}
                  media={media}
                  registerTextarea={(el) => {
                    textareas.current[block.id] = el;
                  }}
                  onSelect={() => setSelectedId(block.id)}
                  onChange={(patch, key) => updateBlock(block.id, patch, key)}
                  onMove={(delta) => moveBlock(block.id, delta)}
                  onRemove={() => removeBlock(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onEditData={() => {
                    setSelectedId(block.id);
                    setSidebarOpen(true);
                    setTab('bloc');
                  }}
                  onOpenMedia={() => {
                    setSelectedId(block.id);
                    setDrawer('media');
                  }}
                />
              ))}

              <NewBlockPrompt
                onSlash={() => {
                  setInsertAfter(draft.blocks[draft.blocks.length - 1]?.id || null);
                  setInsertOpen(true);
                }}
                onText={(text) => {
                  setInsertAfter(draft.blocks[draft.blocks.length - 1]?.id || null);
                  insertBlock('text', { text });
                }}
              />
            </>
          )}
        </main>

        {sidebarOpen && (
          <aside className="details-sidebar" aria-label="Réglages">
            <div className="settings-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'article'} onClick={() => setTab('article')}>
                Article
              </button>
              <button type="button" role="tab" aria-selected={tab === 'bloc'} onClick={() => setTab('bloc')}>
                Bloc
              </button>
            </div>
            {tab === 'article' ? (
              <ArticleSettings
                draft={draft}
                author={author}
                update={update}
                usedDatasets={usedDatasets}
                onAddSource={() => setDrawer('datasets')}
              />
            ) : (
              <BlockSettings
                block={selected}
                datasets={datasets}
                media={media}
                onChange={replaceBlock}
                onOpenMedia={() => setDrawer('media')}
              />
            )}
          </aside>
        )}
      </div>

      <footer className="editor-status">
        <span>
          {wordCount(draft.blocks).toLocaleString('fr-FR')} mots <span aria-hidden="true">·</span> {readingTime(draft.blocks)} min de lecture{' '}
          <span aria-hidden="true">·</span> {draft.blocks.length} blocs
        </span>
        <span>
          Article {selected && `/  Bloc ${BLOCK_LABELS[selected.type].toLowerCase()}`}
        </span>
      </footer>
    </div>
  );
}

const isTextField = (el) => el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT');

function AutoTextarea({ value, onChange, className, registerRef, ...rest }) {
  const ref = useRef(null);
  // La hauteur suit le texte… et la largeur (ouverture d'un panneau latéral, redimensionnement).
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        registerRef?.(el);
      }}
      className={`auto-textarea ${className || ''}`}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}

function InsertMenu({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const close = (e) => !ref.current?.contains(e.target) && onClose();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const items = [
    ['heading', 'Titre', 'Intertitre de section'],
    ['text', 'Texte', 'Paragraphe, liens, listes'],
    ['image', 'Image', 'Depuis la médiathèque'],
    ['chart', 'Graphique', 'Visualisation d’un jeu de données'],
    ['quote', 'Citation', 'Mise en avant'],
  ];
  return (
    <div className="insert-menu" role="menu" ref={ref}>
      {items.map(([type, label, hint]) => (
        <button key={type} type="button" role="menuitem" onClick={() => onPick(type)}>
          <strong>{label}</strong>
          <span className="muted small">{hint}</span>
        </button>
      ))}
    </div>
  );
}

function NewBlockPrompt({ onSlash, onText }) {
  const [value, setValue] = useState('');
  return (
    <div className="new-block-prompt">
      <span aria-hidden="true">+</span>
      <input
        aria-label="Nouveau bloc : tapez / pour choisir un type, ou du texte puis Entrée"
        placeholder="Tapez / pour choisir un bloc"
        value={value}
        onChange={(e) => {
          if (e.target.value === '/') {
            setValue('');
            onSlash();
          } else setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            onText(value);
            setValue('');
          }
        }}
      />
    </div>
  );
}

function BannerField({ banner, onUpload, onRemove }) {
  const input = useRef(null);
  if (banner) {
    return (
      <div className="banner-field has-image">
        <img src={banner.url} alt="" />
        <div className="banner-tools">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current.click()}>
            Remplacer
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRemove}>
            Retirer
          </button>
        </div>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} />
      </div>
    );
  }
  return (
    <button type="button" className="banner-field" onClick={() => input.current.click()}>
      <Icon name="image-plus" />
      <span className="strong small">Ajouter une bannière d’article</span>
      <span className="muted tiny">Élément graphique · ratio recommandé 16:5</span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} />
    </button>
  );
}

function EditableBlock({ block, index, total, selected, datasets, media, registerTextarea, onSelect, onChange, onMove, onRemove, onDuplicate, onEditData, onOpenMedia }) {
  let body;
  if (block.type === 'heading') {
    body = (
      <input
        className={`heading-input level-${block.level || 2}`}
        value={block.text}
        placeholder="Intertitre"
        aria-label={`Titre de niveau ${block.level || 2}`}
        onChange={(e) => onChange({ text: e.target.value }, 'text')}
      />
    );
  } else if (block.type === 'text') {
    body = (
      <AutoTextarea
        className="text-input"
        value={block.text}
        placeholder="Écrivez votre paragraphe… (**gras**, *italique*, [lien](https://…), « - » pour une liste)"
        aria-label="Paragraphe"
        registerRef={registerTextarea}
        onChange={(v) => onChange({ text: v }, 'text')}
      />
    );
  } else if (block.type === 'quote') {
    body = (
      <div className="pull-quote editing">
        <AutoTextarea className="quote-input" value={block.text} placeholder="Citation" aria-label="Citation" registerRef={registerTextarea} onChange={(v) => onChange({ text: v }, 'text')} />
        <input className="cite-input" value={block.cite || ''} placeholder="Auteur de la citation" aria-label="Auteur de la citation" onChange={(e) => onChange({ cite: e.target.value }, 'cite')} />
      </div>
    );
  } else if (block.type === 'image') {
    const m = media.find((x) => x.id === block.mediaId);
    body = m ? (
      <BlockView block={block} media={media} />
    ) : (
      <button type="button" className="banner-field" onClick={onOpenMedia}>
        <Icon name="image-plus" />
        <span className="strong small">Choisir une image dans la médiathèque</span>
        <span className="muted tiny">ou en téléverser une nouvelle</span>
      </button>
    );
  } else if (block.type === 'chart') {
    body = <ChartBlock spec={block} datasets={datasets} framed={false} />;
  }

  return (
    <div
      id={`block-${block.id}`}
      className={`editable-block type-${block.type} ${selected ? 'is-selected' : ''}`}
      onFocusCapture={onSelect}
      onMouseDown={onSelect}
    >
      {(selected || block.type === 'chart') && (
        <div className="block-toolbar">
          <span className="block-label">
            <Icon name="grip-vertical" />
            {BLOCK_LABELS[block.type].toUpperCase()}
          </span>
          <span className="block-actions">
            {block.type === 'chart' && (
              <button type="button" className="link-button small" onClick={onEditData}>
                Modifier les données <span aria-hidden="true">↗</span>
              </button>
            )}
            {selected && (
              <>
                <button type="button" className="mini" onClick={() => onMove(-1)} disabled={index === 0} title="Monter" aria-label="Monter le bloc">
                  ↑
                </button>
                <button type="button" className="mini" onClick={() => onMove(1)} disabled={index === total - 1} title="Descendre" aria-label="Descendre le bloc">
                  ↓
                </button>
                <button type="button" className="mini" onClick={onDuplicate} title="Dupliquer" aria-label="Dupliquer le bloc">
                  ⧉
                </button>
                <button type="button" className="mini danger" onClick={onRemove} title="Supprimer" aria-label="Supprimer le bloc">
                  ✕
                </button>
              </>
            )}
          </span>
        </div>
      )}
      {body}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }) {
  return (
    <details className="settings-section" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <Icon name="chevron-up" className="chev" />
      </summary>
      {children}
    </details>
  );
}

function ArticleSettings({ draft, author, update, usedDatasets, onAddSource }) {
  return (
    <>
      <Section title="Détails de l’article">
        <dl className="meta-rows">
          <div>
            <dt>Statut</dt>
            <dd className="accent">{draft.status === 'published' ? 'Publié' : 'Brouillon'}</dd>
          </div>
          <div>
            <dt>Visibilité</dt>
            <dd>Public</dd>
          </div>
          <div>
            <dt>Publication</dt>
            <dd className="accent">Immédiatement</dd>
          </div>
          <div>
            <dt>Auteur</dt>
            <dd>{author?.name}</dd>
          </div>
          <div>
            <dt>Temps de lecture</dt>
            <dd>{readingTime(draft.blocks)} min</dd>
          </div>
        </dl>
        <label className="field">
          <span>Type d’article</span>
          <select value={draft.type} onChange={(e) => update({ type: e.target.value })}>
            {Object.entries(ARTICLE_TYPES).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>URL de l’article</span>
          <input
            value={draft.slug || ''}
            placeholder={slugify(draft.title) || 'genere-depuis-le-titre'}
            onChange={(e) => update({ slug: slugify(e.target.value) }, 'slug')}
          />
        </label>
      </Section>
      <Section title="Catégories">
        <fieldset className="field">
          <legend className="sr-only">Sport</legend>
          {Object.entries(SPORTS).map(([k, label]) => (
            <label key={k} className="check">
              <input type="radio" name="sport" checked={draft.sport === k} onChange={() => update({ sport: k })} />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="field">
          <legend className="eyebrow">SUJET</legend>
          {Object.entries(TOPICS).map(([k, label]) => (
            <label key={k} className="check">
              <input type="radio" name="topic" checked={draft.topic === k} onChange={() => update({ topic: k })} />
              {label}
            </label>
          ))}
        </fieldset>
      </Section>
      <Section title="Sources de données">
        <p className="muted small">Joignez les preuves à l’appui de votre article. Les sources apparaissent sous l’article publié.</p>
        {usedDatasets.length === 0 && <p className="muted small">Aucun graphique pour l’instant.</p>}
        {usedDatasets.map((d) => (
          <div className="source-file" key={d.id}>
            <Icon name="file-spreadsheet" />
            <div>
              <p className="strong small">{d.name}</p>
              <p className="muted tiny">
                {d.rows ? `${d.rows} lignes · ` : ''}
                {d.variables.length} variables
              </p>
              <p className="accent tiny">{d.description}</p>
            </div>
          </div>
        ))}
        <button type="button" className="link-button small" onClick={onAddSource}>
          + Ajouter une source de données
        </button>
      </Section>
      <Section title="Extrait">
        <label className="field">
          <span className="sr-only">Extrait</span>
          <textarea rows={4} value={draft.summary} onChange={(e) => update({ summary: e.target.value }, 'summary')} />
        </label>
        <p className="muted tiny">Utilisé dans les aperçus d’article et les résultats de recherche.</p>
      </Section>
      <Section title="Apparence de l’article" defaultOpen={false}>
        <p className="muted small">Police et couleurs propres à cet article, appliquées par-dessus le thème du site.</p>
        <ThemeForm
          fields={ARTICLE_APPEARANCE_FIELDS}
          values={draft.themeOverride || {}}
          onChange={(v) => update({ themeOverride: Object.keys(v).length ? v : null }, 'theme')}
        />
      </Section>
    </>
  );
}

function BlockSettings({ block, datasets, media, onChange, onOpenMedia }) {
  if (!block) return <p className="settings-empty muted small">Sélectionnez un bloc dans l’article pour afficher ses réglages.</p>;
  if (block.type === 'chart') return <ChartSettings block={block} datasets={datasets} onChange={onChange} />;
  if (block.type === 'heading') {
    return (
      <div className="settings-section">
        <label className="field">
          <span>Niveau de titre</span>
          <select value={block.level || 2} onChange={(e) => onChange({ ...block, level: Number(e.target.value) })}>
            <option value={2}>Titre de section (H2)</option>
            <option value={3}>Sous-titre (H3)</option>
            <option value={4}>Petit titre (H4)</option>
          </select>
        </label>
      </div>
    );
  }
  if (block.type === 'image') {
    const m = media.find((x) => x.id === block.mediaId);
    return (
      <div className="settings-section">
        {m && <img className="thumb" src={m.url} alt="" />}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenMedia}>
          {m ? 'Changer d’image' : 'Choisir une image'}
        </button>
        <label className="field">
          <span>Texte alternatif (accessibilité)</span>
          <input value={block.alt || ''} onChange={(e) => onChange({ ...block, alt: e.target.value })} placeholder="Décrivez l’image" />
        </label>
        <label className="field">
          <span>Légende</span>
          <input value={block.caption || ''} onChange={(e) => onChange({ ...block, caption: e.target.value })} />
        </label>
      </div>
    );
  }
  return (
    <div className="settings-section">
      <p className="muted small">Mise en forme disponible dans les paragraphes :</p>
      <ul className="muted small syntax-help">
        <li>
          <code>**gras**</code>, <code>*italique*</code>
        </li>
        <li>
          <code>[texte](https://…)</code> pour un lien
        </li>
        <li>
          <code>- élément</code> pour une liste
        </li>
      </ul>
    </div>
  );
}

function Drawer({ mode, onClose, draft, media, datasets, selected, onSelectBlock, onPickMedia, onUpload, onUseDataset }) {
  const input = useRef(null);
  const titles = { outline: 'Plan de l’article', media: 'Médiathèque', datasets: 'Jeux de données' };
  return (
    <aside className="editor-drawer" aria-label={titles[mode]}>
      <div className="drawer-head">
        <p className="strong">{titles[mode]}</p>
        <button type="button" className="mini" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
      </div>
      {mode === 'outline' && (
        <ol className="outline">
          {draft.blocks.map((b) => (
            <li key={b.id} className={b.type === 'heading' ? `lvl-${b.level}` : 'is-sub'}>
              <button type="button" className={selected?.id === b.id ? 'is-active' : ''} onClick={() => onSelectBlock(b.id)}>
                <span className="muted tiny">{BLOCK_LABELS[b.type]}</span>
                {b.type === 'chart' ? b.title || 'Graphique' : (b.text || '').slice(0, 48) || '…'}
              </button>
            </li>
          ))}
        </ol>
      )}
      {mode === 'media' && (
        <>
          <p className="muted small">Chaque image ajoutée est enregistrée dans la médiathèque et réutilisable dans tous les articles.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current.click()}>
            Téléverser une image
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files[0];
              if (!f) return;
              const m = await onUpload(f);
              if (m) onPickMedia(m);
              e.target.value = '';
            }}
          />
          <div className="media-grid">
            {media.length === 0 && <p className="muted small">La médiathèque est vide.</p>}
            {media.map((m) => (
              <button type="button" key={m.id} onClick={() => onPickMedia(m)} title={m.name}>
                <img src={m.url} alt={m.alt || m.name} loading="lazy" />
              </button>
            ))}
          </div>
        </>
      )}
      {mode === 'datasets' && (
        <>
          <p className="muted small">
            {selected?.type === 'chart' ? 'Cliquez pour utiliser ce jeu dans le graphique sélectionné.' : 'Cliquez pour insérer un graphique avec ce jeu de données.'}
          </p>
          <ul className="dataset-list">
            {datasets.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onUseDataset(d)}>
                  <Icon name="file-spreadsheet" />
                  <span>
                    <strong className="small">{d.name}</strong>
                    <span className="muted tiny">
                      {d.variables.filter((v) => v.kind === 'categorical').length} catégorielle(s) ·{' '}
                      {d.variables.filter((v) => v.kind === 'numeric').length} numérique(s)
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
