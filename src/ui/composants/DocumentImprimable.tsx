import { dateEnTexte, jourDeLaSemaine, nomDuJour, semaineDe } from '../../domaine/calendrier'
import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import type { Planning } from '../../domaine/planning'
import { dureeTravailEffectif, type Vacation } from '../../moteurs/regles'
import type { CouvertureJour } from '../../moteurs/indicateurs'

/**
 * Documents destines a SORTIR de l'application (cahier des charges §15).
 *
 * Regle absolue, appliquee ici :
 *   ne figurent JAMAIS sur un document imprime le statut de suivi, les
 *   remarques du patron, l'historique, les notes personnelles, ni aucun
 *   reglage technique.
 *
 * Ce qui est affiche a l'ecran EST le document final : l'apercu et le PDF
 * sont rendus par le meme composant.
 */

export type TypeDocument = 'dossier-patron' | 'affichage-equipe'

interface Proprietes {
  readonly type: TypeDocument
  readonly planning: Planning
  readonly rayons: readonly Rayon[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly couvertures: readonly { rayon: Rayon; jour: string; couverture: CouvertureJour }[]
  readonly budgetHeuresParRayon: Readonly<Record<string, number>>
  readonly nomDuService: string
  /**
   * Renforts exterieurs en mission cette semaine. Ils figurent sur le
   * document : l'equipe doit savoir qui sera la, et le patron doit voir
   * le recours a l'interim.
   */
  readonly renforts: readonly {
    readonly id: string
    readonly nom: string
    readonly origine: string
    readonly vacations: readonly Vacation[]
  }[]
  /** Date d'edition du document. */
  readonly edite: string
}

function heuresDe(vacations: readonly Vacation[]): number {
  return vacations.reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60
}

export function DocumentImprimable({
  type,
  planning,
  rayons,
  collaborateurs,
  couvertures,
  budgetHeuresParRayon,
  nomDuService,
  renforts,
  edite,
}: Proprietes) {
  const jours = semaineDe(planning.semaine)
  const dernierJour = jours[6] ?? planning.semaine

  const rayonsConcernes = rayons.filter(
    (rayon) =>
      planning.vacations.some((vacation) => vacation.rayonId === rayon.id) ||
      renforts.some((renfort) =>
        renfort.vacations.some((vacation) => vacation.rayonId === rayon.id),
      ),
  )

  return (
    <div className="document">
      <header className="document__entete">
        <h1 className="document__titre">
          {type === 'dossier-patron' ? 'Planning prévisionnel' : 'Planning de la semaine'}
        </h1>
        <p className="document__sous-titre">
          Service {nomDuService} — du {dateEnTexte(planning.semaine)} au {dateEnTexte(dernierJour)}
        </p>
        <p className="document__reperes">
          Édité le {dateEnTexte(edite)} · version {planning.version}
        </p>
      </header>

      {rayonsConcernes.length === 0 && (
        <p className="document__vide">Aucune vacation n’est prévue cette semaine.</p>
      )}

      {rayonsConcernes.map((rayon) => {
        const duRayon = planning.vacations.filter((vacation) => vacation.rayonId === rayon.id)
        const personnes = collaborateurs
          .filter((collaborateur) =>
            duRayon.some((vacation) => vacation.collaborateurId === collaborateur.id),
          )
          .sort((a, b) => nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))

        return (
          <section key={rayon.id} className="document__rayon">
            <h2 className="document__rayon-titre">{rayon.nom}</h2>

            <table className="document__tableau">
              <thead>
                <tr>
                  <th scope="col">Collaborateur</th>
                  {jours.map((jour) => (
                    <th key={jour} scope="col">
                      {nomDuJour(jourDeLaSemaine(jour)).slice(0, 3)} {jour.slice(8)}
                    </th>
                  ))}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {personnes.map((collaborateur) => {
                  const siennes = duRayon.filter(
                    (vacation) => vacation.collaborateurId === collaborateur.id,
                  )
                  return (
                    <tr key={collaborateur.id}>
                      <th scope="row">{nomAffiche(collaborateur)}</th>
                      {jours.map((jour) => {
                        const duJour = siennes.filter((vacation) => vacation.jour === jour)
                        return (
                          <td key={jour}>
                            {duJour.length === 0
                              ? '—'
                              : duJour
                                  .map((vacation) => `${vacation.debut} – ${vacation.fin}`)
                                  .join(' / ')}
                          </td>
                        )
                      })}
                      <td className="document__total">{heuresDe(siennes).toFixed(1)} h</td>
                    </tr>
                  )
                })}

                {renforts
                  .filter((renfort) =>
                    renfort.vacations.some((vacation) => vacation.rayonId === rayon.id),
                  )
                  .map((renfort) => {
                    const siennes = renfort.vacations.filter(
                      (vacation) => vacation.rayonId === rayon.id,
                    )
                    return (
                      <tr key={renfort.id}>
                        <th scope="row">
                          {renfort.nom}
                          <span className="document__mention"> ({renfort.origine})</span>
                        </th>
                        {jours.map((jour) => {
                          const duJour = siennes.filter((vacation) => vacation.jour === jour)
                          return (
                            <td key={jour}>
                              {duJour.length === 0
                                ? '—'
                                : duJour
                                    .map(
                                      (vacation) =>
                                        `${vacation.debut}\u2009–\u2009${vacation.fin}`,
                                    )
                                    .join(' / ')}
                            </td>
                          )
                        })}
                        <td className="document__total">{heuresDe(siennes).toFixed(1)} h</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </section>
        )
      })}

      {/* Les indicateurs ne figurent que sur le dossier remis au patron. */}
      {type === 'dossier-patron' && couvertures.length > 0 && (
        <section className="document__rayon">
          <h2 className="document__rayon-titre">Effectifs et couverture</h2>
          <table className="document__tableau">
            <thead>
              <tr>
                <th scope="col">Rayon</th>
                <th scope="col">Heures nécessaires</th>
                <th scope="col">Heures prévues</th>
                <th scope="col">Couverture</th>
                <th scope="col">Budget</th>
              </tr>
            </thead>
            <tbody>
              {rayons.map((rayon) => {
                const duRayon = couvertures.filter((c) => c.rayon.id === rayon.id)
                if (duRayon.length === 0) return null

                const besoin = duRayon.reduce((s, c) => s + c.couverture.heuresBesoin, 0)
                const prevu = duRayon.reduce((s, c) => s + c.couverture.heuresPresence, 0)
                const manque = duRayon.reduce((s, c) => s + c.couverture.heuresManquantes, 0)
                const taux = besoin === 0 ? 1 : 1 - manque / besoin

                return (
                  <tr key={rayon.id}>
                    <th scope="row">{rayon.nom}</th>
                    <td>{besoin.toFixed(1)} h</td>
                    <td>{prevu.toFixed(1)} h</td>
                    <td>{Math.round(taux * 100)} %</td>
                    <td>{budgetHeuresParRayon[rayon.id] ?? 0} h</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      <footer className="document__pied">
        {nomDuService} — {dateEnTexte(planning.semaine)}
      </footer>
    </div>
  )
}
