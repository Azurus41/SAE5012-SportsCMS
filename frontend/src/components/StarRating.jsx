import { useState } from 'react';

// Note d'un bloc de 0 à 5 étoiles (réservée aux abonnés). Groupe de boutons radio accessible au clavier.
export default function StarRating({ average, count, mine, onRate, disabledReason }) {
  const [hover, setHover] = useState(null);
  const readOnly = !onRate;
  const shown = hover ?? mine ?? Math.round(average || 0);
  return (
    <div className="star-rating">
      <div
        className="stars"
        role={readOnly ? 'img' : 'radiogroup'}
        aria-label={readOnly ? `Note moyenne ${formatAvg(average)} sur 5` : 'Noter ce bloc'}
        onMouseLeave={() => setHover(null)}
      >
        {!readOnly && (
          <button
            type="button"
            role="radio"
            aria-checked={mine === 0}
            className={`star-zero ${mine === 0 ? 'is-on' : ''}`}
            onClick={() => onRate(0)}
            title="0 étoile"
          >
            0
          </button>
        )}
        {[1, 2, 3, 4, 5].map((n) =>
          readOnly ? (
            <span key={n} className={`star ${n <= shown ? 'is-on' : ''}`} aria-hidden="true">
              ★
            </span>
          ) : (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={mine === n}
              aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
              className={`star ${n <= shown ? 'is-on' : ''}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => onRate(n)}
            >
              ★
            </button>
          ),
        )}
      </div>
      <span className="muted small">
        {count > 0 ? `${formatAvg(average)}/5 · ${count} note${count > 1 ? 's' : ''}` : 'Pas encore noté'}
        {mine !== undefined && mine !== null && ` · votre note : ${mine}`}
        {readOnly && disabledReason && ` · ${disabledReason}`}
      </span>
    </div>
  );
}

const formatAvg = (n) => (n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
