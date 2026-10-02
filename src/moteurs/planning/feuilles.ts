import { TRANCHE_MINUTES, TRANCHES_PAR_JOUR, enTexte } from '../../domaine/temps'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { BesoinJour, Bloc, ConfigurationRayon } from '../besoin'
import { couvreLaTranche } from '../indicateurs'
import type { Vacation } from '../regles'

/**
 * Feuilles de route : qui fait quoi, et a quelle heure (§9.5).
 *
 * Le planning dit qui est la. La feuille de route dit ce qu'il fait. Elle se
 * deduit du besoin : chaque tache apporte des minutes de travail a chaque
 * quart d'heure, et ces minutes sont reparties entre les personnes presentes.
 *
 * Module pur : aucune dependance a l'interface, resultat identique a donnees
 * egales (tout parcours est trie).
 */

export interface LigneFeuille {
  readonly debutMinutes: number
  readonly finMinutes: number
  readonly tacheId: string
  readonly tacheNom: string
  readonly rayonId: string
}

export interface FeuilleDeRoute {
  readonly collaborateurId: string
  readonly jour: string
  readonly lignes: readonly LigneFeuille[]
}

/** Une tache qui n'a trouve personne pour la tenir. */
export interface TacheNonAffectee {
  readonly rayonId: string
  readonly jour: string
  readonly tacheId: string
  readonly tacheNom: string
  readonly debutMinutes: number
  readonly minutes: number
  readonly raison: 'personne-de-libre' | 'competence-absente'
}

export interface ResultatFeuilles {
  readonly feuilles: readonly FeuilleDeRoute[]
  readonly nonAffectees: readonly TacheNonAffectee[]
}

export interface EntreesFeuilles {
  readonly jour: string
  readonly vacations: readonly Vacation[]
  readonly besoins: readonly BesoinJour[]
  readonly configurations: readonly ConfigurationRayon[]
  readonly collaborateurs: readonly Collaborateur[]
}

/**
 * Cette personne peut-elle tenir cette tache sur cette tranche ?
 *
 * Il lui faut le niveau exige pour CHAQUE competence de la tache. Le binome
 * s'applique : un niveau 1 convient si quelqu'un de niveau 3 est present sur
 * la meme tranche pour la meme competence.
 */
function peutTenir(
  collaborateur: Collaborateur,
  bloc: Bloc,
  presents: readonly Collaborateur[],
): boolean {
  return bloc.competences.every((exigence) => {
    const sien = collaborateur.competences[exigence.competence] ?? 0
    if (sien >= exigence.niveauMinimum) return true
    if (exigence.critique === true) return false
    // Binome : en formation, accompagne de quelqu'un qui sait former.
    if (sien !== 1) return false
    return presents.some((autre) => (autre.competences[exigence.competence] ?? 0) >= 3)
  })
}

/** Les taches d'une tranche, de la plus lourde a la plus legere. */
function tachesDeLaTranche(
  besoin: BesoinJour,
  index: number,
  blocs: readonly Bloc[],
): { bloc: Bloc; minutes: number }[] {
  const tranche = besoin.tranches[index]
  if (tranche === undefined) return []

  return Object.entries(tranche.minutesParBloc)
    .map(([blocId, minutes]) => ({ bloc: blocs.find((b) => b.id === blocId), minutes }))
    .filter((entree): entree is { bloc: Bloc; minutes: number } => entree.bloc !== undefined)
    .sort((a, b) => b.minutes - a.minutes || a.bloc.id.localeCompare(b.bloc.id))
}

