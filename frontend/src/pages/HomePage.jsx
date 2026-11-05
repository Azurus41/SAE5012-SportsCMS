import { Suspense, lazy, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { useApi } from '../api/index.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import ArticleCard from '../components/ArticleCard.jsx';
import wireframeCube from '../assets/figma/wireframe-cube.svg';

const SportsOrbit = lazy(() => import('../components/SportsOrbit.jsx'));
const ORBIT_SPORTS = [
  ['football', 'Football'],
  ['basketball', 'Basket-ball'],
  ['tennis', 'Tennis'],
  ['athletisme', 'Athlétisme'],
];

// Accueil : page de présentation de l'outil (texte + objet 3D WebGL), version admin = tableau de bord.
export default function HomePage() {
  const { user } = useSession();
  const admin = user?.role === 'admin';
  const { data: articles = [] } = useApi(() => api.articles.list(), []);
  const { data: users = [] } = useApi(() => api.users.list(), []);
  const { data: media = [] } = useApi(() => api.media.list(), []);
  const navigate = useNavigate();
  const [webgl, setWebgl] = useState(true);
  const [focusSport, setFocusSport] = useState(null);
  const onPick = useCallback((sport) => navigate(`/articles?sport=${sport}`), [navigate]);
  const onFail = useCallback(() => setWebgl(false), []);
  const creator = can.createArticle(user);

  const banned = new Set(users.filter((u) => u.banned).map((u) => u.id));
  const latest = articles
    .filter((a) => a.status === 'published' && !banned.has(a.authorId))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const stats = admin && {
    published: articles.filter((a) => a.status === 'published').length,
    drafts: articles.filter((a) => a.status === 'draft').length,
    reports: articles.filter((a) => a.reports?.length).length,
    banned: banned.size,
  };

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow accent">{admin ? 'TABLEAU DE BORD ADMINISTRATIF' : 'DATA STORYTELLING SPORTIF'}</p>
          <h1 className="display">
            {admin ? (
              <>
                Gérer le contenu.
                <br />
                Contrôler la plateforme.
              </>
            ) : (
              <>
                Le sport raconté
                <br />
                par les données.
              </>
            )}
          </h1>
          <p className="lead">
            {admin
              ? 'Suivez les publications, modérez les auteurs et gérez les articles depuis une vue administrative claire et centralisée.'
              : 'Touchline est un CMS où les auteurs transforment des jeux de données sportifs en récits : textes, images et visualisations interactives, notés bloc par bloc par les abonnés.'}
          </p>
          <div className="hero-actions">
            <Link to="/articles" className="btn btn-primary btn-lg">
              Voir les articles <span aria-hidden="true">→</span>
            </Link>
            {can.createArticle(user) ? (
              <Link to="/editeur/nouveau" className="btn btn-secondary btn-lg">
                Nouveau brouillon
              </Link>
            ) : (
              <Link to="/articles/le-pressing-haut-change-le-jeu" className="btn btn-secondary btn-lg">
                Lire un exemple
              </Link>
            )}
          </div>
          <p className="muted small">
            {admin
              ? 'Vue administrative pour les modérateurs et administrateurs de la plateforme.'
              : 'Données de démonstration illustratives. Choisissez un rôle avec le bouton « Se connecter ».'}
          </p>
        </div>

        <div className="shape-panel">
          <div className="shape-heading">
            <span>OBJET / 001</span>
            <span>SPORTS EN ORBITE</span>
          </div>
          {webgl ? (
            <Suspense fallback={<img className="shape-fallback" src={wireframeCube} width="270" height="270" alt="" />}>
              <SportsOrbit onPick={onPick} onFail={onFail} focusKey={focusSport} />
            </Suspense>
          ) : (
            <img className="shape-fallback" src={wireframeCube} width="270" height="270" alt="" />
          )}
          <Link to={creator ? '/editeur/nouveau' : '/articles'} className="btn btn-primary orbit-cta">
            {creator ? 'Créer un article' : 'Lire les articles'}
          </Link>
          <div className="shape-caption">
            <div>
              <p className="shape-title">CHOISISSEZ VOTRE SPORT</p>
              <ul className="orbit-links">
                {ORBIT_SPORTS.map(([key, label]) => (
                  <li key={key}>
                    <Link
                      to={`/articles?sport=${key}`}
                      onMouseEnter={() => setFocusSport(key)}
                      onMouseLeave={() => setFocusSport(null)}
                      onFocus={() => setFocusSport(key)}
                      onBlur={() => setFocusSport(null)}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <p className="muted tiny">Survolez un objet · cliquez pour ses articles</p>
          </div>
        </div>
      </section>

      <section className="editorial-intro">
        <div className="container editorial-intro-inner">
          <p className="eyebrow">{admin ? 'MODÉRATION AU PREMIER PLAN.' : 'DES DONNÉES, PAS DES SLOGANS.'}</p>
          <p className="intro-text">
            {admin
              ? 'Cette vue administrative permet de superviser les publications, d’appliquer des mesures de modération et de gérer les auteurs depuis une même interface.'
              : 'Chaque article s’appuie sur des jeux de données déposés par nos fournisseurs. Les visualisations sont générées à la lecture : barres, camemberts, courbes, nuages de points et histogrammes.'}
          </p>
        </div>
      </section>

      {stats && (
        <section className="container admin-stats" aria-label="Indicateurs de modération">
          <Stat value={stats.published} label="Articles publiés" />
          <Stat value={stats.drafts} label="Brouillons" />
          <Stat value={stats.reports} label="Articles signalés" to="/articles?moderation=reports" />
          <Stat value={stats.banned} label="Auteurs bannis" to="/auteurs" />
        </section>
      )}

      <section className="container latest">
        <div className="section-heading">
          <h2>Dernières publications</h2>
          <Link to="/articles" className="text-link">
            Voir toutes les publications <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="card-grid">
          {latest.map((a, i) => (
            <ArticleCard
              key={a.id}
              article={a}
              author={users.find((u) => u.id === a.authorId)}
              media={media.find((m) => m.id === a.bannerMediaId)}
              highlightFirst={i === 0}
            />
          ))}
        </div>
      </section>

      <section className="writer-invitation">
        <div className="container writer-invitation-inner">
          <div>
            <h2>{admin ? 'Créez, modérez et publiez.' : 'Racontez votre sport avec des données.'}</h2>
            <p className="muted">
              {admin
                ? 'Ajoutez des publications officielles, gérez les auteurs et appliquez des mesures de modération depuis la même interface.'
                : 'Les auteurs composent leurs articles bloc par bloc et choisissent leurs visualisations parmi les jeux de données du site.'}
            </p>
          </div>
          {can.createArticle(user) ? (
            <Link to="/editeur/nouveau" className="btn btn-primary btn-lg">
              {admin ? 'Créer une publication officielle' : 'Écrire un article'} <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <Link to="/articles" className="btn btn-primary btn-lg">
              Explorer les articles <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </section>
    </>
  );
}

function Stat({ value, label, to }) {
  const content = (
    <>
      <span className="stat-value">{value}</span>
      <span className="muted small">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className="stat">
      {content}
    </Link>
  ) : (
    <div className="stat">{content}</div>
  );
}
