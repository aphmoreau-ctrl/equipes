import { useMemo } from 'react'
import { useDonnees } from '../DonneesProvider'
import { rayonsActifs } from '../../domaine/magasin'
import { nomAffiche } from '../../domaine/collaborateur'
import { semaineDe } from '../../domaine/calendrier'
import { calculerCouverture } from '../../moteurs/indicateurs'
import { dureeTravailEffectif, type Vacation } from '../../moteurs/regles'
import { ecartEnTexte, heuresEnTexte } from '../../domaine/nombres'

/**
 * Vue tous rayons (§9.2) : la semaine d'un seul coup d'oeil.
 *
 * Pour chaque rayon : la couverture en pourcentage, les heures prevues face
 * aux heures necessaires, et l'ecart au budget. Plus la liste des PRETS —
 * qui travaille hors de son rayon — parce que c'est la premiere chose qu'on
 * cherche quand un rayon va mal.
 */

interface Proprietes {
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  readonly besoinDuJour: (
    date: string,
    rayonId: string,
  ) => import('../../moteurs/besoin').BesoinJour | null
}

export function VueTousRayons({ semaine, vacations, besoinDuJour }: Proprietes) {
  const { etat } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const jours = semaineDe(semaine)

  const lignes = useMemo(
    () =>
      rayons.map((rayon) => {
        let heuresBesoin = 0
        let heuresPresence = 0
        let manquantes = 0

        for (const jour of jours) {
          const besoin = besoinDuJour(jour, rayon.id)
          if (besoin === null) continue
          const duJour = vacations.filter(
            (vacation) => vacation.rayonId === rayon.id && vacation.jour === jour,
          )
          const couverture = calculerCouverture(besoin, duJour, etat.collaborateurs)
          heuresBesoin += couverture.heuresBesoin
          heuresPresence += couverture.heuresPresence
          manquantes += couverture.heuresManquantes
        }

        const heuresPrevues =
          vacations
            .filter((vacation) => vacation.rayonId === rayon.id)
            .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60

        const budget = etat.magasin.budgetHeuresParRayon[rayon.id] ?? 0
        const taux = heuresBesoin === 0 ? 1 : 1 - manquantes / heuresBesoin

        return { rayon, heuresBesoin, heuresPresence, heuresPrevues, budget, taux }
      }),
    [rayons, jours, vacations, besoinDuJour, etat.collaborateurs, etat.magasin],
  )

  /** Qui travaille hors de son rayon principal, et où. */
  const prets = useMemo(() => {
    const parPersonne = new Map<string, { nom: string; depuis: string; vers: Set<string>; heures: number }>()

    for (const vacation of vacations) {
      const collaborateur = etat.collaborateurs.find((c) => c.id === vacation.collaborateurId)
      if (collaborateur === undefined) continue
      if (collaborateur.rayonPrincipal === vacation.rayonId) continue

      const deja = parPersonne.get(collaborateur.id)
      const heures = dureeTravailEffectif(vacation) / 60
      if (deja === undefined) {
        parPersonne.set(collaborateur.id, {
          nom: nomAffiche(collaborateur),
          depuis: collaborateur.rayonPrincipal,
          vers: new Set([vacation.rayonId]),
          heures,
        })
      } else {
        deja.vers.add(vacation.rayonId)
        deja.heures += heures
      }
    }

    return [...parPersonne.values()].sort((a, b) => b.heures - a.heures || a.nom.localeCompare(b.nom, 'fr'))
  }, [vacations, etat.collaborateurs])

  const nomDuRayon = (identifiant: string): string =>
    rayons.find((rayon) => rayon.id === identifiant)?.nom ?? identifiant

  const totalPrevu = lignes.reduce((somme, ligne) => somme + ligne.heuresPrevues, 0)
  const totalBudget = lignes.reduce((somme, ligne) => somme + ligne.budget, 0)

  return (
    <section className="carte">
      <h2>Tous les rayons</h2>
      <p>La semaine d’un seul coup d’œil : ce qui est couvert, ce qui est prévu, ce qui est prêté.</p>

      <div className="grille-cadre">
        <table className="grille grille--compacte">
          <thead>
            <tr>
              <th scope="col">Rayon</th>
              <th scope="col">Couverture</th>
              <th scope="col">Heures nécessaires</th>
              <th scope="col">Heures prévues</th>
              <th scope="col">Budget</th>
              <th scope="col">Écart</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.rayon.id}>
                <th scope="row">{ligne.rayon.nom}</th>
                <td>
                  <span
                    className={
                      ligne.taux >= 0.95
                        ? 'verdict verdict--bon'
                        : ligne.taux >= 0.8
                          ? 'verdict'
                          : 'verdict verdict--mauvais'
                    }
                  >
                    {Math.round(ligne.taux * 100)} %
                  </span>
                </td>
                <td>{heuresEnTexte(ligne.heuresBesoin)}</td>
                <td>{heuresEnTexte(ligne.heuresPrevues)}</td>
                <td>{ligne.budget} h</td>
                <td className={ligne.heuresPrevues > ligne.budget ? 'grille__anomalie' : undefined}>
                  {ecartEnTexte(ligne.heuresPrevues - ligne.budget)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total du service</th>
              <td />
              <td />
              <td>{heuresEnTexte(totalPrevu)}</td>
              <td>{totalBudget} h</td>
              <td className={totalPrevu > totalBudget ? 'grille__anomalie' : undefined}>
                {ecartEnTexte(totalPrevu - totalBudget)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3>Prêts entre rayons</h3>
      {prets.length === 0 ? (
        <p className="champ__aide">
          Personne ne travaille hors de son rayon cette semaine.
        </p>
      ) : (
        <ul className="liste-simple">
          {prets.map((pret) => (
            <li key={pret.nom}>
              <strong>{pret.nom}</strong> — {heuresEnTexte(pret.heures)} depuis{' '}
              {nomDuRayon(pret.depuis)} vers{' '}
              {[...pret.vers].map(nomDuRayon).sort((a, b) => a.localeCompare(b, 'fr')).join(', ')}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
