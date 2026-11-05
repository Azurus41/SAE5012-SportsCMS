import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './styles/global.css';
import App from './App.jsx';
import { SessionProvider } from './auth/SessionContext.jsx';
import { ToastProvider } from './components/Toast.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* basename : l'application peut être servie dans un sous-dossier (VITE_BASE, ex. /touchdown/). */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <SessionProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
