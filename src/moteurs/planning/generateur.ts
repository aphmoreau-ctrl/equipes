import { estAbsent, type Absence } from '../../domaine/absence'
import { jourDeLaSemaine, jourEnTexte, semaineDe } from '../../domaine/calendrier'
import {
  enFormation,
  estAutonome,
  estDisponible,
  estJourDEcole,
  estMineur,
  nomAffiche,
  peutTravaillerDans,
  rayonsPossibles,
  type Collaborateur,
} from '../../domaine/collaborateur'
import {
  fenetresDuJour,
  JOURS_DE_REPOS_PREFERES_PAR_DEFAUT,
  JOURS_PRIORITAIRES_PAR_DEFAUT,
  PRIORITE_PAR_JOUR_PAR_DEFAUT,
  type Plage,
  type ReglesInternes,
} from '../../domaine/organisation'
import type { HoraireType, Rayon } from '../../domaine/magasin'
import {
  MINUTES_PAR_JOUR,
  TRANCHE_MINUTES,
  TRANCHES_PAR_JOUR,
  duree,
  enMinutes,
  enTexte,
} from '../../domaine/temps'
import type { BesoinJour } from '../besoin'
import { contexteDeVerification, verifier, type ParametresRegles, type Vacation } from '../regles'
import {
  competencesCritiquesDecouvertes,
  ecartAuContratEnHeures,
  manqueRestant,
  minutesAuContrat,
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
  /**
   * Vacations deja en place que l'utilisateur a VERROUILLEES.
   *
   * Elles ne bougent jamais : ni echangees, ni decalees, ni supprimees. Le
   * calcul les prend en compte — elles occupent la personne et couvrent le
   * besoin — puis complete autour. C'est ce qui fait de « Relancer » une
   * reprise du reste, et non un recommencement.
   */
  readonly vacationsVerrouillees?: readonly Vacation[]
  /** Temps de calcul maximal, en millisecondes. */
  readonly dureeMaximaleMs?: number
  /**
   * Regles internes (regles du planning v2) : pauses payees, plages de pause,
   * fin du poste du matin. Absentes = comportement d'avant.
   */
  readonly reglesInternes?: ReglesInternes
  /** Heures d'affluence par jour de la semaine (1 = lundi), pour placer les pauses. */
  readonly plagesAffluence?: Readonly<Record<number, readonly Plage[] | null>>
}

export interface ResultatGeneration {
  readonly vacations: readonly Vacation[]
  readonly penalites: DetailPenalites
  /** Nombre d'affectations essayees. */
  readonly essais: number
  /** Nombre d'echanges retenus pendant l'amelioration. */
  readonly ameliorations: number
  /** Nombre de postes decales de 15 ou 30 minutes pour mieux coller au besoin. */
  readonly decalages: number
  /** Nombre de vacations laissees intactes parce qu'elles etaient verrouillees. */
  readonly verrouillees: number
  /** Retouches faites pour amener chacun a ses heures. */
  readonly ajustementsDHeures?: number
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
function raisonDeRefus(
  vacation: Vacation,
  collaborateur: Collaborateur,
  dejaPlacees: readonly Vacation[],
  entrees: EntreesGeneration,
  competencesCritiques: readonly string[],
): string | null {
  if (!collaborateur.actif) return 'ne fait plus partie de l’équipe'
  if (!peutTravaillerDans(collaborateur, vacation.rayonId)) return 'ne tient pas ce rayon'
  if (estAbsent(entrees.absences, collaborateur.id, vacation.jour)) return 'absent ou en congé'
  if (!estDisponible(collaborateur, jourDeLaSemaine(vacation.jour))) return 'jour de repos fixe'

  // Hors des dates du contrat : la personne n'est pas (ou plus) dans l'effectif.
  if (vacation.jour < collaborateur.dateEntree) return 'pas encore entré'
  if (collaborateur.finContrat !== null && vacation.jour > collaborateur.finContrat) return 'contrat terminé'

  // En formation au CFA : ce temps est deja du temps de travail (L6222-24).
  if (enFormation(collaborateur, vacation.jour) !== undefined) return 'en formation (CFA)'
  // Jour d'ecole habituel : jamais planifie en magasin.
  if (estJourDEcole(collaborateur, jourDeLaSemaine(vacation.jour))) return 'jour d’école'

  // « Le matin uniquement » : le poste finit au plus tard a l'heure reglee.
  if (
    collaborateur.posteDuMatin === 'contrainte' &&
    entrees.reglesInternes !== undefined &&
    enMinutes(vacation.debut) + duree(vacation.debut, vacation.fin) >
      enMinutes(entrees.reglesInternes.finDuMatin)
  ) {
    return 'le matin uniquement'
  }

  // Plage de disponibilite restreinte : la vacation doit tenir dedans.
  const disponibilite = collaborateur.disponibilites.find(
    (candidate) => candidate.jour === jourDeLaSemaine(vacation.jour),
  )
  if (disponibilite?.plage != null) {
    if (enMinutes(vacation.debut) < enMinutes(disponibilite.plage.debut)) return 'hors de ses disponibilités'
    if (
      enMinutes(vacation.debut) + duree(vacation.debut, vacation.fin) >
      enMinutes(disponibilite.plage.fin)
    ) {
      return 'hors de ses disponibilités'
    }
  }

  // Competences critiques du poste : sans elles, le poste n'est pas tenu.
  for (const competence of competencesCritiques) {
    if (!estAutonome(collaborateur, competence)) return `pas autonome en « ${competence} »`
  }

  // Une seule vacation par personne et par jour dans la proposition initiale :
  // les coupures se decident a la main, pas automatiquement.
  if (
    dejaPlacees.some(
      (autre) => autre.collaborateurId === collaborateur.id && autre.jour === vacation.jour,
    )
  ) {
    return 'travaille déjà ce jour-là'
  }

  /*
   * Regles legales : on ne verifie que la personne concernee, c'est suffisant
   * et beaucoup plus rapide.
   *
   * Les journees VOISINES comptent, meme si elles appartiennent a une autre
   * semaine : sans elles, un dimanche fini a 20h30 suivi d'un lundi commence a
   * 05h30 passait inapercu, parce que chaque semaine etait controlee seule.
   */
  const siennesDeLaSemaine = dejaPlacees.filter(
    (autre) => autre.collaborateurId === collaborateur.id,
  )
  const anterieures = (entrees.vacationsAnterieures ?? []).filter(
    (autre) => autre.collaborateurId === collaborateur.id,
  )
  const voisines = anterieures.filter(
    (autre) => Math.abs(ecartEnJours(autre.jour, vacation.jour)) <= 7,
  )

  const siennes = [...siennesDeLaSemaine, ...voisines, vacation]
  const infractions = verifier(
    contexteDeVerification(siennes, entrees.parametres, {
      collaborateurs: [collaborateur],
      // Les voisines sont deja dans « siennes » : les compter deux fois
      // fausserait la moyenne sur douze semaines.
      vacationsAnterieures: anterieures.filter((autre) => !voisines.includes(autre)),
    }),
  )
  const bloquante = infractions.find((infraction) => infraction.severite === 'bloquante')
  return bloquante === undefined ? null : `règle légale : ${bloquante.libelle.toLowerCase()}`
}

function affectationPermise(
  vacation: Vacation,
  collaborateur: Collaborateur,
  dejaPlacees: readonly Vacation[],
  entrees: EntreesGeneration,
  competencesCritiques: readonly string[],
): boolean {
  return raisonDeRefus(vacation, collaborateur, dejaPlacees, entrees, competencesCritiques) === null
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
/**
 * Retrouve (ou fabrique) l'horaire correspondant a une vacation.
 *
 * Une vacation verrouillee a pu etre posee a la main, a une heure qui ne
 * correspond a aucun horaire type. On lui construit alors son propre horaire,
 * et on calcule ses tranches comme pour les autres.
 */
function horairePour(
  vacation: Vacation,
  horaires: HoraireType[],
  tranchesDe: Map<string, number[]>,
): HoraireType {
  const connu = horaires.find(
    (candidat) =>
      candidat.debut === vacation.debut &&
      candidat.fin === vacation.fin &&
      candidat.pauseMinutes === vacation.pauseMinutes &&
      (vacation.pauseDebut === undefined || candidat.pauseDebut === vacation.pauseDebut),
  )
  if (connu !== undefined) return connu

  const pauseDebut = enTexte(
    enMinutes(vacation.debut) + Math.floor(duree(vacation.debut, vacation.fin) / 2),
  )
  const horaire: HoraireType = {
    id: `pose-${vacation.debut}-${vacation.fin}`,
    nom: `${vacation.debut}–${vacation.fin}`,
    debut: vacation.debut,
    fin: vacation.fin,
    pauseMinutes: vacation.pauseMinutes,
    pauseDebut,
  }
  horaires.push(horaire)
  tranchesDe.set(horaire.id, tranchesCouvertesPar(horaire))
  return horaire
}

/** Tranches reellement couvertes par un horaire, pause deduite. */
function tranchesCouvertesPar(horaire: HoraireType): number[] {
  const debutH = enMinutes(horaire.debut)
  const finH = debutH + duree(horaire.debut, horaire.fin)
  const pauseDebut = enMinutes(horaire.pauseDebut)
  const pauseFin = pauseDebut + horaire.pauseMinutes

  const couvertes: number[] = []
  for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
    const debutTranche = index * TRANCHE_MINUTES
    const finTranche = debutTranche + TRANCHE_MINUTES
    if (!(debutH < finTranche && finH > debutTranche)) continue
    // Une personne en pause sur la moitie de la tranche ne couvre pas.
    const enPause = Math.min(finTranche, pauseFin) - Math.max(debutTranche, pauseDebut)
    if (enPause >= TRANCHE_MINUTES / 2) continue
    couvertes.push(index)
  }
  return couvertes
}

/** Nombre de jours entre deux dates, signe. */
function ecartEnJours(unJour: string, autreJour: string): number {
  return Math.round(
    (new Date(`${unJour}T00:00:00Z`).getTime() - new Date(`${autreJour}T00:00:00Z`).getTime()) /
      86_400_000,
  )
}

/** Duree minimale d'un poste, en minutes : on ne deplace personne pour moins. */
const DUREE_MINIMALE_POSTE = 3 * 60

/** Durees proposees pour un poste court, de la plus courte a la plus longue. */
const DUREES_POSTES_COURTS = [DUREE_MINIMALE_POSTE, 4 * 60, 5 * 60]

/** Au-dela, le planning devient illisible et le calcul trop long. */
const MAXIMUM_POSTES_COURTS = 8

/**
 * Postes courts, tailles sur le besoin reel.
 *
 * Les horaires types du magasin font sept heures. Un rayon qui ne demande que
 * trois heures de travail — la cave, un dimanche de boulangerie — se voyait
 * donc attribuer une journee entiere, ou rien du tout. Ces postes de 3 a 5 h
 * se calent sur le debut et sur la fin du besoin, et comblent cet entre-deux.
 *
 * Moins de six heures : aucune pause legale n'est due (L3121-33).
 */
export function postesCourts(besoins: readonly BesoinJour[]): HoraireType[] {
  const formes = new Map<string, HoraireType>()

  for (const besoin of besoins) {
    const avecBesoin = besoin.tranches.filter((tranche) => tranche.personnes > 0)
    if (avecBesoin.length === 0) continue

    const premier = avecBesoin[0]?.index ?? 0
    const dernier = avecBesoin[avecBesoin.length - 1]?.index ?? 0
    const debutBesoin = premier * TRANCHE_MINUTES
    const finBesoin = (dernier + 1) * TRANCHE_MINUTES

    for (const minutes of DUREES_POSTES_COURTS) {
      // Un poste cale sur le debut du besoin, un autre sur sa fin.
      for (const debut of [debutBesoin, Math.max(0, finBesoin - minutes)]) {
        if (debut + minutes > MINUTES_PAR_JOUR) continue
        const cle = `${debut}|${minutes}`
        if (formes.has(cle)) continue
        formes.set(cle, {
          id: `court-${debut}-${minutes}`,
          nom: `${enTexte(debut)}–${enTexte(debut + minutes)}`,
          debut: enTexte(debut),
          fin: enTexte(debut + minutes),
          pauseMinutes: 0,
          pauseDebut: enTexte(debut),
        })
      }
    }
  }

  return [...formes.values()]
    .sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin))
    .slice(0, MAXIMUM_POSTES_COURTS)
}

