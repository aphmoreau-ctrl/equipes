import type { Vacation } from '../regles'
import {
  genererLePlanning,
  type EntreesGeneration,
  type ResultatGeneration,
} from './generateur'
import { mesurerLEquite, type EquiteDUnePersonne } from './equite'

/**
 * Construction de plusieurs semaines a l'avance (§9.9).
 *
 * Les semaines sont calculees DANS L'ORDRE, et chacune recoit en entree ce qui
 * a ete decide pour les precedentes. C'est ce qui permet a l'equite de se
 * reporter : celui qui a pris le samedi de la premiere semaine ne reprendra
 * pas celui de la deuxieme.
 *
 * Calculer les quatre semaines d'un bloc, sans ce report, reviendrait a faire
 * quatre fois le meme planning — et a donner quatre fois le samedi a la meme
 * personne.
 */

/** Une semaine a construire, besoins deja calcules. */
export interface SemaineADemander {
  readonly semaine: string
  readonly besoins: readonly import('../besoin').BesoinJour[]
  readonly vacationsVerrouillees?: readonly Vacation[]
}

/**
 * Entrees entierement SERIALISABLES : aucune fonction.
 *
 * C'est la condition pour que le calcul parte dans un fil separe — on ne peut
 * pas envoyer de fonction a un Web Worker. Les besoins sont donc calcules
 * avant, par l'ecran, et transmis tels quels.
 */
export interface EntreesPlusieursSemaines
  extends Omit<EntreesGeneration, 'semaine' | 'besoins' | 'vacationsVerrouillees'> {
  readonly semaines: readonly SemaineADemander[]
}

export interface SemaineConstruite {
  readonly semaine: string
  readonly resultat: ResultatGeneration
}

export interface ResultatPlusieursSemaines {
  readonly semaines: readonly SemaineConstruite[]
  /** Equite constatee a la fin, sur l'ensemble des semaines construites. */
  readonly equite: readonly EquiteDUnePersonne[]
  readonly dureeMs: number
}

export function genererPlusieursSemaines(
  entrees: EntreesPlusieursSemaines,
): ResultatPlusieursSemaines {
  const depart = Date.now()
  const construites: SemaineConstruite[] = []

  /** Tout ce qui a ete decide jusqu'ici : nourrit l'equite et les regles. */
  let acquis: Vacation[] = [...(entrees.vacationsAnterieures ?? [])]
  let precedent: readonly Vacation[] = entrees.planningPrecedent ?? []

  for (const aDemander of entrees.semaines) {
    const resultat = genererLePlanning({
      ...entrees,
      semaine: aDemander.semaine,
      besoins: aDemander.besoins,
      vacationsAnterieures: acquis,
      planningPrecedent: precedent,
      vacationsVerrouillees: aDemander.vacationsVerrouillees ?? [],
    })

    construites.push({ semaine: aDemander.semaine, resultat })
    acquis = [...acquis, ...resultat.vacations]
    precedent = resultat.vacations
  }

  const derniere =
    construites[construites.length - 1]?.semaine ?? entrees.semaines[0]?.semaine ?? ''

  return {
    semaines: construites,
    equite: mesurerLEquite(
      derniere,
      acquis,
      entrees.collaborateurs,
      Math.max(entrees.semaines.length, 1),
    ),
    dureeMs: Date.now() - depart,
  }
}
