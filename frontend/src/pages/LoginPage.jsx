import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionContext.jsx';
import api from '../api/index.js';
import { ROLES } from '../api/seed.js';
import { BrandMark } from '../components/SiteChrome.jsx';
import fieldFootball from '../assets/figma/field-football.svg';

// Écran « Connexion (wireframe) » de la maquette Figma (page Admin) : formulaire à gauche, visuel à droite.
export default function LoginPage() {
  const { user, login, register, logout } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  // La création de compte n'existe qu'avec le serveur Symfony (pas en mode démonstration).
  const canRegister = api.mode === 'http';
  const [creating, setCreating] = useState(canRegister && params.get('inscription') !== null);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const emailRef = useRef(null);
  const nameRef = useRef(null);

  useEffect(() => {
    document.title = `${creating ? 'Créer un compte' : 'Connexion'} · Touchline`;
    if (!user) (creating ? nameRef : emailRef).current?.focus();
    return () => {
      document.title = 'Touchline';
    };
  }, [user, creating]);

  const switchMode = (value) => {
    setCreating(value);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (creating && password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      if (creating) await register({ name, email, password });
      else await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || (creating ? 'Création du compte impossible.' : 'Connexion impossible.'));
      setPassword('');
      setConfirm('');
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
              <h1>{creating ? 'Créer un compte' : 'Connexion'}</h1>
              <p className="muted">
                {creating
                  ? 'Votre compte abonné vous permet de noter les blocs, commenter et signaler. L’administrateur peut ensuite vous attribuer un autre rôle.'
                  : 'Accédez à votre espace pour écrire, noter, déposer des données ou modérer.'}
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {creating && (
              <label className="login-field">
                <span>Nom affiché</span>
                <input
                  ref={nameRef}
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Prénom Nom"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
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
                autoComplete={creating ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                minLength={creating ? 10 : undefined}
                aria-describedby={creating ? 'password-rule' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {creating ? (
              <>
                <p id="password-rule" className="muted small">
                  10 caractères au moins.
                </p>
                <label className="login-field">
                  <span>Confirmer le mot de passe</span>
                  <input
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </label>
              </>
            ) : (
              <>
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
              </>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || !email || !password || (creating && (!name.trim() || !confirm))}
            >
              {busy ? (creating ? 'Création…' : 'Connexion…') : creating ? 'Créer mon compte' : 'Se connecter'}
            </button>
            {canRegister ? (
              <p className="muted small">
                {creating ? 'Déjà un compte ? ' : 'Pas de compte ? '}
                <button type="button" className="link-button" onClick={() => switchMode(!creating)}>
                  {creating ? 'Se connecter' : 'Créer un compte'}
                </button>{' '}
                — ou lisez les articles <Link to="/articles">sans vous connecter</Link>.
              </p>
            ) : (
              <p className="muted small">
                Pas de compte ? Vous pouvez lire tous les articles <Link to="/articles">sans vous connecter</Link>.
              </p>
            )}
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