/** Longueurs des postes de contrat, en minutes : de 6 h a 8 h 30. */
const LONGUEURS_POSTES_DE_CONTRAT = [6 * 60, 7 * 60, 7 * 60 + 15, 7 * 60 + 30, 8 * 60]

/** Heures d'accroche supplementaires, en plus de l'ouverture et de la fermeture. */
const ACCROCHES = ['08:30', '13:00']

/** Un rayon pilote par une grille d'effectifs porte une cible sur ses tranches. */
export function besoinAvecGrille(besoin: BesoinJour): boolean {
  return besoin.tranches.some((tranche) => tranche.cible !== undefined)
}

/**
 * Bornes de presence d'un rayon un jour donne, pour un rayon a grille :
 * ses horaires propres. « ferme » = personne ce jour-la. null = pas de borne.
 */
export function bornesDuCreneau(
  rayon: Rayon | undefined,
  besoin: BesoinJour,
): Plage | 'ferme' | null {
  if (rayon?.horairesPropres == null || !besoinAvecGrille(besoin)) return null
  const horaires = rayon.horairesPropres[jourDeLaSemaine(besoin.date)]
  if (!horaires.ouvert) return 'ferme'
  return { debut: horaires.ouverture, fin: horaires.fermeture }
}

/**
 * Duree de la pause d'un poste.
 *
 * Regle interne : 3 minutes par heure de presence. Regle legale : au moins
 * 20 minutes d'un seul tenant des 6 heures de travail, 30 minutes des
 * 4 h 30 pour un mineur.
 */
export function pauseDuPoste(
  minutes: number,
  regles: ReglesInternes,
  jeune: boolean,
  parametres: ParametresRegles,
): number {
  let pause = Math.round((minutes / 60) * regles.pauseMinutesParHeure)
  const seuil = jeune
    ? parametres.seuilDeclenchantLaPauseJeuneMinutes
    : parametres.seuilDeclenchantLaPauseMinutes
  const minimum = jeune
    ? parametres.dureeMinimaleDeLaPauseJeuneMinutes
    : parametres.dureeMinimaleDeLaPauseMinutes
  if (minutes - pause > seuil) pause = Math.max(pause, minimum)
  return pause
}

/**
 * Heure de debut de la pause : dans une plage autorisee, hors affluence, au
 * moins une heure apres l'arrivee et avant le depart. A defaut, au milieu.
 */
export function placerLaPause(
  debut: number,
  fin: number,
  pause: number,
  regles: ReglesInternes,
  affluence: readonly Plage[],
  fenetres: readonly Plage[] = regles.fenetresPause,
): number {
  const libre = (depart: number) =>
    depart >= debut + 60 &&
    depart + pause <= fin - 60 &&
    fenetres.some(
      (fenetre) => depart >= enMinutes(fenetre.debut) && depart + pause <= enMinutes(fenetre.fin),
    ) &&
    !(
      regles.pauseInterditeEnAffluence &&
      affluence.some(
        (plage) => depart < enMinutes(plage.fin) && depart + pause > enMinutes(plage.debut),
      )
    )
  // On vise le milieu du poste, puis on s'en ecarte quart d'heure par quart d'heure.
  const milieu = Math.round((debut + fin - pause) / 2 / TRANCHE_MINUTES) * TRANCHE_MINUTES
  for (let ecart = 0; ecart <= fin - debut; ecart += TRANCHE_MINUTES) {
    for (const depart of [milieu - ecart, milieu + ecart]) {
      if (libre(depart)) return depart
    }
  }
  return milieu
}

/**
 * Postes longs, pour que chacun fasse ses heures de contrat.
 *
 * Les postes courts couvrent le besoin ; ils ne suffisent pas a donner a
 * chacun ses 36 h 75. Ces postes de 6 h a 8 h 30 s'accrochent a l'ouverture
 * et a la fermeture de chaque rayon dote d'une grille, et a quelques heures
 * cles. Ils ne depassent jamais les horaires du rayon.
 */
export function postesDeContrat(
  besoins: readonly BesoinJour[],
  rayons: readonly Rayon[],
  regles: ReglesInternes,
  parametres: ParametresRegles,
  affluenceDuJour: (jour: number) => readonly Plage[],
  avecJeunes: boolean,
): HoraireType[] {
  const formes = new Map<string, HoraireType>()
  for (const besoin of besoins) {
    const bornes = bornesDuCreneau(
      rayons.find((rayon) => rayon.id === besoin.rayonId),
      besoin,
    )
    if (bornes === null || bornes === 'ferme') continue
    const ouverture = enMinutes(bornes.debut)
    const fermeture = enMinutes(bornes.fin)
    const affluence = affluenceDuJour(jourDeLaSemaine(besoin.date))

    const plage = fermeture - ouverture
    // Toute la plage, et des postes plus courts quand le rayon ouvre peu
    // (le dimanche matin) : sinon personne ne pourrait y etre place.
    const longueurs = new Set([
      ...LONGUEURS_POSTES_DE_CONTRAT,
      ...(plage < LONGUEURS_POSTES_DE_CONTRAT[0]! ? [3 * 60, 4 * 60, 5 * 60] : []),
      ...(plage >= 3 * 60 && plage <= 9 * 60 ? [plage] : []),
    ])
    for (const longueur of longueurs) {
      if (longueur > plage) continue
      const departs = new Set([
        ouverture,
        fermeture - longueur,
        ...ACCROCHES.map(enMinutes).filter(
          (depart) => depart > ouverture && depart + longueur < fermeture,
        ),
      ])
      for (const depart of departs) {
        for (const jeune of avecJeunes ? [false, true] : [false]) {
          const pause = pauseDuPoste(longueur, regles, jeune, parametres)
          const pauseDebut = placerLaPause(
            depart,
            depart + longueur,
            pause,
            regles,
            affluence,
            fenetresDuJour(regles, jourDeLaSemaine(besoin.date)),
          )
          // Une forme par horaire : la pause sera de toute facon replacee
          // a la fin, selon les plages du jour et la presence des collegues.
          const id = `contrat-${jeune ? 'j' : 'a'}-${enTexte(depart)}-${enTexte(depart + longueur)}-${pause}`
          if (formes.has(id)) continue
          formes.set(id, {
            id,
            nom: `${enTexte(depart)}–${enTexte(depart + longueur)}`,
            debut: enTexte(depart),
            fin: enTexte(depart + longueur),
            pauseMinutes: pause,
            pauseDebut: enTexte(pauseDebut),
          })
        }
      }
    }
  }
  return [...formes.values()].sort(
    (a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin) || a.id.localeCompare(b.id),
  )
}

