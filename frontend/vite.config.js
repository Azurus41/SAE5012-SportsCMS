import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_API_URL vide => le front utilise l'API simulée (localStorage).
// Renseignée (ex. http://localhost:8080) => le front appelle l'API Symfony.
export default defineConfig({
  plugins: [react()],
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
