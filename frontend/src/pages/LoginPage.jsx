import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionContext.jsx';
import { ROLES } from '../api/seed.js';
import { BrandMark } from '../components/SiteChrome.jsx';
import fieldFootball from '../assets/figma/field-football.svg';

// Écran « Connexion (wireframe) » de la maquette Figma (page Admin) : formulaire à gauche, visuel à droite.
export default function LoginPage() {
  const { user, login, logout } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    document.title = 'Connexion · Touchline';
    if (!user) emailRef.current?.focus();
    return () => {
      document.title = 'Touchline';
    };
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Connexion impossible.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-panel">
        <Link to="/" className="identity" aria-label="Touchline, accueil">
          <BrandMark rounded />
          <span className="wordmark">touchline</span>
        </Link>

        {user ? (
          <div className="login-form">
            <div className="login-title">
              <h1>Vous êtes connecté</h1>
              <p className="muted">
                {user.name} · {ROLES[user.role]}
              </p>
            </div>
            <Link to={next} className="btn btn-primary btn-block">
              Continuer
            </Link>
            <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={submit} noValidate>
            <div className="login-title">
              <h1>Connexion</h1>
              <p className="muted">Accédez à votre espace pour écrire, noter, déposer des données ou modérer.</p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label className="login-field">
              <span>Adresse e-mail</span>
              <input
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="username"
                placeholder="nom@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="login-field">
              <span>Mot de passe</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="login-help">
              <button type="button" className="link-button" aria-expanded={forgot} onClick={() => setForgot((f) => !f)}>
                Mot de passe oublié ?
              </button>
            </div>
            {forgot && (
              <p className="muted small" role="status">
                Demandez à l’administrateur du site de réinitialiser votre mot de passe.
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || !password}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="muted small">
              Pas de compte ? Vous pouvez lire tous les articles <Link to="/articles">sans vous connecter</Link>.
            </p>
          </form>
        )}

        <p className="muted small">© 2026 Touchline. Tous droits réservés.</p>
      </div>
      <div className="login-visual" aria-hidden="true">
        <img src={fieldFootball} width="360" height="172" alt="" />
        <p>LE SPORT RACONTÉ PAR LES DONNÉES</p>
      </div>
    </div>
  );
}

// Redirection après connexion : uniquement vers une page interne du site.
function safeNext(value) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
