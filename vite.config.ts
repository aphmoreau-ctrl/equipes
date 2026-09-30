import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import paquet from './package.json' with { type: 'json' }

/**
 * Le site est publie dans un sous-dossier de GitHub Pages :
 * https://aphmoreau-ctrl.github.io/equipes/
 * Tous les chemins doivent donc etre prefixes par « /equipes/ ».
 */
const BASE = '/equipes/'

/** Identifiant court de la version publiee, affiche dans l'ecran Parametres. */
function repereDeVersion(): string {
  const dateDuJour = new Date().toISOString().slice(0, 10)
  let revision = 'local'
  try {
    revision = (process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD').toString()).slice(0, 7)
  } catch {
    // Pas de depot git disponible : on garde « local ».
  }
  return `${paquet.version} · ${dateDuJour} · ${revision}`
}

export default defineConfig({
  base: BASE,
  define: {
    __VERSION_APP__: JSON.stringify(repereDeVersion()),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  plugins: [
    react(),
    VitePWA({
      // « prompt » : l'application propose la mise a jour au lieu de l'imposer.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        id: BASE,
        name: 'Équipes',
        short_name: 'Équipes',
        description: 'Gestion des équipes du service Frais',
        lang: 'fr',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b2015',
        theme_color: '#14532d',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        // Desactive en developpement : un service worker actif rend la mise au point confuse.
        enabled: false,
      },
    }),
  ],
})
