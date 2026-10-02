import { useMemo, useState } from 'react'
import { useDonnees } from '../DonneesProvider'
import { nomAffiche } from '../../domaine/collaborateur'
import { rayonParId, rayonsActifs } from '../../domaine/magasin'
import { dateEnTexte, semaineDe } from '../../domaine/calendrier'
import { construireLesFeuilles, plageEnTexte } from '../../moteurs/planning/feuilles'
import type { Vacation } from '../../moteurs/regles'
import { heuresEnTexte } from '../../domaine/nombres'

/**
 * Feuilles de route : qui fait quoi, heure par heure (§9.5).
 *
 * Elles se deduisent du planning et du besoin : rien a saisir. On choisit un
 * jour, on imprime, et chacun sait ce qu'il a a faire.
 */

interface Proprietes {
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  readonly besoinDuJour: (date: string, rayonId: string) => import('../../moteurs/besoin').BesoinJour | null
}

export function FeuillesDeRoute({ semaine, vacations, besoinDuJour }: Proprietes) {
  const { etat } = useDonnees()
  const jours = semaineDe(semaine)
  const [jour, setJour] = useState(jours[0] ?? semaine)
  const [pourImpression, setPourImpression] = useState(false)
  const rayons = rayonsActifs(etat.magasin)

  const resultat = useMemo(() => {
    const besoins = rayons
      .map((rayon) => besoinDuJour(jour, rayon.id))
      .filter((besoin): besoin is NonNullable<typeof besoin> => besoin !== null)

    return construireLesFeuilles({
      jour,
      vacations,
      besoins,
      configurations: etat.configurations,
      collaborateurs: etat.collaborateurs,
    })
  }, [jour, vacations, rayons, besoinDuJour, etat.configurations, etat.collaborateurs])

  const nom = (identifiant: string): string => {
    const collaborateur = etat.collaborateurs.find((c) => c.id === identifiant)
    return collaborateur === undefined ? identifiant : nomAffiche(collaborateur)
  }

  const nomDuRayon = (identifiant: string): string =>
    rayonParId(etat.magasin, identifiant)?.nom ?? identifiant

  return (
    <section className={pourImpression ? 'carte a-imprimer' : 'carte'}>
      <h2>Feuilles de route</h2>
      <p>
        Ce que chacun a à faire, heure par heure. Elles se déduisent du planning et du besoin :
        rien à saisir.
      </p>

      <label className="champ champ--etroit">
        <span className="champ__libelle">Jour</span>
        <select
          className="champ__saisie"
          value={jour}
          onChange={(evenement) => setJour(evenement.target.value)}
        >
          {jours.map((date) => (
            <option key={date} value={date}>
              {dateEnTexte(date)}
            </option>
          ))}
        </select>
      </label>

      {resultat.feuilles.length === 0 ? (
        <p className="champ__aide">Personne n’est prévu ce jour-là.</p>
      ) : (
        <div className="feuilles">
          {resultat.feuilles.map((feuille) => (
            <article key={feuille.collaborateurId} className="feuille">
              <h3 className="feuille__nom">{nom(feuille.collaborateurId)}</h3>
              {feuille.lignes.length === 0 ? (
                <p className="champ__aide">Aucune tâche précise : présence de renfort.</p>
              ) : (
                <ul className="feuille__lignes">
                  {feuille.lignes.map((ligne) => (
                    <li key={`${ligne.debutMinutes}-${ligne.tacheId}`} className="feuille__ligne">
                      <span className="feuille__heure">{plageEnTexte(ligne)}</span>
                      <span className="feuille__tache">{ligne.tacheNom}</span>
                      <span className="feuille__rayon">{nomDuRayon(ligne.rayonId)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      <p>
        <button
          type="button"
          className="bouton"
          onClick={() => {
            setPourImpression(true)
            // Laisse le temps a la mise en page de passer en mode impression.
            window.setTimeout(() => {
              window.print()
              setPourImpression(false)
            }, 0)
          }}
        >
          Imprimer les feuilles du jour
        </button>
      </p>

      {resultat.nonAffectees.length > 0 && (
        <>
          <h3>Ce qui n’a trouvé personne</h3>
          <ul className="liste-simple">
            {regrouper(resultat.nonAffectees).map((manque) => (
              <li key={`${manque.rayonId}-${manque.tacheId}-${manque.raison}`}>
                <strong>{manque.tacheNom}</strong> — {nomDuRayon(manque.rayonId)} ·{' '}
                {heuresEnTexte(manque.minutes / 60)}{' '}
                <span className="champ__aide">
                  {manque.raison === 'competence-absente'
                    ? 'personne de présent n’a la compétence requise'
                    : 'tout le monde était déjà occupé'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Une tache non affectee apparait a chaque quart d'heure : on totalise. */
function regrouper(
  nonAffectees: readonly import('../../moteurs/planning/feuilles').TacheNonAffectee[],
) {
  const parTache = new Map<
    string,
    { rayonId: string; tacheId: string; tacheNom: string; minutes: number; raison: string }
  >()

  for (const tache of nonAffectees) {
    const cle = `${tache.rayonId}|${tache.tacheId}|${tache.raison}`
    const deja = parTache.get(cle)
    if (deja === undefined) {
      parTache.set(cle, {
        rayonId: tache.rayonId,
        tacheId: tache.tacheId,
        tacheNom: tache.tacheNom,
        minutes: tache.minutes,
        raison: tache.raison,
      })
    } else {
      deja.minutes += tache.minutes
    }
  }

  return [...parTache.values()].sort(
    (a, b) => b.minutes - a.minutes || a.tacheNom.localeCompare(b.tacheNom, 'fr'),
  )
}
