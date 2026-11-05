import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { mutate, useApi } from '../api/index.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import BlockView, { headingId } from '../blocks/BlockView.jsx';
import { Category, ImagePlaceholder, StatusLabel } from '../components/ArticleCard.jsx';
import Icon from '../components/Icon.jsx';
import StarRating from '../components/StarRating.jsx';
import { useAction, useToast } from '../components/Toast.jsx';
import { SPORTS, TOPICS, formatDate, initials, readingTime } from '../constants.js';
import { themeStyle } from '../theme/themeFields.js';

export default function ArticlePage() {
  const { slug } = useParams();
  const { user } = useSession();
  const { data: article, error, loading } = useApi(() => api.articles.get(slug), [slug]);
  const { data: users = [] } = useApi(() => api.users.list(), []);
  const { data: datasets = [] } = useApi(() => api.datasets.list(), []);
  const { data: media = [] } = useApi(() => api.media.list(), []);
  const { data: themes = [] } = useApi(() => api.themes.list(), []);

  if (loading && !article) return <p className="container page-pad muted">Chargement de l’article…</p>;
  if (error || !article) return <NotFoundMessage />;

  const author = users.find((u) => u.id === article.authorId);
  const moderator = can.moderate(user);
  const editor = can.editArticle(user, article);
  const hidden =
    (article.status === 'deleted' && !moderator) ||
    (article.status === 'draft' && !editor) ||
    (author?.banned && !moderator);
  if (hidden) return <NotFoundMessage />;

  const articleTheme = themes.find((t) => t.scope === 'article' && t.target === article.id);
  return (
    <ArticleView
      article={article}
      author={author}
      users={users}
      datasets={datasets}
      media={media}
      style={{ ...themeStyle(articleTheme?.values), ...themeStyle(article.themeOverride) }}
    />
  );
}

function NotFoundMessage() {
  return (
    <section className="container page-pad">
      <h1 className="page-title">Article introuvable</h1>
      <p className="lead-sm">Cet article n’existe pas, n’est pas publié ou a été retiré par la modération.</p>
      <Link className="btn btn-primary" to="/articles">
        Retour aux articles
      </Link>
    </section>
  );
}

