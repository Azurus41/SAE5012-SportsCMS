import { Link } from 'react-router-dom';
import api, { mutate, useApi } from '../api/index.js';
import { ROLES } from '../api/seed.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import { useAction } from '../components/Toast.jsx';
import { initials } from '../constants.js';

export default function AuthorsPage() {
  const { user } = useSession();
  const run = useAction();
  const { data: users = [] } = useApi(() => api.users.list(), []);
  const { data: articles = [] } = useApi(() => api.articles.list(), []);
  const { data: ratings = [] } = useApi(() => api.ratings.summary(), []);
  const moderator = can.moderate(user);

  const writers = users.filter((u) => ['author', 'editor', 'admin'].includes(u.role) && (moderator || !u.banned));
  return (
    <section className="container page-pad">
      <p className="eyebrow accent">{moderator ? 'GESTION DES AUTEURS' : 'LA RÉDACTION'}</p>
      <h1 className="page-title">Auteurs</h1>
      <p className="lead-sm">
        {moderator ? 'Suivez l’activité des auteurs et appliquez des mesures de modération.' : 'Les journalistes et analystes qui racontent le sport par les données.'}
      </p>
      <ul className="author-list">
        {writers.map((u) => {
          const own = articles.filter((a) => a.authorId === u.id && a.status === 'published');
          const notes = ratings.filter((r) => own.some((a) => a.id === r.articleId));
          const count = notes.reduce((s, r) => s + r.count, 0);
          const avg = count ? notes.reduce((s, r) => s + r.average * r.count, 0) / count : null;
          return (
            <li key={u.id} className={`author-card ${u.banned ? 'is-banned' : ''}`}>
              <span className="avatar" aria-hidden="true">
                {initials(u.name)}
              </span>
              <div className="author-info">
                <p className="strong">
                  {u.name} {u.banned && <span className="status-pill is-danger">banni</span>}
                </p>
                <p className="muted small">
                  {ROLES[u.role]} · {own.length} article{own.length > 1 ? 's' : ''} publié{own.length > 1 ? 's' : ''}
                  {avg !== null && ` · note moyenne ${avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}/5`}
                </p>
                {own.length > 0 && (
                  <p className="small">
                    Dernier : <Link to={`/articles/${own[0].slug}`}>{own[0].title}</Link>
                  </p>
                )}
              </div>
              {moderator && u.role !== 'admin' && (
                <button
                  type="button"
                  className={`btn btn-sm ${u.banned ? 'btn-secondary' : 'btn-danger'}`}
                  onClick={() =>
                    (u.banned || window.confirm(`Bannir ${u.name} ?`)) &&
                    run(mutate(api.users.setBanned(u.id, !u.banned)), u.banned ? 'Auteur réintégré.' : 'Auteur banni.')
                  }
                >
                  {u.banned ? 'Lever le bannissement' : 'Bannir l’auteur'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
