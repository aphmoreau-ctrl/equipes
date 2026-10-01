import { jourDeLaSemaine } from '../../domaine/calendrier'
import { duree } from '../../domaine/temps'
import { nomRenfort, type Mission, type Renfort } from '../../domaine/vivier'

/**
 * Vivier exterieur (module 8) : classement des renforts pour une vacation,
 * et bilan des missions (heures et cout).
 *
 * Module pur, deterministe. Comme pour les remplacants internes, il propose
 * et explique ; il ne decide rien. Les competences critiques ne souffrent
 * aucune tolerance (voir C-04).
 */

export interface RenfortPropose {
  readonly renfort: Renfort
  readonly score: number
  readonly atouts: readonly string[]
  readonly reserves: readonly string[]
  /** Cout estime de la vacation, en euros. */
  readonly coutEstime: number
}

export interface RenfortEcarte {
  readonly renfort: Renfort
  readonly motif: string
}

export interface ClassementVivier {
  readonly possibles: readonly RenfortPropose[]
  readonly partiels: readonly RenfortPropose[]
  readonly ecartes: readonly RenfortEcarte[]
}

export interface DemandeRenfort {
  readonly date: string
  readonly rayonId: string
  readonly debut: string
  readonly fin: string
  readonly pauseMinutes: number
  readonly competencesRequises: readonly string[]
  readonly competencesCritiques: readonly string[]
}

function autonome(renfort: Renfort, competence: string): boolean {
  return (renfort.competences[competence] ?? 0) >= 2
}

/** Heures travaillees d'une mission ou d'une demande (pause deduite). */
export function heuresTravaillees(creneau: {
  readonly debut: string
  readonly fin: string
  readonly pauseMinutes: number
}): number {
  return Math.max(0, duree(creneau.debut, creneau.fin) - creneau.pauseMinutes) / 60
}

function arrondi(valeur: number): number {
  return Math.round(valeur * 100) / 100
}

