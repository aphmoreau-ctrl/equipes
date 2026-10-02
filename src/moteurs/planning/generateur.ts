import { estAbsent, type Absence } from '../../domaine/absence'
import { jourDeLaSemaine, jourEnTexte, semaineDe } from '../../domaine/calendrier'
import {
  enFormation,
  estAutonome,
  estDisponible,
  peutTravaillerDans,
  type Collaborateur,
} from '../../domaine/collaborateur'
import type { HoraireType, Rayon } from '../../domaine/magasin'
import { TRANCHES_PAR_JOUR, duree, enMinutes } from '../../domaine/temps'
import type { BesoinJour } from '../besoin'
import { contexteDeVerification, verifier, type ParametresRegles, type Vacation } from '../regles'
import {
  competencesCritiquesDecouvertes,
  manqueRestant,
  penaliser,
  penalitePersonne,
  POIDS_PAR_DEFAUT,
  repereDeVacation,
  sujetionMoyenne,
  type DetailPenalites,
  type PoidsPenalites,
} from './score'
import { heuresEnTexte } from '../../domaine/nombres'

/**
 * Generation automatique du planning (cahier des charges §9.3).
 *
 * Le resultat est une PROPOSITION : l'utilisateur valide et ajuste.
 *
 * Deux garanties tenues par construction :
 * - aucune contrainte dure n'est violee : chaque affectation est repassee au
 *   crible des regles legales avant d'etre retenue ;
 * - le resultat est DETERMINISTE : a donnees egales, le meme planning. Aucun
 *   tirage au hasard, et tous les parcours sont tries.
 */

