import { Suspense, lazy, useEffect } from 'react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import api, { useApi } from './api/index.js';
import { SiteFooter, SiteHeader } from './components/SiteChrome.jsx';
import { pageKeyFromPath, themeStyle } from './theme/themeFields.js';
import HomePage from './pages/HomePage.jsx';
import ExplorePage from './pages/ExplorePage.jsx';
import ArticlePage from './pages/ArticlePage.jsx';
import AuthorsPage from './pages/AuthorsPage.jsx';

// L'éditeur et les paramètres ne servent qu'aux contributeurs : chargés à la demande (bundle public plus léger).
const EditorPage = lazy(() => import('./editor/EditorPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));

// Thème du site + thème de la page courante (surcouche de variables CSS définies par les designers).
function useThemeStyle() {
  const { pathname } = useLocation();
  const { data: themes = [] } = useApi(() => api.themes.list(), []);
  const page = pageKeyFromPath(pathname);
  const site = themes.find((t) => t.id === 'site');
  const pageTheme = page && themes.find((t) => t.id === `page:${page}`);
  return { ...themeStyle(site?.values), ...themeStyle(pageTheme?.values) };
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function SiteLayout() {
  const style = useThemeStyle();
  return (
    <div className="app" style={style}>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu">
        <Suspense fallback={<p className="container page-pad muted">Chargement…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}

function EditorLayout() {
  const style = useThemeStyle();
  return (
    <div className="app is-editor" style={style}>
      <Suspense fallback={<p className="container page-pad muted">Chargement de l’éditeur…</p>}>
        <Outlet />
      </Suspense>
    </div>
  );
}

function NotFound() {
  return (
    <section className="container page-pad">
      <h1 className="page-title">Page introuvable</h1>
      <Link to="/" className="btn btn-primary">
        Retour à l’accueil
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="articles" element={<ExplorePage />} />
          <Route path="articles/:slug" element={<ArticlePage />} />
          <Route path="auteurs" element={<AuthorsPage />} />
          <Route path="parametres" element={<SettingsPage />} />
          <Route path="parametres/:section" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<EditorLayout />}>
          <Route path="editeur/nouveau" element={<EditorPage />} />
          <Route path="editeur/:id" element={<EditorPage />} />
        </Route>
      </Routes>
    </>
  );
}