export function classerRenforts(
  demande: DemandeRenfort,
  renforts: readonly Renfort[],
  missions: readonly Mission[],
): ClassementVivier {
  const jour = jourDeLaSemaine(demande.date)
  const heures = heuresTravaillees(demande)
  const possibles: RenfortPropose[] = []
  const partiels: RenfortPropose[] = []
  const ecartes: RenfortEcarte[] = []

  const occupes = new Set(
    missions.filter((mission) => mission.date === demande.date).map((mission) => mission.renfortId),
  )
  const coutMaximum = Math.max(1, ...renforts.map((renfort) => renfort.coutHoraire))

  for (const renfort of renforts) {
    if (!renfort.actif) continue
    const nom = nomRenfort(renfort)

    if (!renfort.rayons.includes(demande.rayonId)) {
      ecartes.push({ renfort, motif: `${nom} n’intervient pas dans ce rayon.` })
      continue
    }
    if (!renfort.joursPossibles.includes(jour)) {
      ecartes.push({ renfort, motif: `${nom} n’est habituellement pas disponible ce jour-là.` })
      continue
    }
    if (occupes.has(renfort.id)) {
      ecartes.push({ renfort, motif: `${nom} a déjà une mission ce jour-là.` })
      continue
    }
    const critiquesManquantes = demande.competencesCritiques.filter(
      (competence) => !autonome(renfort, competence),
    )
    if (critiquesManquantes.length > 0) {
      ecartes.push({
        renfort,
        motif:
          `${nom} n’est pas autonome en « ${critiquesManquantes.join(' », « ')} », ` +
          `indispensable pour tenir ce poste.`,
      })
      continue
    }
    const couvertes = demande.competencesRequises.filter((competence) => autonome(renfort, competence))
    const manquantes = demande.competencesRequises.filter((competence) => !autonome(renfort, competence))
    if (demande.competencesRequises.length > 0 && couvertes.length === 0) {
      ecartes.push({
        renfort,
        motif: `${nom} n’est autonome sur aucune des compétences attendues.`,
      })
      continue
    }

    const atouts: string[] = []
    const reserves: string[] = []
    let score = 0

    // Competences : le critere principal.
    if (demande.competencesRequises.length === 0) {
      score += 40
    } else {
      score += (couvertes.length / demande.competencesRequises.length) * 40
      if (manquantes.length === 0) atouts.push('Couvre toutes les compétences attendues')
      else {
        atouts.push(`Couvre ${couvertes.length} compétence${couvertes.length > 1 ? 's' : ''} sur ${demande.competencesRequises.length}`)
        reserves.push(`Ne couvre pas « ${manquantes.join(' », « ')} »`)
      }
    }

    // Connaissance du rayon : quelqu'un qui y est deja venu est plus vite efficace.
    const dejaVenu = missions.filter(
      (mission) => mission.renfortId === renfort.id && mission.rayonId === demande.rayonId,
    ).length
    if (dejaVenu > 0) {
      score += Math.min(25, dejaVenu * 5)
      atouts.push(`Déjà venu ${dejaVenu} fois dans ce rayon`)
    } else {
      reserves.push('N’est jamais venu dans ce rayon')
    }

    // Cout : a competence egale, le moins cher d'abord.
    score += (1 - renfort.coutHoraire / coutMaximum) * 20 + 5
    const coutEstime = arrondi(heures * renfort.coutHoraire)
    atouts.push(`Coût estimé ${coutEstime.toFixed(2).replace('.', ',')} €`)

    if (renfort.contactAutorise) {
      score += 10
    } else {
      reserves.push('N’a pas donné son accord pour être recontacté')
    }

    const proposition = { renfort, score: arrondi(score), atouts, reserves, coutEstime }
    if (manquantes.length === 0) possibles.push(proposition)
    else partiels.push(proposition)
  }

  const parScore = (a: RenfortPropose, b: RenfortPropose) =>
    b.score - a.score || a.renfort.id.localeCompare(b.renfort.id)
  return {
    possibles: possibles.sort(parScore),
    partiels: partiels.sort(parScore),
    ecartes: ecartes.sort((a, b) => a.renfort.id.localeCompare(b.renfort.id)),
  }
}

export interface LigneBilan {
  readonly renfortId: string
  readonly missions: number
  readonly heures: number
  readonly cout: number
}

export interface BilanVivier {
  readonly lignes: readonly LigneBilan[]
  readonly heures: number
  readonly cout: number
}

/** Heures et cout des missions entre deux dates incluses. */
export function bilanDesMissions(
  missions: readonly Mission[],
  renforts: readonly Renfort[],
  debut: string,
  fin: string,
): BilanVivier {
  const parRenfort = new Map<string, { missions: number; heures: number; cout: number }>()
  for (const mission of missions) {
    if (mission.date < debut || mission.date > fin) continue
    const renfort = renforts.find((candidat) => candidat.id === mission.renfortId)
    const heures = heuresTravaillees(mission)
    const cumul = parRenfort.get(mission.renfortId) ?? { missions: 0, heures: 0, cout: 0 }
    parRenfort.set(mission.renfortId, {
      missions: cumul.missions + 1,
      heures: cumul.heures + heures,
      cout: cumul.cout + heures * (renfort?.coutHoraire ?? 0),
    })
  }
  const lignes = [...parRenfort.entries()]
    .map(([renfortId, cumul]) => ({
      renfortId,
      missions: cumul.missions,
      heures: arrondi(cumul.heures),
      cout: arrondi(cumul.cout),
    }))
    .sort((a, b) => b.heures - a.heures || a.renfortId.localeCompare(b.renfortId))
  return {
    lignes,
    heures: arrondi(lignes.reduce((somme, ligne) => somme + ligne.heures, 0)),
    cout: arrondi(lignes.reduce((somme, ligne) => somme + ligne.cout, 0)),
  }
}
