import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './ui/App'
import { MajDisponible } from './ui/MajDisponible'
import './ui/styles.css'

const racine = document.getElementById('racine')
if (racine === null) {
  throw new Error('L’élément « racine » est introuvable dans index.html.')
}

/**
 * Routage par diese (« #/planning ») : GitHub Pages ne sait pas rediriger
 * les adresses profondes vers l'application. Avec le diese, actualiser la
 * page ou ouvrir un lien direct fonctionne toujours, en ligne comme hors ligne.
 */
createRoot(racine).render(
  <StrictMode>
    <HashRouter>
      <App />
      <MajDisponible />
    </HashRouter>
  </StrictMode>,
)
