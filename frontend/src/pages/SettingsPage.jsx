import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import api from '../api/index.js';
import { useSession } from '../auth/SessionContext.jsx';
import can from '../auth/permissions.js';
import DatasetsPanel from './DatasetsPanel.jsx';
import ThemePanel from './ThemePanel.jsx';

export default function SettingsPage() {
  const { section } = useParams();
  const { user, ready } = useSession();
  if (!ready) return null;
  const tabs = [
    can.manageDatasets(user) && ['donnees', 'Jeux de données'],
    can.editTheme(user) && ['theme', 'Thème'],
  ].filter(Boolean);

  if (!tabs.length) {
    return (
      <section className="container page-pad">
        <h1 className="page-title">Paramètres</h1>
        <p className="lead-sm">
          Cet espace est réservé aux fournisseurs de données, aux designers et aux administrateurs.
        </p>
        {!user && (
          <Link to="/connexion?next=/parametres" className="btn btn-primary">
            Se connecter
          </Link>
        )}
      </section>
    );
  }
  if (!section || !tabs.some(([k]) => k === section)) return <Navigate to={`/parametres/${tabs[0][0]}`} replace />;

  return (
    <div className="container page-pad settings-page">
      <p className="eyebrow accent">PARAMÈTRES</p>
      <h1 className="page-title">Données et apparence du site</h1>
      <nav className="settings-nav" aria-label="Sections des paramètres">
        {tabs.map(([k, label]) => (
          <NavLink key={k} to={`/parametres/${k}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      {section === 'donnees' ? <DatasetsPanel /> : <ThemePanel />}
      {api.mode === 'mock' && user.role === 'admin' && (
        <p className="muted tiny reset-demo">
          Mode démonstration (données dans ce navigateur).{' '}
          <button
            type="button"
            className="link-button tiny"
            onClick={async () => {
              if (!window.confirm('Remettre toutes les données de démonstration à zéro ?')) return;
              await api.reset();
              window.location.reload();
            }}
          >
            Réinitialiser la démo
          </button>
        </p>
      )}
    </div>
  );
}
