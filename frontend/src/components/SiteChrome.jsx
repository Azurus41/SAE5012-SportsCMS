import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import { ROLES } from '../api/seed.js';
import { initials } from '../constants.js';

export function BrandMark({ large = false, rounded = false }) {
  return (
    <span className={`brand-mark ${large ? 'is-large' : ''} ${rounded ? 'is-rounded' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function SiteHeader() {
  const { user } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  const showSettings = can.editTheme(user) || can.manageDatasets(user);

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link to="/" className="identity" aria-label="Touchline, accueil">
          <BrandMark />
          <span className="wordmark">touchline</span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
        </button>
        <div id="site-menu" className={`header-menu ${menuOpen ? 'is-open' : ''}`}>
          <nav aria-label="Navigation principale" className="menu">
            <NavLink to="/" end>
              Tableau de bord
            </NavLink>
            <NavLink to="/articles">Articles</NavLink>
            <NavLink to="/auteurs">Auteurs</NavLink>
            {showSettings && <NavLink to="/parametres">Paramètres</NavLink>}
          </nav>
          <div className="account-actions">
            <AccountMenu />
            {can.createArticle(user) && (
              <Link to="/editeur/nouveau" className="btn btn-primary">
                Publier un article
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Non connecté : bouton « Connexion » (maquette). Connecté : badge du rôle + menu du compte.
function AccountMenu() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return (
      <Link to={`/connexion?next=${next}`} className="btn btn-secondary">
        Connexion
      </Link>
    );
  }

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="role-badge"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={`Connecté : ${user.name}`}
      >
        {ROLES[user.role]}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-who">
            <span className="avatar small" aria-hidden="true">
              {initials(user.name)}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout();
              navigate('/');
            }}
          >
            <span>Se déconnecter</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  const { user } = useSession();
  const admin = user?.role === 'admin';
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-nav">
          <div className="brand-statement">
            <p className="wordmark">touchline</p>
            <p className="muted">
              {admin
                ? 'Administration du CMS sportif. Vue réservée aux modérateurs.'
                : 'Voix indépendantes. Une meilleure vue du sport.'}
            </p>
          </div>
          <nav className="footer-links" aria-label="Pied de page">
            <Link to="/">Tableau de bord</Link>
            <Link to="/articles">Articles</Link>
            <Link to="/auteurs">Auteurs</Link>
            <Link to="/parametres">Paramètres</Link>
          </nav>
        </div>
        <div className="legal">
          <p>© 2026 Touchline. {admin ? 'Administration du CMS.' : 'Toutes les perspectives sont bienvenues.'}</p>
          <p>
            <a href="#confidentialite">Politique de confidentialité</a>
            <span aria-hidden="true">/</span>
            <a href="#conditions">Conditions d’utilisation</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
