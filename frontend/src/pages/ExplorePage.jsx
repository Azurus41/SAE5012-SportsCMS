import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { mutate, useApi } from '../api/index.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import ArticleCard from '../components/ArticleCard.jsx';
import Icon from '../components/Icon.jsx';
import { useAction } from '../components/Toast.jsx';
import { SPORTS, TOPICS, readingTime } from '../constants.js';

const PAGE_SIZE = 6;
const DATES = { all: 'Toutes les dates', '30d': '30 derniers jours', '90d': '3 derniers mois', year: 'Cette année' };
const TIMES = { short: 'Moins de 5 min', medium: '5–10 min', long: '10+ min' };
const SORTS = { recent: 'Plus récents', old: 'Plus anciens', rating: 'Mieux notés', time: 'Lecture la plus courte' };
const MODERATION = { all: 'Tous les statuts', reports: 'Signalements', banned: 'Auteurs bannis', deleted: 'Articles supprimés' };
const STATUS = { published: 'Publiés', draft: 'Brouillons' };

export default function ExplorePage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const search = useRef(null);
  const run = useAction();
  const { data: articles = [], loading } = useApi(() => api.articles.list(), []);
  const { data: users = [] } = useApi(() => api.users.list(), []);
  const { data: media = [] } = useApi(() => api.media.list(), []);
  const { data: ratingSummary = [] } = useApi(() => api.ratings.summary(), []);

  const get = (k, d = '') => params.get(k) ?? d;
  const getList = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => {
      if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };
  const toggleIn = (k, value) => {
    const list = getList(k);
    update({ [k]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] });
  };

  // ⌘K / Ctrl+K place le curseur dans la recherche (comme indiqué dans la maquette).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const q = get('q');
  const sports = getList('sport');
  const topics = getList('topic');
  const date = get('date', 'all');
  const times = getList('time');
  const moderation = get('moderation', 'all');
  const status = get('status', 'published');
  const sort = get('sort', 'recent');
  const page = Number(get('page', '1')) || 1;
  const moderator = can.moderate(user);

  const byId = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const base = useMemo(
    () =>
      articles.filter((a) => {
        const author = byId[a.authorId];
        if (moderator) {
          if (moderation === 'deleted') return a.status === 'deleted';
          if (a.status === 'deleted') return false;
          if (moderation === 'reports') return a.reports?.length > 0;
          if (moderation === 'banned') return author?.banned;
          return true;
        }
        if (author?.banned || a.status === 'deleted') return false;
        if (can.seeDrafts(user) && status === 'draft') {
          return a.status === 'draft' && (user.role !== 'author' || a.authorId === user.id);
        }
        return a.status === 'published';
      }),
    [articles, byId, moderator, moderation, status, user],
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const avg = Object.fromEntries(ratingSummary.map((r) => [r.articleId, r.average]));
    const needle = q.trim().toLowerCase();
    const list = base.filter((a) => {
      if (sports.length && !sports.includes(a.sport)) return false;
      if (topics.length && !topics.includes(a.topic)) return false;
      const minutes = readingTime(a.blocks);
      if (times.length) {
        const bucket = minutes < 5 ? 'short' : minutes <= 10 ? 'medium' : 'long';
        if (!times.includes(bucket)) return false;
      }
      if (date !== 'all') {
        const when = new Date(a.publishedAt || a.updatedAt || 0);
        const days = (now - when) / 86400000;
        if (date === '30d' && days > 30) return false;
        if (date === '90d' && days > 90) return false;
        if (date === 'year' && when.getFullYear() !== now.getFullYear()) return false;
      }
      if (needle) {
        const hay = [a.title, a.summary, byId[a.authorId]?.name, SPORTS[a.sport], TOPICS[a.topic]].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const key = (a) => a.publishedAt || a.updatedAt || '';
    const sorters = {
      recent: (a, b) => key(b).localeCompare(key(a)),
      old: (a, b) => key(a).localeCompare(key(b)),
      time: (a, b) => readingTime(a.blocks) - readingTime(b.blocks),
      rating: (a, b) => (avg[b.id] || 0) - (avg[a.id] || 0),
    };
    return [...list].sort(sorters[sort] || sorters.recent);
  }, [base, sports, topics, times, date, q, sort, byId, ratingSummary]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const count = (pred) => base.filter(pred).length;

  const chips = [
    date !== 'all' && { label: DATES[date], clear: { date: null } },
    ...sports.map((s) => ({ label: SPORTS[s], clear: { sport: sports.filter((x) => x !== s) } })),
    ...topics.map((t) => ({ label: TOPICS[t], clear: { topic: topics.filter((x) => x !== t) } })),
    ...times.map((t) => ({ label: TIMES[t], clear: { time: times.filter((x) => x !== t) } })),
    moderator && moderation !== 'all' && { label: MODERATION[moderation], clear: { moderation: null } },
  ].filter(Boolean);

  return (
    <>
      <section className="container browse-intro">
        <p className="eyebrow accent">{moderator ? 'MODÉRATION TOUCHLINE' : 'BIBLIOTHÈQUE TOUCHLINE'}</p>
        <h1 className="page-title">{moderator ? 'Gérez les articles et les auteurs.' : 'Explorez les articles.'}</h1>
        <p className="lead-sm">
          {moderator
            ? 'Recherchez, modérez et prenez des décisions administratives sur les contenus publiés.'
            : 'Recherchez une analyse par sport, par sujet ou par auteur.'}
        </p>
        <label className="search-field">
          <Icon name="search" />
          <span className="sr-only">Rechercher</span>
          <input
            ref={search}
            type="search"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={moderator ? 'Rechercher des articles, des auteurs ou des signalements' : 'Rechercher des articles ou des auteurs'}
          />
          <kbd>⌘ K</kbd>
        </label>
      </section>

      <section className="container library">
        <details className="filters" open>
          <summary>
            <span className="filters-title">Filtres</span>
            <button type="button" className="link-button small" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Réinitialiser
            </button>
          </summary>
          <FilterGroup title="SPORT">
            <Check checked={!sports.length} onChange={() => update({ sport: [] })} label="Tous les sports" count={base.length} />
            {Object.entries(SPORTS).map(([k, label]) => (
              <Check
                key={k}
                checked={sports.includes(k)}
                onChange={() => toggleIn('sport', k)}
                label={label}
                count={count((a) => a.sport === k)}
              />
            ))}
          </FilterGroup>
          <hr />
          <FilterGroup title="SUJET">
            <Check checked={!topics.length} onChange={() => update({ topic: [] })} label="Tous les sujets" />
            {Object.entries(TOPICS).map(([k, label]) => (
              <Check key={k} checked={topics.includes(k)} onChange={() => toggleIn('topic', k)} label={label} />
            ))}
          </FilterGroup>
          <hr />
          <FilterGroup title="PUBLIÉ">
            <label className="select-field">
              <span className="sr-only">Date de publication</span>
              <select value={date} onChange={(e) => update({ date: e.target.value === 'all' ? null : e.target.value })}>
                {Object.entries(DATES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" />
            </label>
          </FilterGroup>
          <FilterGroup title="TEMPS DE LECTURE">
            {Object.entries(TIMES).map(([k, label]) => (
              <Check key={k} checked={times.includes(k)} onChange={() => toggleIn('time', k)} label={label} />
            ))}
          </FilterGroup>
          {moderator && (
            <>
              <hr />
              <FilterGroup title="MODÉRATION">
                {Object.entries(MODERATION).map(([k, label]) => (
                  <Check
                    key={k}
                    type="radio"
                    checked={moderation === k}
                    onChange={() => update({ moderation: k === 'all' ? null : k })}
                    label={label}
                  />
                ))}
              </FilterGroup>
            </>
          )}
          {!moderator && can.seeDrafts(user) && (
            <>
              <hr />
              <FilterGroup title="STATUT">
                {Object.entries(STATUS).map(([k, label]) => (
                  <Check
                    key={k}
                    type="radio"
                    checked={status === k}
                    onChange={() => update({ status: k === 'published' ? null : k })}
                    label={user.role === 'author' && k === 'draft' ? 'Mes brouillons' : label}
                  />
                ))}
              </FilterGroup>
            </>
          )}
        </details>

        <div className="results">
          <div className="results-controls">
            <div className="result-count">
              <strong>
                {filtered.length} article{filtered.length > 1 ? 's' : ''}
              </strong>
              {chips.map((c) => (
                <button key={c.label} type="button" className="applied-filter" onClick={() => update(c.clear)}>
                  {c.label} <span aria-hidden="true">×</span>
                  <span className="sr-only">(retirer le filtre)</span>
                </button>
              ))}
            </div>
            <label className="sort-control">
              <span className="muted small">Trier par</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value === 'recent' ? null : e.target.value })}>
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" />
            </label>
          </div>
          <hr />
          {loading && !articles.length ? (
            <p className="muted">Chargement…</p>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <p>Aucun article ne correspond à ces critères.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                Effacer les filtres
              </button>
            </div>
          ) : (
            <div className="card-grid">
              {visible.map((a) => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  author={byId[a.authorId]}
                  media={media.find((m) => m.id === a.bannerMediaId)}
                  highlightFirst={a.sport === 'football'}
                  placeholderLabel="EMPLACEMENT D’IMAGE"
                  compact
                >
                  <CardActions article={a} author={byId[a.authorId]} user={user} run={run} />
                </ArticleCard>
              ))}
            </div>
          )}
          <hr />
          <nav className="pagination" aria-label="Pagination">
            <p className="muted small">
              {filtered.length ? `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)}` : 0} sur{' '}
              {filtered.length} articles
            </p>
            <div className="pages">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`page ${n === current ? 'is-current' : ''}`}
                  aria-current={n === current ? 'page' : undefined}
                  onClick={() => update({ page: n === 1 ? null : String(n) })}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="link-button next"
                disabled={current >= pages}
                onClick={() => update({ page: String(current + 1) })}
              >
                Suivant <span aria-hidden="true">→</span>
              </button>
            </div>
          </nav>
        </div>
      </section>
    </>
  );
}