export interface EntreesGeneration {
  /** Lundi de la semaine a construire. */
  readonly semaine: string
  readonly rayons: readonly Rayon[]
  /** Besoin de chaque rayon pour chaque jour de la semaine. */
  readonly besoins: readonly BesoinJour[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly horairesTypes: readonly HoraireType[]
  readonly parametres: ParametresRegles
  readonly poids?: PoidsPenalites
  /** Vacations des semaines precedentes, pour les regles et la regularite. */
  readonly vacationsAnterieures?: readonly Vacation[]
  /** Planning de la semaine precedente, pour limiter les changements. */
  readonly planningPrecedent?: readonly Vacation[]
  /** Temps de calcul maximal, en millisecondes. */
  readonly dureeMaximaleMs?: number
}

export interface ResultatGeneration {
  readonly vacations: readonly Vacation[]
  readonly penalites: DetailPenalites
  /** Nombre d'affectations essayees. */
  readonly essais: number
  /** Nombre d'echanges retenus pendant l'amelioration. */
  readonly ameliorations: number
  readonly dureeMs: number
  /** Ce que le moteur n'a pas su resoudre, en francais. */
  readonly restesAExpliquer: readonly string[]
}

interface Candidat {
  readonly collaborateur: Collaborateur
  readonly rayon: Rayon
  readonly jour: string
  readonly horaire: HoraireType
}

const DUREE_MAXIMALE_PAR_DEFAUT = 4000

function identifiant(candidat: Candidat): string {
  return `g-${candidat.collaborateur.id}-${candidat.jour}-${candidat.horaire.id}-${candidat.rayon.id}`
}

function enVacation(candidat: Candidat): Vacation {
  return {
    id: identifiant(candidat),
    collaborateurId: candidat.collaborateur.id,
    rayonId: candidat.rayon.id,
    jour: candidat.jour,
    debut: candidat.horaire.debut,
    fin: candidat.horaire.fin,
    pauseMinutes: candidat.horaire.pauseMinutes,
    pauseDebut: candidat.horaire.pauseDebut,
  }
}

/**
 * Contraintes DURES. Une affectation qui en viole une seule est rejetee,
 * quel que soit son interet par ailleurs.
 */
function affectationPermise(
  vacation: Vacation,
  collaborateur: Collaborateur,
  dejaPlacees: readonly Vacation[],
  entrees: EntreesGeneration,
  competencesCritiques: readonly string[],
): boolean {
  if (!collaborateur.actif) return false
  if (!peutTravaillerDans(collaborateur, vacation.rayonId)) return false
  if (estAbsent(entrees.absences, collaborateur.id, vacation.jour)) return false
  if (!estDisponible(collaborateur, jourDeLaSemaine(vacation.jour))) return false

  // Hors des dates du contrat : la personne n'est pas (ou plus) dans l'effectif.
  if (vacation.jour < collaborateur.dateEntree) return false
  if (collaborateur.finContrat !== null && vacation.jour > collaborateur.finContrat) return false

  // En formation au CFA : ce temps est deja du temps de travail (L6222-24).
  if (enFormation(collaborateur, vacation.jour) !== undefined) return false

  // Plage de disponibilite restreinte : la vacation doit tenir dedans.
  const disponibilite = collaborateur.disponibilites.find(
    (candidate) => candidate.jour === jourDeLaSemaine(vacation.jour),
  )
  if (disponibilite?.plage != null) {
    if (enMinutes(vacation.debut) < enMinutes(disponibilite.plage.debut)) return false
    if (
      enMinutes(vacation.debut) + duree(vacation.debut, vacation.fin) >
      enMinutes(disponibilite.plage.fin)
    ) {
      return false
    }
  }

  // Competences critiques du poste : sans elles, le poste n'est pas tenu.
  for (const competence of competencesCritiques) {
    if (!estAutonome(collaborateur, competence)) return false
  }

  // Une seule vacation par personne et par jour dans la proposition initiale :
  // les coupures se decident a la main, pas automatiquement.
  if (
    dejaPlacees.some(
      (autre) => autre.collaborateurId === collaborateur.id && autre.jour === vacation.jour,
    )
  ) {
    return false
  }

  // Regles legales : on ne verifie que la personne concernee, c'est suffisant
  // et beaucoup plus rapide.
  const siennes = [
    ...dejaPlacees.filter((autre) => autre.collaborateurId === collaborateur.id),
    vacation,
  ]
  const infractions = verifier(
    contexteDeVerification(siennes, entrees.parametres, {
      collaborateurs: [collaborateur],
      vacationsAnterieures: (entrees.vacationsAnterieures ?? []).filter(
        (autre) => autre.collaborateurId === collaborateur.id,
      ),
    }),
  )
  return !infractions.some((infraction) => infraction.severite === 'bloquante')
}

/**
 * Construit une proposition de planning pour la semaine.
 *
 * Deroulement :
 * 1. tant qu'il reste du besoin decouvert, on cherche l'affectation qui le
 *    reduit le plus, competences critiques d'abord ;
 * 2. on complete ensuite chacun jusqu'a ses heures de contrat ;
 * 3. on tente enfin des echanges tant qu'ils ameliorent le score, dans la
 *    limite du temps accorde.
 */
export function genererLePlanning(entrees: EntreesGeneration): ResultatGeneration {
  const debutCalcul = Date.now()
  const limite = entrees.dureeMaximaleMs ?? DUREE_MAXIMALE_PAR_DEFAUT
  const poids = entrees.poids ?? POIDS_PAR_DEFAUT
  const jours = semaineDe(entrees.semaine)

  const rayons = [...entrees.rayons].sort((a, b) => a.ordre - b.ordre)
  const equipe = [...entrees.collaborateurs]
    .filter((collaborateur) => collaborateur.actif)
    .sort((a, b) => a.id.localeCompare(b.id))
  const horaires = [...entrees.horairesTypes].sort((a, b) => a.debut.localeCompare(b.debut))

  const moyenne = sujetionMoyenne(equipe)
  const reperesPrecedents = new Set(
    (entrees.planningPrecedent ?? []).map((vacation) => repereDeVacation(vacation)),
  )

  /*
   * Etat tenu a jour au fil des affectations.
   *
   * Sans ces compteurs, chaque essai relirait le planning entier : sur sept
   * rayons et sept jours, le calcul devenait interminable. Ici, ajouter une
   * vacation ne touche que les quatorze tranches qu'elle couvre.
   */
  interface EtatCreneau {
    readonly besoin: BesoinJour
    /** Nombre de personnes presentes, par tranche de 30 min. */
    readonly presents: Int16Array
    /** Nombre de personnes autonomes presentes, par competence critique et par tranche. */
    readonly autonomes: Map<string, Int16Array>
  }

  const creneaux = new Map<string, EtatCreneau>()
  const cle = (rayonId: string, jour: string) => `${rayonId}|${jour}`

  for (const besoin of entrees.besoins) {
    const autonomes = new Map<string, Int16Array>()
    for (const tranche of besoin.tranches) {
      for (const competence of tranche.competencesCritiques) {
        if (!autonomes.has(competence)) autonomes.set(competence, new Int16Array(TRANCHES_PAR_JOUR))
      }
    }
    creneaux.set(cle(besoin.rayonId, besoin.date), {
      besoin,
      presents: new Int16Array(TRANCHES_PAR_JOUR),
      autonomes,
    })
  }

  /** Tranches couvertes par chaque horaire type, calculees une seule fois. */
  const tranchesDe = new Map<string, number[]>()
  for (const horaire of horaires) {
    const debutH = enMinutes(horaire.debut)
    const finH = debutH + duree(horaire.debut, horaire.fin)
    const pauseDebut = enMinutes(horaire.pauseDebut)
    const pauseFin = pauseDebut + horaire.pauseMinutes

    const couvertes: number[] = []
    for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
      const debutTranche = index * 30
      const finTranche = debutTranche + 30
      if (!(debutH < finTranche && finH > debutTranche)) continue
      const enPause = Math.min(finTranche, pauseFin) - Math.max(debutTranche, pauseDebut)
      if (enPause >= 15) continue
      couvertes.push(index)
    }
    tranchesDe.set(horaire.id, couvertes)
  }

