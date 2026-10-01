import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icone } from './Icone'
import { useDonnees } from './DonneesProvider'
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

/** Nombre d'alertes « a traiter tout de suite », pour la pastille rouge. */
export function useNombreUrgences(): number {
  const { alertes } = useDonnees()
  const nombre = alertes.filter((alerte) => alerte.gravite === 'urgent').length

  // Pastille sur l'icone de l'application, quand l'appareil le permet
  // (application installee ; sur iPhone et iPad, notifications autorisees).
  useEffect(() => {
    const appareil = navigator as Navigator & {
      setAppBadge?: (nombre: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const action =
      nombre > 0 ? appareil.setAppBadge?.(nombre) : appareil.clearAppBadge?.()
    action?.catch(() => {
      // Refuse par l'appareil : la pastille du menu suffit.
    })
  }, [nombre])

  return nombre
}

function PastilleUrgences({ nombre }: { readonly nombre: number }) {
  if (nombre === 0) return null
  // Au-dela de 99, la pastille deviendrait plus large que l'onglet.
  return (
    <span className="navigation__pastille navigation__pastille--urgent" aria-hidden="true">
      {nombre > 99 ? '99+' : nombre}
    </span>
  )
}

function LienModule({ module, urgences }: { readonly module: Module; readonly urgences: number }) {
  const avecPastille = module.id === 'alertes' && urgences > 0
  return (
    <NavLink to={module.chemin} end={module.chemin === '/'} className={classeLien}>
      <Icone nom={module.id} />
      <span className="lien-module__titre">{module.titre}</span>
      {avecPastille && (
        <>
          <PastilleUrgences nombre={urgences} />
          <span className="visuellement-cache">
            {` — ${urgences} à traiter tout de suite`}
          </span>
        </>
      )}
      {!module.pret && <span className="navigation__pastille">{module.livraison}</span>}
    </NavLink>
  )
}

/** iPad et Mac : tous les modules visibles d'un coup d'oeil. */
export function MenuLateral() {
  const urgences = useNombreUrgences()
  return (
    <nav className="menu-lateral" aria-label="Modules de l’application">
      <Marque taille="grande" />
      <ul className="menu-lateral__liste">
        {MODULES.map((module) => (
          <li key={module.id}>
            <LienModule module={module} urgences={urgences} />
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
  const urgences = useNombreUrgences()
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
                  <LienModule module={module} urgences={urgences} />
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
          <span className="onglets__icone">
            <Icone nom="plus" />
            <PastilleUrgences nombre={urgences} />
          </span>
          <span>Plus</span>
        </button>
      </nav>
    </>
  )
}