function CardActions({ article, author, user, run }) {
  const moderator = can.moderate(user);
  const editable = can.editArticle(user, article) && article.status !== 'deleted';
  if (!moderator && !editable) return null;
  return (
    <div className="moderation-actions">
      {editable && (
        <Link className="btn btn-secondary btn-sm" to={`/editeur/${article.id}`}>
          Modifier
        </Link>
      )}
      {moderator && article.status !== 'deleted' && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() =>
            window.confirm(`Supprimer « ${article.title} » ? Il restera consultable dans « Articles supprimés ».`) &&
            run(mutate(api.articles.remove(article.id)), 'Article supprimé.')
          }
        >
          Supprimer l’article
        </button>
      )}
      {moderator && article.status === 'deleted' && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(mutate(api.articles.restore(article.id)), 'Article restauré.')}>
          Restaurer
        </button>
      )}
      {moderator && article.reports?.length > 0 && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(mutate(api.articles.clearReports(article.id)), 'Signalements traités.')}>
          Classer {article.reports.length} signalement{article.reports.length > 1 ? 's' : ''}
        </button>
      )}
      {moderator && author && author.role !== 'admin' && (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() =>
            (author.banned || window.confirm(`Bannir ${author.name} ? Ses articles seront masqués du public.`)) &&
            run(mutate(api.users.setBanned(author.id, !author.banned)), author.banned ? 'Auteur réintégré.' : 'Auteur banni.')
          }
        >
          {author.banned ? 'Lever le bannissement' : 'Bannir l’auteur'}
        </button>
      )}
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <fieldset className="filter-group">
      <legend className="eyebrow">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({ checked, onChange, label, count, type = 'checkbox' }) {
  return (
    <label className={`filter-option ${checked ? 'is-checked' : ''}`}>
      <input type={type} checked={checked} onChange={onChange} />
      <span className="box" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
      <span className="option-label">{label}</span>
      {count !== undefined && <span className="muted small">{count}</span>}
    </label>
  );
}
