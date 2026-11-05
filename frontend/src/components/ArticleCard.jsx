import { Link } from 'react-router-dom';
import { FIELD_BY_SPORT, SPORTS, formatDate, readingTime } from '../constants.js';

export function ImagePlaceholder({ sport, label = 'ILLUSTRATION ÉDITORIALE', media, height }) {
  if (media) {
    return (
      <div className="image-placeholder has-image" style={{ height }}>
        <img src={media.url} alt={media.alt || ''} loading="lazy" />
      </div>
    );
  }
  return (
    <div className="image-placeholder" style={{ height }}>
      <img src={FIELD_BY_SPORT[sport] || FIELD_BY_SPORT.football} width="180" height="86" alt="" />
      <p>{label}</p>
    </div>
  );
}

export function Category({ children, primary = false }) {
  return <span className={`category ${primary ? 'is-primary' : ''}`}>{children}</span>;
}

export default function ArticleCard({ article, author, media, compact = false, highlightFirst = false, children, placeholderLabel }) {
  const minutes = readingTime(article.blocks);
  return (
    <article className={`article-card ${compact ? 'is-compact' : ''}`}>
      <Link to={`/articles/${article.slug}`} className="card-link" aria-label={article.title}>
        <ImagePlaceholder sport={article.sport} media={media} label={placeholderLabel} />
      </Link>
      <div className="preview-copy">
        <div className="classification">
          <Category primary={highlightFirst}>{(SPORTS[article.sport] || article.sport).toUpperCase()}</Category>
          <span className="muted small">
            {minutes} min{compact ? '' : ' de lecture'}
          </span>
        </div>
        <h3 className="card-title">
          <Link to={`/articles/${article.slug}`}>{article.title}</Link>
        </h3>
        <p className="card-summary">{article.summary}</p>
        <p className="muted small byline">
          {author?.name || 'Auteur inconnu'}
          <span aria-hidden="true"> · </span>
          {article.status === 'published' ? formatDate(article.publishedAt) : <StatusLabel status={article.status} />}
          {author?.banned && <span className="status-pill is-danger">auteur banni</span>}
        </p>
      </div>
      {children}
    </article>
  );
}

export function StatusLabel({ status }) {
  const labels = { draft: 'Brouillon', published: 'Publié', deleted: 'Supprimé' };
  return <span className={`status-pill is-${status}`}>{labels[status] || status}</span>;
}
