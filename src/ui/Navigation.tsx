import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icone } from './Icone'
import { MODULES, modulesPrincipaux, modulesSecondaires } from './modules'
import type { Module } from './modules'

function Marque({ taille }: { readonly taille: 'grande' | 'petite' }) {
  return (
    <p className={taille === 'grande' ? 'navigation__marque' : 'navigation__marque navigation__marque--petite'}>
      <span className="navigation__logo" aria-hidden="true">
        É
      </span>
      <span>Équipes</span>
    </p>
  )
}

function classeLien({ isActive }: { isActive: boolean }): string {
  return isActive ? 'lien-module lien-module--actif' : 'lien-module'
}

function LienModule({ module }: { readonly module: Module }) {
  return (
    <NavLink to={module.chemin} end={module.chemin === '/'} className={classeLien}>
      <Icone nom={module.id} />
      <span className="lien-module__titre">{module.titre}</span>
      {!module.pret && <span className="navigation__pastille">{module.livraison}</span>}
    </NavLink>
  )
}

/** iPad et Mac : tous les modules visibles d'un coup d'oeil. */
export function MenuLateral() {
  return (
    <nav className="menu-lateral" aria-label="Modules de l’application">
      <Marque taille="grande" />
      <ul className="menu-lateral__liste">
        {MODULES.map((module) => (
          <li key={module.id}>
            <LienModule module={module} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** iPhone : bandeau du haut, uniquement pour l'identite et l'encoche. */
export function EnteteMobile() {
  return (
    <header className="entete-mobile">
      <Marque taille="petite" />
    </header>
  )
}

/**
 * iPhone : barre fixe en bas, quatre onglets du quotidien plus un bouton
 * « Plus » qui deroule la liste de tous les autres modules.
 */
export function BarreOnglets() {
  const [ouvert, setOuvert] = useState(false)
  const emplacement = useLocation()
  const secondaires = modulesSecondaires()
  const surUnModuleSecondaire = secondaires.some(
    (module) => module.chemin === emplacement.pathname,
  )

  // Un changement d'ecran referme toujours le panneau.
  useEffect(() => {
    setOuvert(false)
  }, [emplacement.pathname])

  // La touche Echap referme le panneau (utile au clavier, sur Mac).
  useEffect(() => {
    if (!ouvert) return
    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.key === 'Escape') setOuvert(false)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [ouvert])

  return (
    <>
      {ouvert && (
        <>
          <button
            type="button"
            className="voile"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
          />
          <div className="panneau-plus" role="dialog" aria-label="Autres modules">
            <p className="panneau-plus__titre">Autres modules</p>
            <ul className="panneau-plus__liste">
              {secondaires.map((module) => (
                <li key={module.id}>
                  <LienModule module={module} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <nav className="onglets" aria-label="Modules de l’application">
        {modulesPrincipaux().map((module) => (
          <NavLink
            key={module.id}
            to={module.chemin}
            end={module.chemin === '/'}
            className={({ isActive }) =>
              isActive && !ouvert ? 'onglets__element onglets__element--actif' : 'onglets__element'
            }
          >
            <Icone nom={module.id} />
            <span>{module.titre}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={
            surUnModuleSecondaire || ouvert
              ? 'onglets__element onglets__element--actif'
              : 'onglets__element'
          }
          onClick={() => setOuvert((etait) => !etait)}
          aria-expanded={ouvert}
        >
          <Icone nom="plus" />
          <span>Plus</span>
        </button>
      </nav>
    </>
  )
}
