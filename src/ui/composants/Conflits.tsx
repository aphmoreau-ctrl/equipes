import { useMemo, useState } from 'react'
import { useDonnees } from '../DonneesProvider'
import { rayonParId, rayonsActifs } from '../../domaine/magasin'
import { dateEnTexte, jourEnTexte, semaineDe } from '../../domaine/calendrier'
import { absencesEffectives } from '../../donnees/etat'
import { chercherLesConflits, type Conflit, type Solution } from '../../moteurs/planning/conflits'
import { enMinutes, enTexte } from '../../domaine/temps'
import type { Vacation } from '../../moteurs/regles'

/**
 * Conflits et solutions (§9.7).
 *
 * Le but n'est pas de constater ce qui manque — la couverture le dit — mais de
 * proposer quoi faire, et de pouvoir l'appliquer d'un geste.
 */

const LIBELLES_NATURE: Readonly<Record<Solution['nature'], string>> = {
  pret: 'Prêt entre rayons',
  decalage: 'Décalage',
  'heures-complementaires': 'Heures complémentaires',
  'renfort-exterieur': 'Renfort extérieur',
  formation: 'Formation à prévoir',
}

interface Proprietes {
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  readonly besoinDuJour: (
    date: string,
    rayonId: string,
  ) => import('../../moteurs/besoin').BesoinJour | null
  readonly onAppliquer: (vacations: readonly Vacation[]) => void
}

export function Conflits({ semaine, vacations, besoinDuJour, onAppliquer }: Proprietes) {
  const { etat } = useDonnees()
  const jours = semaineDe(semaine)
  const rayons = rayonsActifs(etat.magasin)
  const [tout, setTout] = useState(false)

  const conflits = useMemo(() => {
    const besoins = jours.flatMap((jour) =>
      rayons
        .map((rayon) => besoinDuJour(jour, rayon.id))
        .filter((besoin): besoin is NonNullable<typeof besoin> => besoin !== null),
    )

    return chercherLesConflits({
      besoins,
      vacations,
      collaborateurs: etat.collaborateurs,
      absences: absencesEffectives(etat),
      renforts: etat.renforts,
      nomDuRayon: (identifiant) => rayonParId(etat.magasin, identifiant)?.nom ?? identifiant,
    })
  }, [jours, rayons, besoinDuJour, vacations, etat])

  const visibles = tout ? conflits : conflits.slice(0, 10)

  /** Applique une solution : seuls le prêt et le décalage touchent au planning. */
  function appliquer(conflit: Conflit, solution: Solution): void {
    if (solution.nature === 'pret' && solution.collaborateurId !== undefined) {
      const ajoutee: Vacation = {
        id: `pret-${conflit.id}-${solution.collaborateurId}`,
        collaborateurId: solution.collaborateurId,
        rayonId: conflit.rayonId,
        jour: conflit.jour,
        debut: solution.debut ?? enTexte(conflit.debutMinutes),
        fin: solution.fin ?? enTexte(conflit.finMinutes % 1440),
        pauseMinutes: 0,
      }
      onAppliquer([...vacations, ajoutee])
      return
    }

    if (
      solution.nature === 'decalage' &&
      solution.vacationId !== undefined &&
      solution.decalageMinutes !== undefined
    ) {
      const decalage = solution.decalageMinutes
      onAppliquer(
        vacations.map((vacation) =>
          vacation.id === solution.vacationId
            ? {
                ...vacation,
                debut: enTexte(enMinutes(vacation.debut) + decalage),
                fin: enTexte(enMinutes(vacation.fin) + decalage),
              }
            : vacation,
        ),
      )
    }
  }

  return (
    <section className="carte">
      <h2>Conflits et solutions</h2>
      {conflits.length === 0 ? (
        <p className="avis avis--succes">
          Aucun conflit : le besoin de la semaine est couvert, compétences comprises.
        </p>
      ) : (
        <>
          <p>
            {conflits.length} conflit{conflits.length > 1 ? 's' : ''} à traiter, du plus grave au
            moins grave. Les solutions sont classées du moins coûteux au plus coûteux.
          </p>

          <ul className="conflits">
            {visibles.map((conflit) => (
              <li
                key={conflit.id}
                className={
                  conflit.nature === 'competence-critique' ? 'conflit conflit--grave' : 'conflit'
                }
              >
                <p className="conflit__titre">{conflit.libelle}</p>
                <p className="champ__aide">{jourEnTexte(conflit.jour)}</p>

                {conflit.solutions.length === 0 ? (
                  <p className="champ__aide">
                    Aucune solution automatique : il faudra recruter, ou revoir le besoin de ce
                    rayon.
                  </p>
                ) : (
                  <ul className="solutions">
                    {conflit.solutions.slice(0, 4).map((solution) => (
                      <li key={`${solution.nature}-${solution.libelle}`} className="solution">
                        <span className="solution__nature">{LIBELLES_NATURE[solution.nature]}</span>
                        <span className="solution__libelle">{solution.libelle}</span>
                        <span className="solution__detail">{solution.detail}</span>
                        {(solution.nature === 'pret' || solution.nature === 'decalage') && (
                          <button
                            type="button"
                            className="bouton"
                            onClick={() => appliquer(conflit, solution)}
                          >
                            Appliquer
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {conflits.length > visibles.length && (
            <button type="button" className="bouton" onClick={() => setTout(true)}>
              Voir les {conflits.length - visibles.length} autres
            </button>
          )}

          <p className="champ__aide">
            Pour la semaine commençant le {dateEnTexte(semaine)}. « Appliquer » ne concerne que le prêt et le
            décalage : les heures complémentaires, les renforts et les formations se décident
            ailleurs, avec les personnes concernées.
          </p>
        </>
      )}
    </section>
  )
}