export function construireLesFeuilles(entrees: EntreesFeuilles): ResultatFeuilles {
  /** Tache tenue par chaque personne, tranche par tranche. */
  const parPersonne = new Map<string, (LigneFeuille | null)[]>()
  const nonAffectees: TacheNonAffectee[] = []

  const duJour = entrees.vacations
    .filter((vacation) => vacation.jour === entrees.jour)
    .sort((a, b) => a.collaborateurId.localeCompare(b.collaborateurId) || a.id.localeCompare(b.id))

  for (const vacation of duJour) {
    if (!parPersonne.has(vacation.collaborateurId)) {
      parPersonne.set(
        vacation.collaborateurId,
        new Array<LigneFeuille | null>(TRANCHES_PAR_JOUR).fill(null),
      )
    }
  }

  const besoins = [...entrees.besoins]
    .filter((besoin) => besoin.date === entrees.jour)
    .sort((a, b) => a.rayonId.localeCompare(b.rayonId))

  for (const besoin of besoins) {
    const blocs =
      entrees.configurations.find((c) => c.rayonId === besoin.rayonId)?.blocs ?? []
    const vacationsDuRayon = duJour.filter((vacation) => vacation.rayonId === besoin.rayonId)

    for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
      const presentes = vacationsDuRayon.filter((vacation) => couvreLaTranche(vacation, index))
      const presents = presentes
        .map((vacation) => entrees.collaborateurs.find((c) => c.id === vacation.collaborateurId))
        .filter((c): c is Collaborateur => c !== undefined)

      /** Qui n'a pas encore de tache sur cette tranche. */
      const libres = new Set(
        presents
          .filter((collaborateur) => parPersonne.get(collaborateur.id)?.[index] == null)
          .map((collaborateur) => collaborateur.id),
      )

      for (const { bloc, minutes } of tachesDeLaTranche(besoin, index, blocs)) {
        const capables = presents
          .filter((collaborateur) => libres.has(collaborateur.id))
          .filter((collaborateur) => peutTenir(collaborateur, bloc, presents))
          .sort((a, b) => a.id.localeCompare(b.id))

        const choisi = capables[0]
        if (choisi === undefined) {
          const quelquUnDeCapable = presents.some((collaborateur) =>
            peutTenir(collaborateur, bloc, presents),
          )
          nonAffectees.push({
            rayonId: besoin.rayonId,
            jour: entrees.jour,
            tacheId: bloc.id,
            tacheNom: bloc.nom,
            debutMinutes: index * TRANCHE_MINUTES,
            minutes,
            raison: quelquUnDeCapable ? 'personne-de-libre' : 'competence-absente',
          })
          continue
        }

        libres.delete(choisi.id)
        const lignes = parPersonne.get(choisi.id)
        if (lignes !== undefined) {
          lignes[index] = {
            debutMinutes: index * TRANCHE_MINUTES,
            finMinutes: (index + 1) * TRANCHE_MINUTES,
            tacheId: bloc.id,
            tacheNom: bloc.nom,
            rayonId: besoin.rayonId,
          }
        }
      }
    }
  }

  const feuilles: FeuilleDeRoute[] = [...parPersonne.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([collaborateurId, tranches]) => ({
      collaborateurId,
      jour: entrees.jour,
      lignes: fusionner(tranches),
    }))

  return {
    feuilles,
    nonAffectees: nonAffectees.sort(
      (a, b) =>
        a.rayonId.localeCompare(b.rayonId) ||
        a.debutMinutes - b.debutMinutes ||
        a.tacheId.localeCompare(b.tacheId),
    ),
  }
}

/** Rassemble les quarts d'heure consecutifs passes sur la meme tache. */
function fusionner(tranches: readonly (LigneFeuille | null)[]): LigneFeuille[] {
  const lignes: LigneFeuille[] = []

  for (const tranche of tranches) {
    if (tranche === null) continue
    const derniere = lignes[lignes.length - 1]
    if (
      derniere !== undefined &&
      derniere.tacheId === tranche.tacheId &&
      derniere.rayonId === tranche.rayonId &&
      derniere.finMinutes === tranche.debutMinutes
    ) {
      lignes[lignes.length - 1] = { ...derniere, finMinutes: tranche.finMinutes }
      continue
    }
    lignes.push(tranche)
  }

  return lignes
}

/** « 06:00 – 07:30 » pour l'affichage et l'impression. */
export function plageEnTexte(ligne: LigneFeuille): string {
  return `${enTexte(ligne.debutMinutes)} – ${enTexte(ligne.finMinutes % (24 * 60))}`
}
