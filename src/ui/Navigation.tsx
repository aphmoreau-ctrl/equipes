import { NavLink } from 'react-router-dom'
import { Icone } from './Icone'
import { MODULES } from './modules'

export function Navigation() {
  return (
    <nav className="navigation" aria-label="Modules de l’application">
      <p className="navigation__marque">
        <span className="navigation__logo" aria-hidden="true">
          É
        </span>
        <span>Équipes</span>
      </p>

      <ul className="navigation__liste">
        {MODULES.map((module) => (
          <li key={module.id}>
            <NavLink
              to={module.chemin}
              end={module.chemin === '/'}
              className={({ isActive }) =>
                isActive ? 'navigation__lien navigation__lien--actif' : 'navigation__lien'
              }
            >
              <Icone nom={module.id} />
              <span>{module.titre}</span>
              {!module.pret && <span className="navigation__pastille">{module.livraison}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
