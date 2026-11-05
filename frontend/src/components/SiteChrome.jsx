import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import api, { useApi } from '../api/index.js';
import { ROLES } from '../api/seed.js';

export function BrandMark({ large = false }) {
  return (
    <span className={`brand-mark ${large ? 'is-large' : ''}`} aria-hidden="true">
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
            <AccountSwitcher />
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

// Connexion de démonstration : en attendant l'authentification Symfony, on choisit un compte par rôle.
function AccountSwitcher() {
  const { user, login } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { data: users = [] } = useApi(() => api.users.list(), []);

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

  const label = user ? ROLES[user.role] : 'Se connecter';
  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className={user ? 'role-badge' : 'btn btn-secondary'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title={user ? `Connecté : ${user.name}` : undefined}
      >
        {label}
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <p className="eyebrow">Compte de démonstration</p>
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              role="menuitemradio"
              aria-checked={user?.id === u.id}
              onClick={() => {
                login(u.id);
                setOpen(false);
              }}
            >
              <span>{u.name}</span>
              <small>
                {ROLES[u.role]}
                {u.banned ? ' · banni' : ''}
              </small>
            </button>
          ))}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!user}
            onClick={() => {
              login(null);
              setOpen(false);
            }}
          >
            <span>Se déconnecter</span>
            <small>Visiteur</small>
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