export function genererLePlanning(entrees: EntreesGeneration): ResultatGeneration {
  const debutCalcul = Date.now()
  const limite = entrees.dureeMaximaleMs ?? DUREE_MAXIMALE_PAR_DEFAUT
  const poids = entrees.poids ?? POIDS_PAR_DEFAUT
  const jours = semaineDe(entrees.semaine)

  const rayons = [...entrees.rayons].sort((a, b) => a.ordre - b.ordre)
  const equipe = [...entrees.collaborateurs]
    .filter((collaborateur) => collaborateur.actif)
    .sort((a, b) => a.id.localeCompare(b.id))
  const regles = entrees.reglesInternes
  const pausesPayees = regles?.pausesPayeesIncluses ?? false
  const affluenceDuJour = (jour: number): readonly Plage[] =>
    entrees.plagesAffluence?.[jour] ?? []

  /*
   * Heures a placer cette semaine, par personne.
   *
   * Le contrat est la reference. Un jour de conge, d'absence, de formation
   * au CFA ou d'ecole compte pour un jour ouvrable (contrat / 6, decompte
   * legal des conges payes) : il est deja paye, on ne le fait pas
   * rattraper sur les autres jours.
   */
  const joursHabituels = regles?.joursHabituelsParSemaine ?? 6
  function joursNonTravailles(collaborateur: Collaborateur): string[] {
    return jours.filter(
      (jour) =>
        estAbsent(entrees.absences, collaborateur.id, jour) ||
        enFormation(collaborateur, jour) !== undefined ||
        estJourDEcole(collaborateur, jourDeLaSemaine(jour)),
    )
  }
  const heuresVisees = new Map<string, number>()
  if (regles !== undefined) {
    for (const collaborateur of entrees.collaborateurs) {
      const absents = Math.min(joursNonTravailles(collaborateur).length, joursHabituels)
      heuresVisees.set(
        collaborateur.id,
        (collaborateur.heuresHebdomadaires * (joursHabituels - absents)) / joursHabituels,
      )
    }
  }
  const visee = (collaborateur: Collaborateur): number | undefined =>
    heuresVisees.get(collaborateur.id)

  /** Priorite d'un jour (vendredi et samedi d'abord, par defaut). */
  const joursPrioritaires = regles?.joursPrioritaires ?? JOURS_PRIORITAIRES_PAR_DEFAUT
  const joursDeRepos = regles?.joursDeReposPreferes ?? JOURS_DE_REPOS_PREFERES_PAR_DEFAUT
  const estPrioritaire = (date: string): boolean =>
    regles !== undefined && joursPrioritaires.includes(jourDeLaSemaine(date))
  const estJourDeRepos = (date: string): boolean =>
    regles !== undefined && joursDeRepos.includes(jourDeLaSemaine(date))
  const prioriteDuJour = (date: string): number =>
    !estPrioritaire(date)
      ? 1
      : ((regles?.prioriteParJour ?? PRIORITE_PAR_JOUR_PAR_DEFAUT)[jourDeLaSemaine(date)] ?? 1.5)
  const horaires: HoraireType[] = [
    ...entrees.horairesTypes,
    ...postesCourts(entrees.besoins),
    ...(regles === undefined
      ? []
      : postesDeContrat(
          entrees.besoins,
          entrees.rayons,
          regles,
          entrees.parametres,
          affluenceDuJour,
          equipe.some(estMineur),
        )),
  ].sort((a, b) => a.debut.localeCompare(b.debut) || a.id.localeCompare(b.id))

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
    /** Nombre de personnes presentes, tranche par tranche. */
    readonly presents: Int16Array
    /** Nombre de personnes autonomes presentes, par competence critique et par tranche. */
    readonly autonomes: Map<string, Int16Array>
    /** Horaires du rayon a respecter (rayon a grille), « ferme », ou null. */
    readonly bornes: Plage | 'ferme' | null
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
      bornes: bornesDuCreneau(
        rayons.find((rayon) => rayon.id === besoin.rayonId),
        besoin,
      ),
    })
  }

  /** Le poste tient-il dans les horaires du rayon ce jour-la ? */
  function dansLesBornes(rayonId: string, jour: string, debut: string, fin: string): boolean {
    const bornes = creneaux.get(cle(rayonId, jour))?.bornes ?? null
    if (bornes === null) return true
    if (bornes === 'ferme') return false
    const depart = enMinutes(debut)
    return (
      depart >= enMinutes(bornes.debut) && depart + duree(debut, fin) <= enMinutes(bornes.fin)
    )
  }

  /** Tranches couvertes par chaque horaire type, calculees une seule fois. */
  const tranchesDe = new Map<string, number[]>()
  for (const horaire of horaires) {
    tranchesDe.set(horaire.id, tranchesCouvertesPar(horaire))
  }

  const parPersonne = new Map<string, Vacation[]>()
  const joursOccupes = new Map<string, Set<string>>()
  const placees: Vacation[] = []

  /*
   * Memoires de calcul. Trouver le meilleur ajout revient a evaluer des
   * dizaines de milliers de combinaisons ; d'un tour a l'autre, presque rien
   * ne change. La part d'un creneau ne bouge que si on y place quelqu'un ; la
   * penalite d'une personne, que si on lui donne un poste. Chaque memoire
   * porte donc un numero de version, et se recalcule seulement s'il a change.
   */
  const versionDuCreneau = new Map<string, number>()
  const versionDeLaPersonne = new Map<string, number>()
  const memoireCreneau = new Map<
    string,
    { readonly version: number; readonly base: number; readonly critiques: ReadonlyMap<string, number> }
  >()
  const memoirePersonne = new Map<string, { readonly version: number; readonly valeur: number }>()

  function inscrire(vacation: Vacation, horaire: HoraireType, collaborateur: Collaborateur, sens: 1 | -1): void {
    const cleCreneau = cle(vacation.rayonId, vacation.jour)
    versionDuCreneau.set(cleCreneau, (versionDuCreneau.get(cleCreneau) ?? 0) + 1)
    versionDeLaPersonne.set(collaborateur.id, (versionDeLaPersonne.get(collaborateur.id) ?? 0) + 1)
    const creneau = creneaux.get(cleCreneau)
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
    const cleCreneau = cle(vacation.rayonId, vacation.jour)
    const creneau = creneaux.get(cleCreneau)
    let variation = 0

    if (creneau !== undefined) {
      const part = partDuCreneau(cleCreneau, creneau, horaire)
      variation += part.base
      for (const [competence, tranches] of part.critiques) {
        if (estAutonome(collaborateur, competence)) variation -= tranches * poids.competenceCritique
      }
    }

    const siennes = parPersonne.get(collaborateur.id) ?? []
    variation +=
      penalitePersonne(
        collaborateur,
        [...siennes, vacation],
        poids,
        moyenne,
        reperesPrecedents,
        pausesPayees,
        visee(collaborateur),
      ) - penaliteActuelle(collaborateur)

    return variation
  }

  /** Penalite actuelle d'une personne, memorisee tant qu'on ne lui ajoute rien. */
  function penaliteActuelle(collaborateur: Collaborateur): number {
    const version = versionDeLaPersonne.get(collaborateur.id) ?? 0
    const memoire = memoirePersonne.get(collaborateur.id)
    if (memoire?.version === version) return memoire.valeur
    const valeur = penalitePersonne(
      collaborateur,
      parPersonne.get(collaborateur.id) ?? [],
      poids,
      moyenne,
      reperesPrecedents,
      pausesPayees,
      visee(collaborateur),
    )
    memoirePersonne.set(collaborateur.id, { version, valeur })
    return valeur
  }

  /**
   * Ce qu'apporte un poste a un creneau, quelle que soit la personne : manque,
   * cible, sureffectif. Plus, par competence critique encore decouverte, le
   * nombre de tranches que le poste couvrirait.
   */
  function partDuCreneau(
    cleCreneau: string,
    creneau: EtatCreneau,
    horaire: HoraireType,
  ): { readonly base: number; readonly critiques: ReadonlyMap<string, number> } {
    const version = versionDuCreneau.get(cleCreneau) ?? 0
    const cleMemoire = `${cleCreneau}|${horaire.id}`
    const memoire = memoireCreneau.get(cleMemoire)
    if (memoire?.version === version) return memoire

    let variation = 0
    const critiques = new Map<string, number>()
    const priorite = prioriteDuJour(creneau.besoin.date)
    {
      for (const index of tranchesDe.get(horaire.id) ?? []) {
        const tranche = creneau.besoin.tranches[index]
        const attendu = tranche?.personnes ?? 0
        const presents = creneau.presents[index] ?? 0

        const manqueAvant = Math.max(0, attendu - presents)
        const manqueApres = Math.max(0, attendu - (presents + 1))
        variation += (manqueApres - manqueAvant) * poids.manque * priorite

        if (tranche?.cible === undefined) {
          const tropAvant = Math.max(0, presents - attendu)
          const tropApres = Math.max(0, presents + 1 - attendu)
          variation += (tropApres - tropAvant) * poids.sureffectif
        } else {
          // Grille d'effectifs : viser la cible, puis placer les heures dues.
          const cible = Math.max(tranche.cible, attendu)
          const sousCibleAvant = Math.max(0, cible - Math.max(presents, attendu))
          const sousCibleApres = Math.max(0, cible - Math.max(presents + 1, attendu))
          variation += (sousCibleApres - sousCibleAvant) * (poids.cible ?? 0) * priorite
          const tropAvant = Math.max(0, presents - cible)
          const tropApres = Math.max(0, presents + 1 - cible)
          // Jours prioritaires : la grille est un plancher, les heures en plus y
          // sont bienvenues. Jours de repos preferes : le surplus y coute un peu plus.
          const audela = estPrioritaire(creneau.besoin.date)
            ? -0.3
            : (poids.audelaDeLaCible ?? poids.sureffectif) + (estJourDeRepos(creneau.besoin.date) ? 0.3 : 0)
          variation += (tropApres - tropAvant) * audela
        }

        for (const competence of creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
          const compteurs = creneau.autonomes.get(competence)
          if (compteurs === undefined) continue
          if ((compteurs[index] ?? 0) === 0) {
            critiques.set(competence, (critiques.get(competence) ?? 0) + 1)
          }
        }
      }
    }

    const resultat = { version, base: variation, critiques }
    memoireCreneau.set(cleMemoire, resultat)
    return resultat
  }

  /**
   * Plafond d'heures : le planning propose ne fait pas depasser un contrat
   * de plus du temps regle. Mieux vaut annoncer un trou que distribuer des
   * heures supplementaires sans le dire.
   */
  const depassementMaximum = regles?.depassementContratMaximumMinutes ?? 60
  function auDelaDuPlafond(collaborateur: Collaborateur, vacation: Vacation): boolean {
    if (regles === undefined) return false
    const deja = (parPersonne.get(collaborateur.id) ?? []).reduce(
      (somme, v) => somme + minutesAuContrat(v, pausesPayees),
      0,
    )
    return (
      deja + minutesAuContrat(vacation, pausesPayees) >
      (visee(collaborateur) ?? collaborateur.heuresHebdomadaires) * 60 + depassementMaximum
    )
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
      creneau: EtatCreneau
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

        if (creneau.bornes === 'ferme') continue
        // Ceux qui ne peuvent pas venir sont ecartes une fois pour toutes.
        const eligibles = equipe.filter((c) => !ecarteDEmblee(c, rayon.id, jour))
        if (eligibles.length === 0) continue
        const aGrille = creneau.bornes !== null

        for (const horaire of horairesDuCreneau(rayon.id, jour, aGrille)) {
          const pourJeunes = horaire.id.startsWith('contrat-j-')

          for (const collaborateur of eligibles) {
            essais += 1
            if (aGrille && pourJeunes !== estMineur(collaborateur)) continue

            const vacation = enVacation({ collaborateur, rayon, jour, horaire })
            if (auDelaDuPlafond(collaborateur, vacation)) continue
            const variation = variationDAjout(vacation, horaire, collaborateur)
            if (variation >= -1e-9) continue

            candidats.push({ vacation, horaire, collaborateur, creneau, variation })
          }
        }
      }
    }

    /*
     * Le meilleur d'abord, sans trier toute la liste : presque toujours, le
     * premier passe le controle legal. On ne cherche le suivant qu'en cas de
     * refus. Egalite departagee par l'identifiant : le resultat reste stable.
     */
    while (candidats.length > 0) {
      if (Date.now() - debutCalcul >= limite) return null
      let rang = 0
      for (let position = 1; position < candidats.length; position += 1) {
        const candidat = candidats[position]!
        const meilleur = candidats[rang]!
        if (
          candidat.variation < meilleur.variation ||
          (candidat.variation === meilleur.variation &&
            candidat.vacation.id < meilleur.vacation.id)
        ) {
          rang = position
        }
      }
      const candidat = candidats[rang]!
      candidats[rang] = candidats[candidats.length - 1]!
      candidats.pop()

      const critiques = new Set<string>()
      for (const index of tranchesDe.get(candidat.horaire.id) ?? []) {
        for (const competence of candidat.creneau.besoin.tranches[index]?.competencesCritiques ?? []) {
          if ((candidat.creneau.autonomes.get(competence)?.[index] ?? 0) === 0) critiques.add(competence)
        }
      }
      if (
        affectationPermise(
          candidat.vacation,
          candidat.collaborateur,
          parPersonne.get(candidat.collaborateur.id) ?? [],
          entrees,
          [...critiques].sort(),
        )
      ) {
        return { vacation: candidat.vacation, horaire: candidat.horaire, collaborateur: candidat.collaborateur }
      }
    }

    return null
  }

  /** Postes envisageables pour un rayon un jour donne, calcules une fois. */
  const memoireHoraires = new Map<string, HoraireType[]>()
  function horairesDuCreneau(rayonId: string, jour: string, aGrille: boolean): HoraireType[] {
    const cleCreneau = cle(rayonId, jour)
    const deja = memoireHoraires.get(cleCreneau)
    if (deja !== undefined) return deja
    // Rayon a grille : seulement les postes de contrat, dans ses horaires.
    const liste = horaires.filter(
      (horaire) =>
        aGrille === horaire.id.startsWith('contrat-') &&
        dansLesBornes(rayonId, jour, horaire.debut, horaire.fin),
    )
    memoireHoraires.set(cleCreneau, liste)
    return liste
  }

  /*
   * 0. Les cases verrouillees d'abord.
   *
   * Elles entrent dans les compteurs comme les autres — elles occupent la
   * personne, elles couvrent le besoin — mais elles ne figurent pas dans
   * « placees » : rien ne viendra donc les echanger ni les decaler.
   */
  const verrouillees: Vacation[] = []
  for (const vacation of [...(entrees.vacationsVerrouillees ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const collaborateur = equipe.find((c) => c.id === vacation.collaborateurId)
    if (collaborateur === undefined) continue
    const horaire = horairePour(vacation, horaires, tranchesDe)
    inscrire(vacation, horaire, collaborateur, 1)
    verrouillees.push(vacation)
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
      const horaire = horairePour(actuelle, horaires, tranchesDe)
      const titulaire = equipe.find((c) => c.id === actuelle.collaborateurId)
      if (titulaire === undefined) continue

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
        if (auDelaDuPlafond(collaborateur, proposee)) continue
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

  /*
   * 4. Decalages de 15 et 30 minutes.
   *
   * Un poste cale sur un horaire type tombe rarement pile sur le besoin : une
   * fournee sort a 06h45, une livraison arrive a 05h15. Decaler le poste d'un
   * quart d'heure peut couvrir un trou sans rien couter. On n'essaie que des
   * decalages courts : au-dela, ce n'est plus un ajustement, c'est un autre
   * poste, et la personne a organise sa journee autour de son horaire.
   */
  const DECALAGES = [-30, -15, 15, 30]
  let decalages = 0
  let continuerDecalage = true

  while (continuerDecalage && Date.now() - debutCalcul < limite) {
    continuerDecalage = false

    for (let position = 0; position < placees.length; position += 1) {
      if (Date.now() - debutCalcul >= limite) break

      const actuelle = placees[position] as Vacation
      const horaire = horairePour(actuelle, horaires, tranchesDe)
      const titulaire = equipe.find((c) => c.id === actuelle.collaborateurId)
      if (titulaire === undefined) continue

      inscrire(actuelle, horaire, titulaire, -1)
      const coutActuel = variationDAjout(actuelle, horaire, titulaire)

      let meilleur: { vacation: Vacation; horaire: HoraireType; variation: number } | null = null

      for (const minutes of DECALAGES) {
        const debut = enMinutes(actuelle.debut) + minutes
        const fin = enMinutes(actuelle.fin) + minutes
        if (debut < 0 || fin > MINUTES_PAR_JOUR) continue
        if (!dansLesBornes(actuelle.rayonId, actuelle.jour, enTexte(debut), enTexte(fin))) continue

        const decale: Vacation = {
          ...actuelle,
          debut: enTexte(debut),
          fin: enTexte(fin),
        }
        if (auDelaDuPlafond(titulaire, decale)) continue
        const horaireDecale = horairePour(decale, horaires, tranchesDe)
        const variation = variationDAjout(decale, horaireDecale, titulaire)
        if (variation >= coutActuel - 1e-9) continue
        if (meilleur !== null && variation >= meilleur.variation) continue
        meilleur = { vacation: decale, horaire: horaireDecale, variation }
      }

      if (
        meilleur === null ||
        !affectationPermise(
          meilleur.vacation,
          titulaire,
          parPersonne.get(titulaire.id) ?? [],
          entrees,
          [],
        )
      ) {
        inscrire(actuelle, horaire, titulaire, 1)
        continue
      }

      inscrire(meilleur.vacation, meilleur.horaire, titulaire, 1)
      placees[position] = meilleur.vacation
      decalages += 1
      continuerDecalage = true
      break
    }
  }

  /*
   * 5. Chacun a ses heures, a un quart d'heure pres.
   *
   * Les etapes precedentes cherchent le meilleur planning d'ensemble ; il
   * reste souvent quelques heures a placer, ou une demi-heure de trop. On
   * reprend chaque personne : on allonge ou raccourcit un de ses postes par
   * quarts d'heure, ou on lui ajoute un jour, jusqu'a atteindre ses heures.
   * Chaque retouche repasse au crible des regles legales.
   */
  const ajustementsAvant = completerLesHeures()

  /*
   * 5 bis. Reparer les trous.
   *
   * Une fois chacun a ses heures, il reste des trous : une fin de soiree en
   * maree, le samedi matin en charcuterie. Ajouter des heures n'est plus
   * possible (plafond) ; on DEPLACE donc un poste : celui d'une personne qui
   * tient aussi le rayon en manque (titulaire ou renfort), pris dans un
   * rayon — ou un jour — ou il est en surplus. Son rayon de depart ne doit
   * jamais tomber sous son minimum. Le poste deplace est cale sur le trou
   * (fin a 20 h pour un trou a 19 h 30). Minimum d'abord, cible ensuite.
   */
  const reparations = reparerLesTrous()
  const versLesJoursPrioritaires = presenceMaximale()
  const ajustements =
    ajustementsAvant + reparations + versLesJoursPrioritaires + completerLesHeures()

  /*
   * 5 ter. Presence maximale les jours prioritaires (vendredi, samedi).
   *
   * Tout le monde y travaille, sauf conge, absence, ecole ou regle legale.
   * Pour chacun qui n'y est pas, on deplace une de ses journees — prise de
   * preference un jour de repos prefere (lundi a mercredi) — vers le jour
   * prioritaire, dans un rayon qu'il tient (le sien d'abord). Le jour de
   * depart garde sa CIBLE : minimum et cible restent tenus partout, ce sont
   * les heures en plus qui partent vers le week-end.
   */
  function presenceMaximale(): number {
    if (regles === undefined) return 0
    const finDuTemps = Date.now() + 1500
    let deplacees = 0
    const prioritaires = jours.filter(estPrioritaire)
    for (const collaborateur of equipe) {
      for (const jourCible of prioritaires) {
        if (Date.now() >= finDuTemps) return deplacees
        if (joursOccupes.get(collaborateur.id)?.has(jourCible) === true) continue
        // Jours de depart, du plus au moins souhaitable.
        const sources = placees
          .map((vacation, position) => ({ vacation, position }))
          .filter(
            ({ vacation }) =>
              vacation.collaborateurId === collaborateur.id && !estPrioritaire(vacation.jour),
          )
          .sort(
            (a, b) =>
              Number(estJourDeRepos(b.vacation.jour)) - Number(estJourDeRepos(a.vacation.jour)) ||
              a.vacation.jour.localeCompare(b.vacation.jour),
          )
        let fait = false
        for (const { vacation: ancienne, position } of sources) {
          if (fait) break
          const horaireAncien = horairePour(ancienne, horaires, tranchesDe)
          inscrire(ancienne, horaireAncien, collaborateur, -1)
          if (!departTient(ancienne, horaireAncien, 'cible')) {
            inscrire(ancienne, horaireAncien, collaborateur, 1)
            continue
          }
          const siennes = (parPersonne.get(collaborateur.id) ?? []).filter((v) => v.id !== ancienne.id)
          let meilleur: { nouvelle: Vacation; horaire: HoraireType; gain: number } | null = null
          for (const rayonId of rayonsPossibles(collaborateur)) {
            const creneau = creneaux.get(cle(rayonId, jourCible))
            const rayon = rayons.find((r) => r.id === rayonId)
            if (creneau === undefined || rayon === undefined || creneau.bornes === null || creneau.bornes === 'ferme') continue
            const ouverture = enMinutes(creneau.bornes.debut)
            const fermeture = enMinutes(creneau.bornes.fin)
            const longueur = Math.min(duree(ancienne.debut, ancienne.fin), fermeture - ouverture)
            const affluence = affluenceDuJour(jourDeLaSemaine(jourCible))
            const departs = new Set(
              [ouverture, fermeture - longueur, ...affluence.map((p) => enMinutes(p.debut) - 60)].map(
                (d) => Math.min(Math.max(Math.round(d / TRANCHE_MINUTES) * TRANCHE_MINUTES, ouverture), fermeture - longueur),
              ),
            )
            for (const depart of departs) {
              const horaire = posteSurMesure(depart, depart + longueur, estMineur(collaborateur), jourCible)
              // Gain : sous le minimum d'abord, sous la cible ensuite, puis l'affluence.
              let gain = rayonId === collaborateur.rayonPrincipal ? 1 : 0
              for (const index of tranchesDe.get(horaire.id) ?? []) {
                const presents = creneau.presents[index] ?? 0
                if (presents < seuilDe(creneau, index, 'minimum')) gain += 10
                else if (presents < seuilDe(creneau, index, 'cible')) gain += 3
                const minute = index * TRANCHE_MINUTES
                if (affluence.some((p) => minute >= enMinutes(p.debut) && minute < enMinutes(p.fin))) gain += 0.5
              }
              const nouvelle: Vacation = {
                ...ancienne,
                id: `${ancienne.id}-p-${rayonId}-${jourCible}-${enTexte(depart)}`,
                rayonId,
                jour: jourCible,
                debut: horaire.debut,
                fin: horaire.fin,
                pauseMinutes: horaire.pauseMinutes,
                pauseDebut: horaire.pauseDebut,
              }
              if (meilleur !== null && gain <= meilleur.gain) continue
              if (!affectationPermise(nouvelle, collaborateur, siennes, entrees, [])) continue
              meilleur = { nouvelle, horaire, gain }
            }
          }
          if (meilleur === null) {
            inscrire(ancienne, horaireAncien, collaborateur, 1)
            continue
          }
          placees[position] = meilleur.nouvelle
          inscrire(meilleur.nouvelle, meilleur.horaire, collaborateur, 1)
          deplacees += 1
          fait = true
        }
      }
    }
    return deplacees
  }

  type Phase = 'minimum' | 'cible'

  function seuilDe(creneau: EtatCreneau, index: number, phase: Phase): number {
    const tranche = creneau.besoin.tranches[index]
    const minimum = tranche?.personnes ?? 0
    return phase === 'minimum' ? minimum : Math.max(minimum, tranche?.cible ?? minimum)
  }

  interface Trou {
    readonly cleCreneau: string
    readonly creneau: EtatCreneau
    readonly rayonId: string
    readonly jour: string
    readonly debut: number
    readonly fin: number
    readonly poids: number
  }

  /** Trous du moment, les plus lourds d'abord (vendredi et samedi prioritaires). */
  function trousDe(phase: Phase): Trou[] {
    const trous: Trou[] = []
    for (const [cleCreneau, creneau] of creneaux) {
      if (creneau.bornes === null || creneau.bornes === 'ferme') continue
      const priorite = prioriteDuJour(creneau.besoin.date)
      let debut: number | null = null
      for (let index = 0; index <= TRANCHES_PAR_JOUR; index += 1) {
        const manque =
          index < TRANCHES_PAR_JOUR && (creneau.presents[index] ?? 0) < seuilDe(creneau, index, phase)
        if (manque && debut === null) debut = index
        if (!manque && debut !== null) {
          trous.push({
            cleCreneau,
            creneau,
            rayonId: creneau.besoin.rayonId,
            jour: creneau.besoin.date,
            debut: debut * TRANCHE_MINUTES,
            fin: index * TRANCHE_MINUTES,
            poids: (index - debut) * priorite,
          })
          debut = null
        }
      }
    }
    return trous.sort(
      (a, b) => b.poids - a.poids || a.cleCreneau.localeCompare(b.cleCreneau) || a.debut - b.debut,
    )
  }

  interface Mouvement {
    readonly position: number
    readonly ancienne: Vacation
    readonly nouvelle: Vacation
    readonly horaire: HoraireType
    readonly collaborateur: Collaborateur
    readonly score: number
  }

  /** Le rayon de depart reste-t-il a son seuil sans ce poste ? (poste deja retire) */
  function departTient(vacation: Vacation, horaire: HoraireType, phase: Phase): boolean {
    const creneau = creneaux.get(cle(vacation.rayonId, vacation.jour))
    if (creneau === undefined) return true
    return (tranchesDe.get(horaire.id) ?? []).every(
      (index) => (creneau.presents[index] ?? 0) >= seuilDe(creneau, index, phase),
    )
  }

  function meilleurMouvement(trou: Trou, phase: Phase): Mouvement | null {
    if (trou.creneau.bornes === null || trou.creneau.bornes === 'ferme') return null
    const ouverture = enMinutes(trou.creneau.bornes.debut)
    const fermeture = enMinutes(trou.creneau.bornes.fin)
    const critiques = [
      ...new Set(
        trou.creneau.besoin.tranches
          .slice(trou.debut / TRANCHE_MINUTES, trou.fin / TRANCHE_MINUTES)
          .flatMap((tranche) => tranche.competencesCritiques),
      ),
    ].sort()
    const candidats: Mouvement[] = []

    placees.forEach((ancienne, position) => {
      const collaborateur = equipe.find((c) => c.id === ancienne.collaborateurId)
      if (collaborateur === undefined || !peutTravaillerDans(collaborateur, trou.rayonId)) return
      if (critiques.some((competence) => !estAutonome(collaborateur, competence))) return
      // Un autre jour : seulement s'il est libre le jour du trou.
      if (ancienne.jour !== trou.jour && joursOccupes.get(collaborateur.id)?.has(trou.jour) === true) return
      if (ancienne.jour !== trou.jour && ecarteDEmblee(collaborateur, trou.rayonId, trou.jour)) return

      const horaireAncien = horairePour(ancienne, horaires, tranchesDe)
      inscrire(ancienne, horaireAncien, collaborateur, -1)
      if (departTient(ancienne, horaireAncien, phase)) {
        const longueur = Math.min(duree(ancienne.debut, ancienne.fin), fermeture - ouverture)
        const departs = new Set(
          [trou.fin - longueur, trou.debut, ouverture, fermeture - longueur].map((depart) =>
            Math.min(Math.max(depart, ouverture), fermeture - longueur),
          ),
        )
        for (const depart of departs) {
          const horaire = posteSurMesure(depart, depart + longueur, estMineur(collaborateur), trou.jour)
          let gain = 0
          for (const index of tranchesDe.get(horaire.id) ?? []) {
            if ((trou.creneau.presents[index] ?? 0) < seuilDe(trou.creneau, index, phase)) gain += 1
          }
          if (gain === 0) continue
          // Ce que le depart perd sous sa cible (a eviter, sans l'interdire).
          const creneauDepart = creneaux.get(cle(ancienne.rayonId, ancienne.jour))
          let perteCible = 0
          if (creneauDepart !== undefined) {
            for (const index of tranchesDe.get(horaireAncien.id) ?? []) {
              if ((creneauDepart.presents[index] ?? 0) < seuilDe(creneauDepart, index, 'cible')) {
                perteCible += 1
              }
            }
          }
          const nouvelle: Vacation = {
            ...ancienne,
            id: `${ancienne.id}-r-${trou.rayonId}-${trou.jour}-${enTexte(depart)}`,
            rayonId: trou.rayonId,
            jour: trou.jour,
            debut: horaire.debut,
            fin: horaire.fin,
            pauseMinutes: horaire.pauseMinutes,
            pauseDebut: horaire.pauseDebut,
          }
          candidats.push({
            position,
            ancienne,
            nouvelle,
            horaire,
            collaborateur,
            score:
              gain * 10 * prioriteDuJour(trou.jour) -
              perteCible * prioriteDuJour(ancienne.jour) -
              (ancienne.jour !== trou.jour ? 0.5 : 0),
          })
        }
      }
      inscrire(ancienne, horaireAncien, collaborateur, 1)
    })

    candidats.sort((a, b) => b.score - a.score || a.nouvelle.id.localeCompare(b.nouvelle.id))
    for (const candidat of candidats.slice(0, 12)) {
      if (candidat.score <= 0) break
      const siennes = (parPersonne.get(candidat.collaborateur.id) ?? []).filter(
        (v) => v.id !== candidat.ancienne.id,
      )
      if (affectationPermise(candidat.nouvelle, candidat.collaborateur, siennes, entrees, critiques)) {
        return candidat
      }
    }
    return null
  }

  function reparerLesTrous(): number {
    if (regles === undefined) return 0
    const finDuTemps = Date.now() + 2000
    let faites = 0
    for (const phase of ['minimum', 'cible'] as const) {
      const sansSolution = new Set<string>()
      for (let tour = 0; tour < 300 && Date.now() < finDuTemps; tour += 1) {
        let mouvement: Mouvement | null = null
        for (const trou of trousDe(phase)) {
          const repere = `${trou.cleCreneau}|${trou.debut}`
          if (sansSolution.has(repere)) continue
          if (Date.now() >= finDuTemps) break
          mouvement = meilleurMouvement(trou, phase)
          if (mouvement !== null) break
          sansSolution.add(repere)
        }
        if (mouvement === null) break
        inscrire(
          mouvement.ancienne,
          horairePour(mouvement.ancienne, horaires, tranchesDe),
          mouvement.collaborateur,
          -1,
        )
        placees[mouvement.position] = mouvement.nouvelle
        inscrire(mouvement.nouvelle, mouvement.horaire, mouvement.collaborateur, 1)
        faites += 1
        // L'etat a change : les trous sans solution peuvent en avoir une.
        sansSolution.clear()
      }
    }
    return faites
  }

  /*
   * 6. Les pauses, la ou un collegue couvre.
   *
   * Une pause placee pendant que la personne est seule laisse le rayon vide.
   * Pour chaque poste, on cherche l'heure de pause qui, dans l'ordre :
   * ne laisse jamais le rayon sous son minimum ; tombe dans une plage
   * permise, hors affluence ; reste proche du milieu du poste.
   */
  const pausesDeplacees = reorganiserLesPauses()

  function reorganiserLesPauses(): number {
    if (regles === undefined) return 0
    const regle = regles
    let deplacees = 0
    for (let tour = 0; tour < 2; tour += 1) {
      for (let position = 0; position < placees.length; position += 1) {
        const ancienne = placees[position] as Vacation
        if (ancienne.pauseMinutes <= 0) continue
        const cleCreneau = cle(ancienne.rayonId, ancienne.jour)
        const creneau = creneaux.get(cleCreneau)
        const collaborateur = equipe.find((c) => c.id === ancienne.collaborateurId)
        if (creneau === undefined || creneau.bornes === null || collaborateur === undefined) continue

        const horaireAncien = horairePour(ancienne, horaires, tranchesDe)
        inscrire(ancienne, horaireAncien, collaborateur, -1)

        const debut = enMinutes(ancienne.debut)
        const fin = debut + duree(ancienne.debut, ancienne.fin)
        const pause = ancienne.pauseMinutes
        const milieu = (debut + fin - pause) / 2
        const affluence = affluenceDuJour(jourDeLaSemaine(ancienne.jour))
        let meilleur: { depart: number; score: number } | null = null

        for (let depart = debut + 60; depart + pause <= fin - 60; depart += TRANCHE_MINUTES) {
          // Quarts d'heure ou la personne serait en pause et le rayon sous son minimum.
          let trous = 0
          for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
            const debutTranche = index * TRANCHE_MINUTES
            const enPause =
              Math.min(debutTranche + TRANCHE_MINUTES, depart + pause) - Math.max(debutTranche, depart)
            if (enPause < TRANCHE_MINUTES / 2) continue
            if ((creneau.presents[index] ?? 0) < (creneau.besoin.tranches[index]?.personnes ?? 0)) trous += 1
          }
          const dansUneFenetre = fenetresDuJour(regle, jourDeLaSemaine(ancienne.jour)).some(
            (f) => depart >= enMinutes(f.debut) && depart + pause <= enMinutes(f.fin),
          )
          const pendantLAffluence =
            regle.pauseInterditeEnAffluence &&
            affluence.some((a) => depart < enMinutes(a.fin) && depart + pause > enMinutes(a.debut))
          const score =
            trous * 1000 +
            (dansUneFenetre ? 0 : 50) +
            (pendantLAffluence ? 50 : 0) +
            Math.abs(depart - milieu) / TRANCHE_MINUTES
          if (meilleur === null || score < meilleur.score) meilleur = { depart, score }
        }

        if (meilleur === null || enTexte(meilleur.depart) === ancienne.pauseDebut) {
          inscrire(ancienne, horaireAncien, collaborateur, 1)
          continue
        }

        const pauseDebut = enTexte(meilleur.depart)
        const id = `pause-${ancienne.debut}-${ancienne.fin}-${pause}-${pauseDebut}`
        let horaire = horaires.find((h) => h.id === id)
        if (horaire === undefined) {
          horaire = {
            id,
            nom: `${ancienne.debut}–${ancienne.fin}`,
            debut: ancienne.debut,
            fin: ancienne.fin,
            pauseMinutes: pause,
            pauseDebut,
          }
          horaires.push(horaire)
          tranchesDe.set(id, tranchesCouvertesPar(horaire))
        }
        const nouvelle: Vacation = { ...ancienne, pauseDebut }
        inscrire(nouvelle, horaire, collaborateur, 1)
        placees[position] = nouvelle
        deplacees += 1
      }
    }
    return deplacees
  }

  function posteSurMesure(debut: number, fin: number, jeune: boolean, jour: string): HoraireType {
    const regle = regles as ReglesInternes
    const pause = pauseDuPoste(fin - debut, regle, jeune, entrees.parametres)
    const pauseDebut = placerLaPause(
      debut,
      fin,
      pause,
      regle,
      affluenceDuJour(jourDeLaSemaine(jour)),
      fenetresDuJour(regle, jourDeLaSemaine(jour)),
    )
    const id = `mesure-${jeune ? 'j' : 'a'}-${enTexte(debut)}-${enTexte(fin)}-${pause}-${enTexte(pauseDebut)}`
    const connu = horaires.find((horaire) => horaire.id === id)
    if (connu !== undefined) return connu
    const horaire: HoraireType = {
      id,
      nom: `${enTexte(debut)}–${enTexte(fin)}`,
      debut: enTexte(debut),
      fin: enTexte(fin),
      pauseMinutes: pause,
      pauseDebut: enTexte(pauseDebut),
    }
    horaires.push(horaire)
    tranchesDe.set(horaire.id, tranchesCouvertesPar(horaire))
    return horaire
  }

  function minutesPlacees(collaborateur: Collaborateur): number {
    return (parPersonne.get(collaborateur.id) ?? []).reduce(
      (somme, v) => somme + minutesAuContrat(v, pausesPayees),
      0,
    )
  }

  interface Retouche {
    readonly ancienne: Vacation | null
    readonly position: number
    readonly nouvelle: Vacation
    readonly horaire: HoraireType
    readonly variation: number
  }

  /** Meilleure retouche qui rapproche la personne de ses heures. */
  function meilleureRetouche(collaborateur: Collaborateur, ecart: number): Retouche | null {
    const retouches: Retouche[] = []
    const jeune = estMineur(collaborateur)
    const PAS = TRANCHE_MINUTES

    // a. Allonger ou raccourcir un poste existant.
    placees.forEach((ancienne, position) => {
      if (ancienne.collaborateurId !== collaborateur.id) return
      const horaireAncien = horairePour(ancienne, horaires, tranchesDe)
      inscrire(ancienne, horaireAncien, collaborateur, -1)
      const cout = variationDAjout(ancienne, horaireAncien, collaborateur)
      const debut = enMinutes(ancienne.debut)
      const fin = debut + duree(ancienne.debut, ancienne.fin)
      for (let delta = PAS; delta <= 2 * 60; delta += PAS) {
        const formes =
          ecart > 0
            ? [
                [debut - delta, fin],
                [debut, fin + delta],
              ]
            : [
                [debut + delta, fin],
                [debut, fin - delta],
              ]
        for (const [d, f] of formes as [number, number][]) {
          if (d < 0 || f > MINUTES_PAR_JOUR || f - d < DUREE_MINIMALE_POSTE) continue
          if (!dansLesBornes(ancienne.rayonId, ancienne.jour, enTexte(d), enTexte(f))) continue
          const horaire = posteSurMesure(d, f, jeune, ancienne.jour)
          const nouvelle: Vacation = {
            ...ancienne,
            id: `${ancienne.id}-m${enTexte(d)}${enTexte(f)}`,
            debut: horaire.debut,
            fin: horaire.fin,
            pauseMinutes: horaire.pauseMinutes,
            pauseDebut: horaire.pauseDebut,
          }
          const apres = ecart - (minutesAuContrat(nouvelle, pausesPayees) - minutesAuContrat(ancienne, pausesPayees))
          if (Math.abs(apres) >= Math.abs(ecart)) continue
          retouches.push({
            ancienne,
            position,
            nouvelle,
            horaire,
            variation: variationDAjout(nouvelle, horaire, collaborateur) - cout,
          })
        }
      }
      inscrire(ancienne, horaireAncien, collaborateur, 1)
    })

    // b. Ajouter un jour, s'il manque au moins un poste minimal.
    if (ecart >= DUREE_MINIMALE_POSTE - PAS) {
      for (const jour of jours) {
        for (const rayonId of rayonsPossibles(collaborateur)) {
          const rayon = rayons.find((r) => r.id === rayonId)
          const creneau = creneaux.get(cle(rayonId, jour))
          if (rayon === undefined || creneau === undefined || creneau.bornes === 'ferme') continue
          if (ecarteDEmblee(collaborateur, rayonId, jour)) continue
          for (const horaire of horairesDuCreneau(rayonId, jour, creneau.bornes !== null)) {
            if (horaire.id.startsWith('contrat-') && horaire.id.startsWith('contrat-j-') !== jeune) continue
            const nouvelle = enVacation({ collaborateur, rayon, jour, horaire })
            const apres = ecart - minutesAuContrat(nouvelle, pausesPayees)
            if (Math.abs(apres) >= Math.abs(ecart)) continue
            retouches.push({
              ancienne: null,
              position: -1,
              nouvelle,
              horaire,
              variation: variationDAjout(nouvelle, horaire, collaborateur),
            })
          }
        }
      }
    }

    retouches.sort(
      (a, b) => a.variation - b.variation || a.nouvelle.id.localeCompare(b.nouvelle.id),
    )
    for (const retouche of retouches) {
      const siennes = (parPersonne.get(collaborateur.id) ?? []).filter(
        (v) => v.id !== retouche.ancienne?.id,
      )
      if (affectationPermise(retouche.nouvelle, collaborateur, siennes, entrees, [])) return retouche
    }
    return null
  }

  function completerLesHeures(): number {
    if (regles === undefined) return 0
    // Un temps propre a cette etape : elle passe meme si les precedentes
    // ont consomme le leur.
    const fin = Date.now() + 2000
    let retouches = 0
    for (let tour = 0; tour < 4; tour += 1) {
      let changement = false
      for (const collaborateur of equipe) {
        const vise = visee(collaborateur)
        if (vise === undefined) continue
        for (let essai = 0; essai < 16 && Date.now() < fin; essai += 1) {
          const ecart = vise * 60 - minutesPlacees(collaborateur)
          if (Math.abs(ecart) <= TRANCHE_MINUTES) break
          const retouche = meilleureRetouche(collaborateur, ecart)
          if (retouche === null) break
          if (retouche.ancienne !== null) {
            inscrire(
              retouche.ancienne,
              horairePour(retouche.ancienne, horaires, tranchesDe),
              collaborateur,
              -1,
            )
            placees[retouche.position] = retouche.nouvelle
          } else {
            placees.push(retouche.nouvelle)
          }
          inscrire(retouche.nouvelle, retouche.horaire, collaborateur, 1)
          retouches += 1
          changement = true
        }
      }
      if (!changement) break
    }
    return retouches
  }

  /**
   * Diagnostic d'un trou : pour chaque personne qui tient ce rayon, ce qui
   * l'empeche de le combler. C'est ce qui permet de decider soi-meme : un
   * renfort a appeler, un conge a decaler, une grille a revoir.
   */
  function pourquoiPersonne(
    rayonId: string,
    jour: string,
    debutTrou: number,
    finTrou: number,
    toutes: readonly Vacation[],
  ): string {
    const nom = (id: string) => rayons.find((r) => r.id === id)?.nom ?? id
    const raisons: string[] = []
    const concernes = equipe
      .filter((c) => peutTravaillerDans(c, rayonId))
      .sort(
        (a, b) =>
          Number(b.rayonPrincipal === rayonId) - Number(a.rayonPrincipal === rayonId) ||
          a.id.localeCompare(b.id),
      )
    for (const collaborateur of concernes) {
      const siennes = toutes.filter((v) => v.collaborateurId === collaborateur.id)
      const ceJour = siennes.find((v) => v.jour === jour)
      let raison: string
      if (ceJour !== undefined) {
        const debutPoste = enMinutes(ceJour.debut)
        const finPoste = debutPoste + duree(ceJour.debut, ceJour.fin)
        const verrou = verrouillees.some((v) => v.id === ceJour.id) ? ', case verrouillée' : ''
        const debutPause = ceJour.pauseDebut === undefined ? null : enMinutes(ceJour.pauseDebut)
        const enPause =
          debutPause !== null &&
          debutPause < finTrou &&
          debutPause + ceJour.pauseMinutes > debutTrou
        if (ceJour.rayonId === rayonId && enPause) {
          raison = `en pause à ce moment-là${verrou}`
        } else if (ceJour.rayonId === rayonId && debutPoste <= debutTrou && finTrou <= finPoste) {
          raison = `déjà en rayon, il faudrait une personne de plus${verrou}`
        } else if (ceJour.rayonId === rayonId) {
          raison = `présent de ${ceJour.debut} à ${ceJour.fin}${verrou}`
        } else {
          raison = `travaille en ${nom(ceJour.rayonId)} de ${ceJour.debut} à ${ceJour.fin}, rayon qu’il faudrait dégarnir${verrou}`
        }
      } else {
        const bornes = creneaux.get(cle(rayonId, jour))?.bornes
        const ouverture = bornes != null && bornes !== 'ferme' ? enMinutes(bornes.debut) : debutTrou
        const fermeture = bornes != null && bornes !== 'ferme' ? enMinutes(bornes.fin) : finTrou
        const debut = Math.max(ouverture, Math.min(debutTrou, fermeture - DUREE_MINIMALE_POSTE))
        const essai: Vacation = {
          id: 'diagnostic',
          collaborateurId: collaborateur.id,
          rayonId,
          jour,
          debut: enTexte(debut),
          fin: enTexte(Math.min(fermeture, debut + DUREE_MINIMALE_POSTE)),
          pauseMinutes: 0,
        }
        const refus = raisonDeRefus(essai, collaborateur, siennes, entrees, [])
        const faites = siennes.reduce((somme, v) => somme + minutesAuContrat(v, pausesPayees), 0) / 60
        raison =
          refus ??
          `déjà à ses heures (${heuresEnTexte(faites, 2)} pour ${heuresEnTexte(visee(collaborateur) ?? collaborateur.heuresHebdomadaires, 2)})`
      }
      raisons.push(`${nomAffiche(collaborateur)} : ${raison}`)
      if (raisons.length >= 6) break
    }
    return raisons.length === 0
      ? 'Personne dans l’équipe ne tient ce rayon.'
      : `Pourquoi personne : ${raisons.join(' · ')}.`
  }

  // ------------------------------------------------ Resultat et restes
  const ordonnees = [...verrouillees, ...placees].sort(
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

    // Rayon a grille : on dit exactement QUAND il manque quelqu'un.
    const presents = creneaux.get(cle(besoin.rayonId, besoin.date))?.presents
    if (besoinAvecGrille(besoin) && presents !== undefined) {
      const plages: string[] = []
      let debut: number | null = null
      for (let index = 0; index <= TRANCHES_PAR_JOUR; index += 1) {
        const manquant =
          index < TRANCHES_PAR_JOUR &&
          (presents[index] ?? 0) < (besoin.tranches[index]?.personnes ?? 0)
        if (manquant && debut === null) debut = index
        if (!manquant && debut !== null) {
          plages.push(`${enTexte(debut * TRANCHE_MINUTES)}–${enTexte(index * TRANCHE_MINUTES)}`)
          debut = null
        }
      }
      if (plages.length > 0) {
        const [debutTrou, finTrou] = (plages[0] as string).split('–').map(enMinutes) as [number, number]
        restes.push(
          `${nomDuRayon}, le ${jourEnTexte(besoin.date)} : minimum non tenu de ` +
            `${plages.slice(0, 4).join(', ')}${plages.length > 4 ? '…' : ''}. ` +
            pourquoiPersonne(besoin.rayonId, besoin.date, debutTrou, finTrou, ordonnees),
        )
      }
      continue
    }

    if (critiques > 0) {
      restes.push(
        `${nomDuRayon}, le ${jourEnTexte(besoin.date)} : une compétence indispensable reste sans titulaire. ` +
          `Personne de disponible ne la maîtrise, ou les règles légales l’interdisent.`,
      )
    } else {
      restes.push(
        `${nomDuRayon}, le ${jourEnTexte(besoin.date)} : il manque encore ${heuresEnTexte((manque * TRANCHE_MINUTES) / 60)} ` +
          `de présence. Aucune affectation supplémentaire n’était possible sans enfreindre une règle.`,
      )
    }
  }

  /*
   * Heures de contrat non placees : on le dit, nom par nom, plutot que de
   * laisser croire que tout le monde a son compte.
   */
  if (regles !== undefined) {
    for (const collaborateur of equipe) {
      const vise = visee(collaborateur) ?? collaborateur.heuresHebdomadaires
      const siennes = ordonnees.filter((v) => v.collaborateurId === collaborateur.id)
      const faites = siennes.reduce((somme, v) => somme + minutesAuContrat(v, pausesPayees), 0) / 60
      if (ecartAuContratEnHeures(collaborateur, siennes, pausesPayees, vise) <= 0.25) continue

      // Ce qu'on sait de sa semaine, en clair.
      const raisons: string[] = []
      const absents = jours.filter((jour) => estAbsent(entrees.absences, collaborateur.id, jour))
      if (absents.length > 0) raisons.push(`absent ou en congé ${absents.length} jour${absents.length > 1 ? 's' : ''}`)
      const ecole = jours.filter(
        (jour) =>
          enFormation(collaborateur, jour) !== undefined ||
          estJourDEcole(collaborateur, jourDeLaSemaine(jour)),
      )
      if (ecole.length > 0) raisons.push(`${ecole.length} jour${ecole.length > 1 ? 's' : ''} d’école`)
      const indisponibles = jours.filter((jour) => !estDisponible(collaborateur, jourDeLaSemaine(jour)))
      if (indisponibles.length > 0) raisons.push(`${indisponibles.length} jour${indisponibles.length > 1 ? 's' : ''} de repos fixe`)
      const explication =
        faites < vise
          ? 'Aucun poste de plus n’était possible sans enfreindre une règle (repos, six jours, ' +
            'durée maximale) ou sortir des horaires de ses rayons.'
          : 'Ses postes ne pouvaient pas être raccourcis sans laisser un rayon sous son minimum.'
      restes.push(
        `${nomAffiche(collaborateur)} : ${heuresEnTexte(faites, 2)} placées pour ` +
          `${heuresEnTexte(vise, 2)} à faire cette semaine` +
          (raisons.length > 0 ? ` (${raisons.join(', ')})` : '') +
          `. ${explication}`,
      )
    }
  }

  /*
   * Jours prioritaires : qui n'y travaille pas, et pourquoi. Un conge ou un
   * jour d'ecole est une raison suffisante, on ne le repete pas.
   */
  if (regles !== undefined) {
    for (const jourPrioritaire of jours.filter(estPrioritaire)) {
      const manquants: string[] = []
      for (const collaborateur of equipe) {
        if (ordonnees.some((v) => v.collaborateurId === collaborateur.id && v.jour === jourPrioritaire)) continue
        if (
          estAbsent(entrees.absences, collaborateur.id, jourPrioritaire) ||
          enFormation(collaborateur, jourPrioritaire) !== undefined ||
          estJourDEcole(collaborateur, jourDeLaSemaine(jourPrioritaire)) ||
          !estDisponible(collaborateur, jourDeLaSemaine(jourPrioritaire))
        ) {
          continue
        }
        const siennes = ordonnees.filter((v) => v.collaborateurId === collaborateur.id)
        const essai: Vacation = {
          id: 'diagnostic',
          collaborateurId: collaborateur.id,
          rayonId: collaborateur.rayonPrincipal,
          jour: jourPrioritaire,
          debut: '08:30',
          fin: '11:30',
          pauseMinutes: 0,
        }
        const refus = raisonDeRefus(essai, collaborateur, siennes, entrees, [])
        manquants.push(
          `${nomAffiche(collaborateur)} (${refus ?? 'ses autres jours tiennent tout juste leur cible : les déplacer dégarnirait un rayon'})`,
        )
      }
      if (manquants.length > 0) {
        restes.push(
          `${jourEnTexte(jourPrioritaire)}, jour prioritaire : ne travaillent pas ${manquants.join(', ')}.`,
        )
      }
    }
  }

  return {
    vacations: ordonnees,
    penalites: penaliser(
      ordonnees,
      entrees.besoins,
      equipe,
      poids,
      entrees.planningPrecedent ?? [],
      pausesPayees,
    ),
    essais,
    ameliorations,
    decalages,
    verrouillees: verrouillees.length,
    ajustementsDHeures: ajustements + pausesDeplacees,
    dureeMs: Date.now() - debutCalcul,
    restesAExpliquer: restes,
  }
}