  const parPersonne = new Map<string, Vacation[]>()
  const joursOccupes = new Map<string, Set<string>>()
  const placees: Vacation[] = []

  function inscrire(vacation: Vacation, horaire: HoraireType, collaborateur: Collaborateur, sens: 1 | -1): void {
    const creneau = creneaux.get(cle(vacation.rayonId, vacation.jour))
    if (creneau !== undefined) {
      for (const index of tranchesDe.get(horaire.id) ?? []) {
        creneau.presents[index] = (creneau.presents[index] ?? 0) + sens
        for (const [competence, compteurs] of creneau.autonomes) {
          if (estAutonome(collaborateur, competence)) {
            compteurs[index] = (compteurs[index] ?? 0) + sens
          }
        }
      }
    }

    const siennes = parPersonne.get(collaborateur.id) ?? []
    parPersonne.set(
      collaborateur.id,
      sens === 1 ? [...siennes, vacation] : siennes.filter((autre) => autre.id !== vacation.id),
    )

    const occupes = joursOccupes.get(collaborateur.id) ?? new Set<string>()
    if (sens === 1) occupes.add(vacation.jour)
    else occupes.delete(vacation.jour)
    joursOccupes.set(collaborateur.id, occupes)
  }

  /**
   * Variation de penalite provoquee par l'ajout d'une vacation.
   * Negative = le planning s'ameliore.
   */
  function variationDAjout(
    vacation: Vacation,
    horaire: HoraireType,
    collaborateur: Collaborateur,
  ): number {
    const creneau = creneaux.get(cle(vacation.rayonId, vacation.jour))
    let variation = 0

    if (creneau !== undefined) {
      for (const index of tranchesDe.get(horaire.id) ?? []) {
        const attendu = creneau.besoin.tranches[index]?.personnes ?? 0
        const presents = creneau.presents[index] ?? 0

        const manqueAvant = Math.max(0, attendu - presents)
        const manqueApres = Math.max(0, attendu - (presents + 1))
        const tropAvant = Math.max(0, presents - attendu)
        const tropApres = Math.max(0, presents + 1 - attendu)

        variation += (manqueApres - manqueAvant) * poids.manque
        variation += (tropApres - tropAvant) * poids.sureffectif

        for (const competence of creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
          const compteurs = creneau.autonomes.get(competence)
          if (compteurs === undefined) continue
          if ((compteurs[index] ?? 0) === 0 && estAutonome(collaborateur, competence)) {
            variation -= poids.competenceCritique
          }
        }
      }
    }

    const siennes = parPersonne.get(collaborateur.id) ?? []
    variation +=
      penalitePersonne(collaborateur, [...siennes, vacation], poids, moyenne, reperesPrecedents) -
      penalitePersonne(collaborateur, siennes, poids, moyenne, reperesPrecedents)

    return variation
  }