function ArticleView({ article, author, users, datasets, media, style }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const run = useAction();
  const toast = useToast();
  const { data: ratings = [] } = useApi(() => api.ratings.list(article.id), [article.id]);
  const [saved, setSaved] = useState(() => readBookmarks().includes(article.id));
  const headings = article.blocks.filter((b) => b.type === 'heading');
  const activeHeading = useScrollSpy(headings.map(headingId));
  const usedDatasets = datasets.filter((d) => article.blocks.some((b) => b.type === 'chart' && b.datasetId === d.id));
  const banner = media.find((m) => m.id === article.bannerMediaId);
  const moderator = can.moderate(user);
  const showPanel = moderator || can.editArticle(user, article);

  const toggleBookmark = () => {
    const list = readBookmarks();
    const next = list.includes(article.id) ? list.filter((x) => x !== article.id) : [...list, article.id];
    try {
      localStorage.setItem('touchline-bookmarks', JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setSaved(next.includes(article.id));
    toast(next.includes(article.id) ? 'Article ajouté à vos favoris.' : 'Article retiré de vos favoris.');
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: article.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Lien copié dans le presse-papiers.', 'success');
      }
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className="article-page" style={style}>
      <div className="container article-top">
        {showPanel && (
          <aside className="moderation-panel" aria-label="Actions sur l’article">
            <p className="eyebrow">{moderator ? 'APERÇU ADMINISTRATEUR' : 'VOTRE ARTICLE'}</p>
            <p className="small">
              {moderator ? 'Article en cours de modération : ' : ''}
              {article.title}
            </p>
            <p className="small muted">Auteur affecté : {author?.name}</p>
            {article.reports?.length > 0 && moderator && (
              <p className="small danger">{article.reports.length} signalement(s)</p>
            )}
            <div className="panel-actions">
              {can.editArticle(user, article) && article.status !== 'deleted' && (
                <Link className="btn btn-primary" to={`/editeur/${article.id}`}>
                  Modifier l’article
                </Link>
              )}
              {can.deleteArticle(user, article) && article.status !== 'deleted' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={async () => {
                    if (!window.confirm('Supprimer cet article ?')) return;
                    const ok = await run(mutate(api.articles.remove(article.id)), 'Article supprimé.');
                    if (ok) navigate('/articles');
                  }}
                >
                  Supprimer l’article
                </button>
              )}
              {moderator && article.status === 'deleted' && (
                <button type="button" className="btn btn-outline" onClick={() => run(mutate(api.articles.restore(article.id)), 'Article restauré.')}>
                  Restaurer l’article
                </button>
              )}
              {moderator && author && author.role !== 'admin' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    (author.banned || window.confirm(`Bannir ${author.name} ?`)) &&
                    run(mutate(api.users.setBanned(author.id, !author.banned)), author.banned ? 'Auteur réintégré.' : 'Auteur banni.')
                  }
                >
                  {author.banned ? 'Lever le bannissement' : 'Bannir l’auteur'}
                </button>
              )}
            </div>
          </aside>
        )}

        <header className="article-intro">
          <p className="breadcrumb muted small">
            <Link to="/articles">Articles</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/articles?sport=${article.sport}`}>{SPORTS[article.sport]}</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/articles?topic=${article.topic}`}>{TOPICS[article.topic]}</Link>
          </p>
          <div className="categories">
            <Category primary>{SPORTS[article.sport]?.toUpperCase()}</Category>
            <Category>{TOPICS[article.topic]?.toUpperCase()}</Category>
            {article.status !== 'published' && <StatusLabel status={article.status} />}
          </div>
          <h1 className="article-title">{article.title}</h1>
          <p className="article-summary">{article.summary}</p>
          <div className="article-meta">
            <div className="author">
              <span className="avatar" aria-hidden="true">
                {initials(author?.name)}
              </span>
              <div>
                <p className="author-name">{author?.name}</p>
                <p className="muted small">
                  {formatDate(article.publishedAt || article.updatedAt)} <span aria-hidden="true">·</span> {readingTime(article.blocks)} min de lecture
                </p>
              </div>
            </div>
            <div className="article-actions">
              <button type="button" className="icon-button" aria-pressed={saved} onClick={toggleBookmark} title="Ajouter aux favoris">
                <Icon name="bookmark" label={saved ? 'Retirer des favoris' : 'Ajouter aux favoris'} />
                {saved && <span className="dot" aria-hidden="true" />}
              </button>
              <button type="button" className="icon-button" onClick={share} title="Partager">
                <Icon name="share-2" label="Partager" />
              </button>
              {can.report(user) && !moderator && (
                <button
                  type="button"
                  className="link-button small"
                  onClick={() => run(mutate(api.articles.report(article.id, 'Contenu à vérifier')), 'Signalement envoyé à la modération.')}
                >
                  Signaler
                </button>
              )}
            </div>
          </div>
        </header>
      </div>

      <div className="container banner">
        <ImagePlaceholder sport={article.sport} media={banner} label="EMPLACEMENT DE BANNIÈRE" />
        {!banner && <p className="muted tiny">Emplacement visuel pour une photo de match ou une illustration tactique.</p>}
      </div>

      <div className="container reading-area">
        <aside className="reading-sidebar">
          {headings.length > 0 && (
            <nav aria-label="Dans cet article">
              <p className="eyebrow">DANS CET ARTICLE</p>
              <ol className="toc">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a href={`#${headingId(h)}`} className={activeHeading === headingId(h) ? 'is-active' : ''}>
                      {h.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {usedDatasets.length > 0 && (
            <div className="data-note">
              <hr />
              <p className="eyebrow">À PROPOS DES DONNÉES</p>
              {usedDatasets.map((d) => (
                <p key={d.id} className="muted small">
                  {d.description}
                </p>
              ))}
              <a href="#sources" className="text-link small">
                Voir les notes de source <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
        </aside>

        <div className="article-body">
          <BlockList
            article={article}
            datasets={datasets}
            media={media}
            ratings={ratings}
            user={user}
            run={run}
          />
          {usedDatasets.length > 0 && (
            <section className="source-notes" id="sources">
              <p className="source-title">Sources &amp; méthodologie</p>
              {usedDatasets.map((d) => (
                <p key={d.id} className="muted small">
                  <a href={d.url.startsWith('data:') ? undefined : d.url} download={d.name} className="text-link">
                    {d.name}
                  </a>{' '}
                  · {d.rows ? `${d.rows} lignes · ` : ''}
                  {d.variables.length} variables. {d.description}
                </p>
              ))}
            </section>
          )}
          <hr />
          <Comments article={article} users={users} user={user} run={run} />
        </div>
      </div>
    </div>
  );
}

// Les graphiques marqués « demi-largeur » consécutifs s'affichent côte à côte (figures 2 et 3 de la maquette).
function BlockList({ article, datasets, media, ratings, user, run }) {
  const groups = useMemo(() => {
    const out = [];
    for (const block of article.blocks) {
      const last = out[out.length - 1];
      if (block.width === 'half' && last?.half && last.items.length < 2) last.items.push(block);
      else out.push({ half: block.width === 'half', items: [block] });
    }
    return out;
  }, [article.blocks]);

  const renderBlock = (block) => {
    const blockRatings = ratings.filter((r) => r.blockId === block.id);
    const average = blockRatings.length ? blockRatings.reduce((s, r) => s + r.value, 0) / blockRatings.length : 0;
    const mine = user ? blockRatings.find((r) => r.userId === user.id)?.value : undefined;
    const ratable = block.type !== 'heading' && article.status === 'published';
    return (
      <div key={block.id} className={`article-block type-${block.type}`}>
        <BlockView block={block} datasets={datasets} media={media} />
        {ratable && (
          <StarRating
            average={average}
            count={blockRatings.length}
            mine={mine}
            onRate={can.rate(user) ? (v) => run(mutate(api.ratings.rate(article.id, block.id, v)), 'Merci pour votre note !') : undefined}
            disabledReason={!user ? 'connectez-vous en abonné pour noter' : undefined}
          />
        )}
      </div>
    );
  };

  return groups.map((g, i) =>
    g.half && g.items.length > 1 ? (
      <div key={i} className="supporting-figures">
        {g.items.map(renderBlock)}
      </div>
    ) : (
      g.items.map(renderBlock)
    ),
  );
}

function Comments({ article, users, user, run }) {
  const { data: comments = [] } = useApi(() => api.comments.list(article.id), [article.id]);
  const [text, setText] = useState('');
  const moderator = can.moderate(user);
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(mutate(api.comments.add(article.id, text)), 'Commentaire publié.');
    if (ok) setText('');
  };
  return (
    <section className="discussion" aria-labelledby="discussion-title">
      <div className="discussion-heading">
        <h2 id="discussion-title">{moderator ? 'Modération des commentaires' : 'Discussion'}</h2>
        <p className="muted small">
          {comments.length} commentaire{comments.length > 1 ? 's' : ''}
        </p>
      </div>
      {can.comment(user) ? (
        <form className="comment-composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="comment-field">
            Votre commentaire
          </label>
          <textarea
            id="comment-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Quel est votre avis ?"
            rows={3}
            maxLength={2000}
          />
          <div className="comment-actions">
            <p className="muted small">Gardez le ton réfléchi. Remettez en question les idées, pas les personnes.</p>
            <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
              Publier le commentaire
            </button>
          </div>
        </form>
      ) : (
        <p className="muted small">Connectez-vous en tant qu’abonné pour commenter et noter les blocs.</p>
      )}
      <ul className="comment-list">
        {comments.map((c) => {
          const author = users.find((u) => u.id === c.userId);
          return (
            <li key={c.id} className="comment">
              <span className="avatar small" aria-hidden="true">
                {initials(author?.name)}
              </span>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{author?.name || 'Utilisateur supprimé'}</strong>
                  <span className="muted small">{formatDate(c.createdAt)}</span>
                </div>
                <p>{c.text}</p>
                <div className="comment-tools">
                  {can.comment(user) && (
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => {
                        setText(`@${author?.name} `);
                        document.getElementById('comment-field')?.focus();
                      }}
                    >
                      Répondre
                    </button>
                  )}
                  {can.deleteComment(user, c) && (
                    <button
                      type="button"
                      className="link-button small"
                      onClick={() => run(mutate(api.comments.remove(c.id)), 'Commentaire supprimé.')}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function readBookmarks() {
  try {
    return JSON.parse(localStorage.getItem('touchline-bookmarks') || '[]');
  } catch {
    return [];
  }
}

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join('|');
  useEffect(() => {
    if (!ids.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}
