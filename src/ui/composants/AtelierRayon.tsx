import { jourDeLaSemaine, nomDuJour } from '../../domaine/calendrier'
import { nomAffiche } from '../../domaine/collaborateur'
import { heuresEnTexte } from '../../domaine/nombres'
import type { BilanDuRayon } from '../../moteurs/planning/atelier'

/**
 * Travail sur un rayon : ce qu'il faut, ce qu'on a, qui peut venir, et un
 * bouton pour ne calculer que ce rayon.
 */

const LIBELLES_RANG = {
  principal: 'titulaire',
  secondaire: 'renfort',
  depannage: 'dépannage',
} as const

interface Proprietes {
  readonly nomDuRayon: string
  readonly bilan: BilanDuRayon
  readonly exclus: ReadonlySet<string>
  readonly onBasculer: (collaborateurId: string) => void
  readonly onGenerer: () => void
  readonly enCours: boolean
}

export function AtelierRayon({ nomDuRayon, bilan, exclus, onBasculer, onGenerer, enCours }: Proprietes) {
  return (
    <div className="atelier-rayon" aria-labelledby="titre-atelier-rayon">
      <h3 id="titre-atelier-rayon">Travail sur le rayon {nomDuRayon}</h3>
      <dl className="atelier-rayon__bilan">
        <div>
          <dt>Nécessaire</dt>
          <dd>
            {heuresEnTexte(bilan.heuresMinimum)} au minimum · {heuresEnTexte(bilan.heuresCible)} pour la
            cible
          </dd>
        </div>
        <div>
          <dt>Disponible</dt>
          <dd>{heuresEnTexte(bilan.heuresDisponibles)} (titulaires et renforts)</dd>
        </div>
        <div>
          <dt>Solde</dt>
          <dd className={bilan.solde < 0 ? 'atelier-rayon__negatif' : undefined}>
            {bilan.solde >= 0 ? '+' : '−'}
            {heuresEnTexte(Math.abs(bilan.solde))} par rapport à la cible
          </dd>
        </div>
        <div>
          <dt>Planifié ici</dt>
          <dd>{heuresEnTexte(bilan.heuresPlanifiees)}</dd>
        </div>
      </dl>
      {bilan.solde >= 0 && (
        <p className="champ__aide">
          Il y a assez d’heures sur le papier : tout minimum non tenu après calcul est expliqué sous le
          planning (« Pourquoi personne »).
        </p>
      )}

      <div className="grille-cadre">
        <table className="grille grille--compacte atelier-rayon__table">
          <thead>
            <tr>
              <th scope="col">Inclure</th>
              <th scope="col">Personne</th>
              <th scope="col">Rang</th>
              <th scope="col">À faire</th>
              <th scope="col">Ailleurs</th>
              <th scope="col">Ici</th>
              <th scope="col">Restant</th>
              <th scope="col">Ne peut pas venir</th>
            </tr>
          </thead>
          <tbody>
            {bilan.personnes.map((p) => (
              <tr key={p.collaborateur.id}>
                <td>
                  <input
                    type="checkbox"
                    id={`inclure-${p.collaborateur.id}`}
                    aria-label={`Inclure ${nomAffiche(p.collaborateur)} dans le calcul`}
                    checked={p.rang !== 'depannage' && !exclus.has(p.collaborateur.id)}
                    disabled={p.rang === 'depannage'}
                    onChange={() => onBasculer(p.collaborateur.id)}
                  />
                </td>
                <th scope="row">{nomAffiche(p.collaborateur)}</th>
                <td>{LIBELLES_RANG[p.rang]}</td>
                <td>{heuresEnTexte(p.visees, 2)}</td>
                <td>{heuresEnTexte(p.ailleurs, 2)}</td>
                <td>{heuresEnTexte(p.ici, 2)}</td>
                <td>{heuresEnTexte(p.restantes, 2)}</td>
                <td>
                  {p.joursImpossibles.length === 0
                    ? '—'
                    : p.joursImpossibles.map((j) => nomDuJour(jourDeLaSemaine(j)).slice(0, 3)).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="champ__aide">
        Le dépannage ne se prévoit pas : il se pose à la main, en dernier recours.
      </p>

      <button type="button" className="bouton bouton--principal" disabled={enCours} onClick={onGenerer}>
        {enCours ? 'Calcul en cours…' : `Générer ce rayon`}
      </button>
      <span className="bouton__aide">
        les autres rayons ne bougent pas ; les cases verrouillées non plus
      </span>
    </div>
  )
}