  /** Ecarts evidents, verifies sans lancer le controle legal. */
  function ecarteDEmblee(collaborateur: Collaborateur, rayonId: string, jour: string): boolean {
    if (!peutTravaillerDans(collaborateur, rayonId)) return true
    if (estAbsent(entrees.absences, collaborateur.id, jour)) return true
    if (!estDisponible(collaborateur, jourDeLaSemaine(jour))) return true
    return joursOccupes.get(collaborateur.id)?.has(jour) === true
  }

  let essais = 0

  /**
   * Cherche l'ajout le plus profitable.
   *
   * Le controle legal etant couteux, on classe d'abord tous les candidats par
   * interet, puis on ne controle que les meilleurs, jusqu'a en trouver un qui
   * passe. En pratique, deux ou trois controles suffisent.
   */
  function meilleurAjout(exigeantSurLeBesoin: boolean): { vacation: Vacation; horaire: HoraireType; collaborateur: Collaborateur } | null {
    const candidats: {
      vacation: Vacation
      horaire: HoraireType
      collaborateur: Collaborateur
      critiques: string[]
      variation: number
    }[] = []

    for (const rayon of rayons) {
      for (const jour of jours) {
        const creneau = creneaux.get(cle(rayon.id, jour))
        if (creneau === undefined) continue

        if (exigeantSurLeBesoin) {
          let resteAFaire = false
          for (let index = 0; index < TRANCHES_PAR_JOUR && !resteAFaire; index += 1) {
            const attendu = creneau.besoin.tranches[index]?.personnes ?? 0
            if (attendu > (creneau.presents[index] ?? 0)) resteAFaire = true
            for (const competence of creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
              if ((creneau.autonomes.get(competence)?.[index] ?? 0) === 0) resteAFaire = true
            }
          }
          if (!resteAFaire) continue
        }

        for (const horaire of horaires) {
          const critiques = new Set<string>()
          for (const index of tranchesDe.get(horaire.id) ?? []) {
            for (const competence of creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
              if ((creneau.autonomes.get(competence)?.[index] ?? 0) === 0) critiques.add(competence)
            }
          }

          for (const collaborateur of equipe) {
            essais += 1
            if (ecarteDEmblee(collaborateur, rayon.id, jour)) continue

            const vacation = enVacation({ collaborateur, rayon, jour, horaire })
            const variation = variationDAjout(vacation, horaire, collaborateur)
            if (variation >= -1e-9) continue

            candidats.push({
              vacation,
              horaire,
              collaborateur,
              critiques: [...critiques].sort(),
              variation,
            })
          }
        }
      }
    }

    candidats.sort((a, b) => a.variation - b.variation || a.vacation.id.localeCompare(b.vacation.id))

    for (const candidat of candidats) {
      if (Date.now() - debutCalcul >= limite) return null
      if (
        affectationPermise(
          candidat.vacation,
          candidat.collaborateur,
          parPersonne.get(candidat.collaborateur.id) ?? [],
          entrees,
          candidat.critiques,
        )
      ) {
        return { vacation: candidat.vacation, horaire: candidat.horaire, collaborateur: candidat.collaborateur }
      }
    }

    return null
  }

  // ----------------------------- 1 et 2. Couvrir, puis completer les contrats
  for (const exigeant of [true, false]) {
    let continuer = true
    while (continuer && Date.now() - debutCalcul < limite) {
      const ajout = meilleurAjout(exigeant)
      if (ajout === null) {
        continuer = false
      } else {
        inscrire(ajout.vacation, ajout.horaire, ajout.collaborateur, 1)
        placees.push(ajout.vacation)
      }
    }
  }

  // ------------------------------- 3. Amelioration par echanges de personnes
  let ameliorations = 0
  let continuerAmelioration = true

