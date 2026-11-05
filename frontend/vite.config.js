import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_API_URL vide => le front utilise l'API simulée (localStorage).
// Renseignée (ex. http://localhost:8080) => le front appelle l'API Symfony.
// VITE_BASE => sous-dossier de publication (ex. /touchdown/ pour deepdraft.fr/touchdown/).
const base = process.env.VITE_BASE || '/';

// Génère le .htaccess d'Apache (alwaysdata) avec le bon sous-dossier.
function htaccess() {
  return {
    name: 'touchline-htaccess',
    apply: 'build',
    closeBundle() {
      const template = readFileSync(new URL('./htaccess.template', import.meta.url), 'utf8');
      writeFileSync(new URL('./dist/.htaccess', import.meta.url), template.replaceAll('__BASE__', base));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), htaccess()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // three.js n'est chargé que par la page d'accueil : on l'isole dans son propre fichier.
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: { environment: 'node' },
});
