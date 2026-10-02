import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Configuration distincte de « vite.config.ts » : les tests n'ont pas besoin
 * du service worker, et un service worker actif pendant les tests fausserait
 * les resultats.
 */
export default defineConfig({
  plugins: [react()],
  // Injecte en production par vite.config.ts ; valeur fixe pendant les tests.
  define: {
    __VERSION_APP__: JSON.stringify('tests'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    /*
     * Le serveur de publication de GitHub est environ trois fois plus lent que
     * le Mac. Les tests qui construisent un planning complet y frolaient la
     * limite de cinq secondes et echouaient sans qu'il y ait de vrai probleme.
     * Vingt secondes laissent de la marge sans masquer une lenteur reelle :
     * en local, le plus lourd tient en une seconde et demie.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ['./src/tests/preparation.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
    /*
     * Un test sur dix environ echouait dans « App.test.tsx » : le panneau
     * « Plus » de l'iPhone se refermait juste apres avoir ete ouvert, comme si
     * un changement d'ecran survenait au meme instant. La cause exacte n'est
     * PAS trouvee : toute sonde posee dans le code deplace le probleme. Deux
     * corrections ont deja reduit la frequence (attendre le bouton « Plus »
     * lui-meme, et remettre l'adresse a zero sans declencher « hashchange »).
     * En attendant d'en venir a bout, un seul reessai evite qu'un alea de
     * cette nature ne bloque une publication. A retirer des que la cause sera
     * identifiee : ce reessai masque un vrai defaut, il ne le corrige pas.
     */
    retry: 1,
  },
})