  while (continuerAmelioration && Date.now() - debutCalcul < limite) {
    continuerAmelioration = false

    for (let position = 0; position < placees.length; position += 1) {
      if (Date.now() - debutCalcul >= limite) break

      const actuelle = placees[position] as Vacation
      const horaire = horaires.find((candidat) => candidat.debut === actuelle.debut)
      const titulaire = equipe.find((c) => c.id === actuelle.collaborateurId)
      if (horaire === undefined || titulaire === undefined) continue

      // On retire la vacation pour mesurer ce que son absence coute.
      inscrire(actuelle, horaire, titulaire, -1)
      const coutDuTitulaire = variationDAjout(actuelle, horaire, titulaire)

      const creneau = creneaux.get(cle(actuelle.rayonId, actuelle.jour))
      const critiques = new Set<string>()
      if (creneau !== undefined) {
        for (const index of tranchesDe.get(horaire.id) ?? []) {
          for (const competence of creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
            if ((creneau.autonomes.get(competence)?.[index] ?? 0) === 0) critiques.add(competence)
          }
        }
      }

      // Candidats classes par interet, controle legal sur les meilleurs seulement.
      const echanges: { collaborateur: Collaborateur; vacation: Vacation; variation: number }[] = []
      for (const collaborateur of equipe) {
        if (collaborateur.id === titulaire.id) continue
        essais += 1
        if (ecarteDEmblee(collaborateur, actuelle.rayonId, actuelle.jour)) continue

        const proposee: Vacation = {
          ...actuelle,
          id: `${actuelle.id}-${collaborateur.id}`,
          collaborateurId: collaborateur.id,
        }
        const variation = variationDAjout(proposee, horaire, collaborateur)
        if (variation >= coutDuTitulaire - 1e-9) continue
        echanges.push({ collaborateur, vacation: proposee, variation })
      }

      echanges.sort((a, b) => a.variation - b.variation || a.vacation.id.localeCompare(b.vacation.id))

      let echange: (typeof echanges)[number] | undefined
      for (const candidat of echanges) {
        if (
          affectationPermise(
            candidat.vacation,
            candidat.collaborateur,
            parPersonne.get(candidat.collaborateur.id) ?? [],
            entrees,
            [...critiques].sort(),
          )
        ) {
          echange = candidat
          break
        }
      }

      if (echange === undefined) {
        // Aucun echange profitable : on remet le titulaire en place.
        inscrire(actuelle, horaire, titulaire, 1)
        continue
      }

      inscrire(echange.vacation, horaire, echange.collaborateur, 1)
      placees[position] = echange.vacation
      ameliorations += 1
      continuerAmelioration = true
      break
    }
  }

  // ------------------------------------------------ Resultat et restes
  const ordonnees = [...placees].sort(
    (a, b) =>
      a.jour.localeCompare(b.jour) ||
      a.debut.localeCompare(b.debut) ||
      a.rayonId.localeCompare(b.rayonId) ||
      a.collaborateurId.localeCompare(b.collaborateurId),
  )

  const restes: string[] = []
  for (const besoin of entrees.besoins) {
    const duRayon = ordonnees.filter(
      (vacation) => vacation.rayonId === besoin.rayonId && vacation.jour === besoin.date,
    )
    const manque = manqueRestant(besoin, duRayon)
    const critiques = competencesCritiquesDecouvertes(besoin, duRayon, equipe)
    if (manque === 0 && critiques === 0) continue

    const nomDuRayon = rayons.find((rayon) => rayon.id === besoin.rayonId)?.nom ?? besoin.rayonId
    if (critiques > 0) {
      restes.push(
        `${nomDuRayon}, le ${jourEnTexte(besoin.date)} : une compétence indispensable reste sans titulaire. ` +
          `Personne de disponible ne la maîtrise, ou les règles légales l’interdisent.`,
      )
    } else {
      restes.push(
        `${nomDuRayon}, le ${jourEnTexte(besoin.date)} : il manque encore ${heuresEnTexte((manque / 2))} ` +
          `de présence. Aucune affectation supplémentaire n’était possible sans enfreindre une règle.`,
      )
    }
  }

  return {
    vacations: ordonnees,
    penalites: penaliser(ordonnees, entrees.besoins, equipe, poids, entrees.planningPrecedent ?? []),
    essais,
    ameliorations,
    dureeMs: Date.now() - debutCalcul,
    restesAExpliquer: restes,
  }
}
