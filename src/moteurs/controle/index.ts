import { estAbsent, type Absence } from '../../domaine/absence'
import { ajouterJours, jourDeLaSemaine, jourEnTexte, semaineDe } from '../../domaine/calendrier'
import {
  aLaFonction,
  enFormation,
  estAutonome,
  estJourDEcole,
  nomAffiche,
  rangDansRayon,
  rayonsPrincipaux,
  type Collaborateur,
} from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import { fenetresDuJour, type OrganisationPlanning, type Plage } from '../../domaine/organisation'
import { TRANCHE_MINUTES, duree, enMinutes, enTexte } from '../../domaine/temps'
import { heuresEnTexte } from '../../domaine/nombres'
import type { BesoinJour } from '../besoin'
import { couvreLaTranche } from '../indicateurs'
import { dureeTravailEffectif, type Infraction, type Vacation } from '../regles'

/**
 * Controle de la semaine (regles du planning v2, etape 2).
 *
 * Module pur. Il verifie N'IMPORTE QUEL planning — propose, retouche ou saisi
 * a la main — et classe chaque constat :
 * - « bloquant » : illegal, le planning ne doit pas partir ainsi ;
 * - « alerte » : regle interne, sous-effectif, ecart ; elle se discute et peut
 *   etre acceptee pour la semaine.
 */

export type Gravite = 'bloquant' | 'alerte'

export type CategorieControle =
  | 'Règle légale'
  | 'Pause'
  | 'Journée'
  | 'Jours d’affilée'
  | 'Horaires et rayons'
  | 'Couverture'
  | 'Contrat'
  | 'Rôtisserie'
  | 'Réunions et tâches'

export interface Constat {
  /** Stable d'un calcul a l'autre : sert a memoriser une alerte acceptee. */
  readonly id: string
  readonly gravite: Gravite
  readonly categorie: CategorieControle
  readonly rayonId: string | null
  readonly collaborateurId: string | null
  readonly jour: string | null
  readonly libelle: string
  readonly explication: string
  /**
   * Constat qui ne pourra etre tranche qu'une fois la semaine voisine
   * construite (repos hebdomadaire a cheval) : affiche a part, replie.
   */
  readonly aConfirmer?: boolean
}

export interface EntreesControleSemaine {
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  /** Vacations des semaines precedentes, pour les jours d'affilee. */
  readonly vacationsAnterieures?: readonly Vacation[]
  /** Constats des regles legales, deja calcules par le verificateur. */
  readonly infractions: readonly Infraction[]
  readonly besoins: readonly BesoinJour[]
  readonly rayons: readonly Rayon[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly organisation: OrganisationPlanning
}

const ORDRE: readonly CategorieControle[] = [
  'Règle légale',
  'Rôtisserie',
  'Couverture',
  'Horaires et rayons',
  'Pause',
  'Journée',
  'Jours d’affilée',
  'Contrat',
  'Réunions et tâches',
]

function finDe(vacation: Vacation): number {
  return enMinutes(vacation.debut) + duree(vacation.debut, vacation.fin)
}

function chevauche(debut: number, fin: number, plage: Plage): boolean {
  return debut < enMinutes(plage.fin) && fin > enMinutes(plage.debut)
}

/** « 06:00–08:30, 19:30–20:00 » a partir d'une liste d'index de tranches. */
function plagesDe(indices: readonly number[]): string[] {
  const plages: string[] = []
  let debut: number | null = null
  let precedent = -2
  for (const index of [...indices].sort((a, b) => a - b)) {
    if (debut === null) debut = index
    else if (index !== precedent + 1) {
      plages.push(`${enTexte(debut * TRANCHE_MINUTES)}–${enTexte((precedent + 1) * TRANCHE_MINUTES)}`)
      debut = index
    }
    precedent = index
  }
  if (debut !== null) {
    plages.push(`${enTexte(debut * TRANCHE_MINUTES)}–${enTexte((precedent + 1) * TRANCHE_MINUTES)}`)
  }
  return plages
}

export function controlerLaSemaine(entrees: EntreesControleSemaine): Constat[] {
  const constats: Constat[] = []
  const jours = semaineDe(entrees.semaine)
  const regles = entrees.organisation.reglesInternes
  const personne = (id: string) => entrees.collaborateurs.find((c) => c.id === id)
  const nom = (id: string) => {
    const c = personne(id)
    return c === undefined ? id : nomAffiche(c)
  }
  const nomDuRayon = (id: string) => entrees.rayons.find((r) => r.id === id)?.nom ?? id
  const rayonDuJour = (collaborateurId: string, jour: string): string | null =>
    entrees.vacations.find((v) => v.collaborateurId === collaborateurId && v.jour === jour)?.rayonId ??
    null
  const ajouter = (constat: Omit<Constat, 'id'> & { readonly cle: string }) => {
    const { cle, ...reste } = constat
    constats.push({ ...reste, id: `${constat.categorie}|${cle}` })
  }

  // 1. Regles legales.
  for (const infraction of entrees.infractions) {
    ajouter({
      cle: `${infraction.regle}|${infraction.collaborateurId}|${infraction.jour}|${infraction.libelle}`,
      gravite: infraction.severite === 'bloquante' ? 'bloquant' : 'alerte',
      categorie: 'Règle légale',
      rayonId: rayonDuJour(infraction.collaborateurId, infraction.jour),
      collaborateurId: infraction.collaborateurId,
      jour: infraction.jour,
      libelle: `${nom(infraction.collaborateurId)} — ${infraction.libelle}`,
      explication: infraction.explication,
      ...(infraction.severite === 'a-confirmer' ? { aConfirmer: true } : {}),
    })
  }

  // 2. Pauses : plage permise, affluence, 3 minutes par heure.
  for (const vacation of entrees.vacations) {
    if (vacation.pauseMinutes <= 0) continue
    const amplitude = duree(vacation.debut, vacation.fin)
    const attendue = Math.round((amplitude / 60) * regles.pauseMinutesParHeure)
    const base = {
      rayonId: vacation.rayonId,
      collaborateurId: vacation.collaborateurId,
      jour: vacation.jour,
      categorie: 'Pause' as const,
      gravite: 'alerte' as const,
    }
    if (vacation.pauseMinutes + 1 < attendue) {
      ajouter({
        ...base,
        cle: `courte|${vacation.id}`,
        libelle: `${nom(vacation.collaborateurId)} — pause de ${vacation.pauseMinutes} min, ${attendue} min prévues`,
        explication: `La règle interne prévoit ${regles.pauseMinutesParHeure} min par heure de présence : ${attendue} min pour ${heuresEnTexte(amplitude / 60, 2)}.`,
      })
    }
    if (vacation.pauseDebut === undefined) continue
    const debutPause = enMinutes(vacation.pauseDebut)
    const finPause = debutPause + vacation.pauseMinutes
    const fenetres = fenetresDuJour(regles, jourDeLaSemaine(vacation.jour))
    const dansUnePlage = fenetres.some(
      (fenetre) => debutPause >= enMinutes(fenetre.debut) && finPause <= enMinutes(fenetre.fin),
    )
    if (!dansUnePlage) {
      ajouter({
        ...base,
        cle: `plage|${vacation.id}`,
        libelle: `${nom(vacation.collaborateurId)} — pause à ${vacation.pauseDebut}, hors des plages prévues`,
        explication:
          `Ce jour-là, les pauses se prennent ${fenetres.map((f) => `de ${f.debut} à ${f.fin}`).join(' ou ')}. ` +
          `Elle a pu être déplacée pour ne pas laisser le rayon vide.`,
      })
    }
    const affluence = entrees.organisation.plagesAffluence[jourDeLaSemaine(vacation.jour)] ?? []
    if (regles.pauseInterditeEnAffluence && affluence.some((p) => chevauche(debutPause, finPause, p))) {
      ajouter({
        ...base,
        cle: `affluence|${vacation.id}`,
        libelle: `${nom(vacation.collaborateurId)} — pause à ${vacation.pauseDebut}, pendant l’affluence`,
        explication: 'Aucune pause pendant les heures d’affluence (règle interne).',
      })
    }
  }

  // 3. Journee trop courte.
  for (const jour of jours) {
    const parPersonne = new Map<string, number>()
    for (const v of entrees.vacations.filter((x) => x.jour === jour)) {
      parPersonne.set(v.collaborateurId, (parPersonne.get(v.collaborateurId) ?? 0) + duree(v.debut, v.fin))
    }
    for (const [collaborateurId, minutes] of parPersonne) {
      if (minutes >= regles.presenceMinimaleParJourMinutes) continue
      ajouter({
        cle: `${collaborateurId}|${jour}`,
        gravite: 'alerte',
        categorie: 'Journée',
        rayonId: rayonDuJour(collaborateurId, jour),
        collaborateurId,
        jour,
        libelle: `${nom(collaborateurId)} — ${heuresEnTexte(minutes / 60, 2)} de présence le ${jourEnTexte(jour)}`,
        explication: `Un jour travaillé compte au moins ${heuresEnTexte(regles.presenceMinimaleParJourMinutes / 60)} de présence (règle interne).`,
      })
    }
  }

  // 4. Jours de travail d'affilee, semaines precedentes comprises.
  const toutes = [...(entrees.vacationsAnterieures ?? []), ...entrees.vacations]
  for (const collaborateur of entrees.collaborateurs.filter((c) => c.actif)) {
    const travailles = new Set(
      toutes.filter((v) => v.collaborateurId === collaborateur.id).map((v) => v.jour),
    )
    for (const jour of jours) {
      if (!travailles.has(jour)) continue
      let suite = 1
      while (travailles.has(ajouterJours(jour, -suite))) suite += 1
      if (suite === regles.joursConsecutifsMaximum + 1) {
        ajouter({
          cle: `${collaborateur.id}|${jour}`,
          gravite: 'alerte',
          categorie: 'Jours d’affilée',
          rayonId: rayonDuJour(collaborateur.id, jour),
          collaborateurId: collaborateur.id,
          jour,
          libelle: `${nomAffiche(collaborateur)} — ${suite} jours de travail d’affilée au ${jourEnTexte(jour)}`,
          explication: `Au plus ${regles.joursConsecutifsMaximum} jours d’affilée (règle interne), d’une semaine sur l’autre.`,
        })
      }
    }
  }

  // 5. Horaires du rayon, rayon tenu, depannage.
  for (const vacation of entrees.vacations) {
    const collaborateur = personne(vacation.collaborateurId)
    const rayon = entrees.rayons.find((r) => r.id === vacation.rayonId)
    if (collaborateur === undefined || rayon === undefined) continue
    const base = {
      gravite: 'alerte' as const,
      categorie: 'Horaires et rayons' as const,
      rayonId: vacation.rayonId,
      collaborateurId: vacation.collaborateurId,
      jour: vacation.jour,
    }
    const horaires = rayon.horairesPropres?.[jourDeLaSemaine(vacation.jour)]
    if (
      horaires !== undefined &&
      (!horaires.ouvert ||
        enMinutes(vacation.debut) < enMinutes(horaires.ouverture) ||
        finDe(vacation) > enMinutes(horaires.fermeture))
    ) {
      ajouter({
        ...base,
        cle: `horaires|${vacation.id}`,
        libelle: `${nomAffiche(collaborateur)} — ${vacation.debut}–${vacation.fin} hors des horaires de ${rayon.nom}`,
        explication: horaires.ouvert
          ? `${rayon.nom} est tenu de ${horaires.ouverture} à ${horaires.fermeture} ce jour-là.`
          : `${rayon.nom} est fermé ce jour-là.`,
      })
    }
    const rang = rangDansRayon(collaborateur, vacation.rayonId)
    if (rang === null) {
      ajouter({
        ...base,
        cle: `rayon|${vacation.id}`,
        libelle: `${nomAffiche(collaborateur)} — placé en ${rayon.nom}, qu’il ou elle ne tient pas`,
        explication: 'Ni titulaire, ni renfort, ni dépannage dans ce rayon (voir sa fiche).',
      })
    } else if (rang === 'depannage') {
      const maximum = regles.dureeMaximaleDepannageMinutes
      const trop = maximum !== null && duree(vacation.debut, vacation.fin) > maximum
      ajouter({
        ...base,
        cle: `depannage|${vacation.id}`,
        libelle:
          `${nomAffiche(collaborateur)} — dépannage en ${rayon.nom}` +
          (trop ? `, ${heuresEnTexte(duree(vacation.debut, vacation.fin) / 60, 2)} (au plus ${heuresEnTexte((maximum ?? 0) / 60, 2)})` : ''),
        explication: 'Le dépannage se réserve au dernier recours, pour une courte durée.',
      })
    }
  }

  // 6. Couverture : minimum non tenu, cible tenue grace aux seuls renforts.
  for (const besoin of entrees.besoins) {
    const duRayon = entrees.vacations.filter(
      (v) => v.rayonId === besoin.rayonId && v.jour === besoin.date,
    )
    const titulaires = duRayon.filter((v) => {
      const c = personne(v.collaborateurId)
      return c !== undefined && rayonsPrincipaux(c).includes(besoin.rayonId)
    })
    const manques: number[] = []
    const graceAuxRenforts: number[] = []
    for (const tranche of besoin.tranches) {
      const presents = duRayon.filter((v) => couvreLaTranche(v, tranche.index)).length
      if (presents < tranche.personnes) manques.push(tranche.index)
      const cible = tranche.cible ?? 0
      if (cible > 0 && presents >= cible) {
        const deTitulaires = titulaires.filter((v) => couvreLaTranche(v, tranche.index)).length
        if (deTitulaires < cible) graceAuxRenforts.push(tranche.index)
      }
    }
    if (manques.length > 0) {
      ajouter({
        cle: `manque|${besoin.rayonId}|${besoin.date}`,
        gravite: 'alerte',
        categorie: 'Couverture',
        rayonId: besoin.rayonId,
        collaborateurId: null,
        jour: besoin.date,
        libelle: `${nomDuRayon(besoin.rayonId)}, ${jourEnTexte(besoin.date)} — minimum non tenu ${plagesDe(manques).join(', ')}`,
        explication: `Il manque ${heuresEnTexte((manques.length * TRANCHE_MINUTES) / 60, 2)} de présence au total. Les solutions sont proposées dans « Conflits et solutions ».`,
      })
    }
    if (graceAuxRenforts.length > 0) {
      ajouter({
        cle: `renforts|${besoin.rayonId}|${besoin.date}`,
        gravite: 'alerte',
        categorie: 'Couverture',
        rayonId: besoin.rayonId,
        collaborateurId: null,
        jour: besoin.date,
        libelle: `${nomDuRayon(besoin.rayonId)}, ${jourEnTexte(besoin.date)} — cible tenue grâce aux renforts ${plagesDe(graceAuxRenforts).slice(0, 3).join(', ')}`,
        explication: 'Les titulaires seuls ne suffisent pas à atteindre la cible : une absence et elle tombe.',
      })
    }
  }

  // 7. Ecart au contrat, conges et ecole deduits (contrat / 6 par jour).
  const joursOuvrables = regles.joursHabituelsParSemaine ?? 6
  for (const collaborateur of entrees.collaborateurs.filter((c) => c.actif && c.forfait !== true)) {
    const siennes = entrees.vacations.filter((v) => v.collaborateurId === collaborateur.id)
    const nonTravailles = jours.filter(
      (jour) =>
        estAbsent(entrees.absences, collaborateur.id, jour) ||
        enFormation(collaborateur, jour) !== undefined ||
        estJourDEcole(collaborateur, jourDeLaSemaine(jour)),
    ).length
    const vise =
      (collaborateur.heuresHebdomadaires * Math.max(0, joursOuvrables - Math.min(nonTravailles, joursOuvrables))) /
      joursOuvrables
    const faites =
      siennes.reduce(
        (somme, v) =>
          somme + (regles.pausesPayeesIncluses ? duree(v.debut, v.fin) : dureeTravailEffectif(v)),
        0,
      ) / 60
    if (Math.abs(faites - vise) <= 0.25) continue
    ajouter({
      cle: collaborateur.id,
      gravite: 'alerte',
      categorie: 'Contrat',
      rayonId: collaborateur.rayonPrincipal,
      collaborateurId: collaborateur.id,
      jour: null,
      libelle: `${nomAffiche(collaborateur)} — ${heuresEnTexte(faites, 2)} planifiées pour ${heuresEnTexte(vise, 2)}`,
      explication:
        nonTravailles > 0
          ? `Contrat de ${heuresEnTexte(collaborateur.heuresHebdomadaires, 2)}, moins ${nonTravailles} jour${nonTravailles > 1 ? 's' : ''} de congé, d’absence ou d’école.`
          : `Contrat de ${heuresEnTexte(collaborateur.heuresHebdomadaires, 2)}.`,
    })
  }

  // 8. Rotisserie : 5 h au chaud au plus, et un boucher a chaque cuisson.
  const rotisserie = entrees.organisation.rotisserie
  if (rotisserie !== null && rotisserie.actif) {
    for (const jour of jours) {
      const duJour = rotisserie.jours[jourDeLaSemaine(jour)]
      if (duJour.vente === null) continue
      const cuissons = [...duJour.cuissons].map(enMinutes).sort((a, b) => a - b)
      const debutVente = enMinutes(duJour.vente.debut)
      const finVente = enMinutes(duJour.vente.fin)
      const maximum = rotisserie.maintienAuChaudMaximumMinutes
      const base = {
        categorie: 'Rôtisserie' as const,
        rayonId: rotisserie.rayonId,
        collaborateurId: null,
        jour,
      }
      if (cuissons.length === 0 || (cuissons[0] as number) > debutVente) {
        ajouter({
          ...base,
          cle: `premiere|${jour}`,
          gravite: 'alerte',
          libelle: `Rôtisserie, ${jourEnTexte(jour)} — rien de cuit à l’ouverture de la vente (${duJour.vente.debut})`,
          explication: 'La première cuisson doit sortir du four avant le début de la vente.',
        })
      }
      const reperes = [...cuissons, finVente]
      for (let i = 0; i + 1 < reperes.length; i += 1) {
        const ecart = (reperes[i + 1] as number) - (reperes[i] as number)
        if (ecart <= maximum) continue
        ajouter({
          ...base,
          cle: `chaud|${jour}|${i}`,
          gravite: 'bloquant',
          libelle: `Rôtisserie, ${jourEnTexte(jour)} — ${heuresEnTexte(ecart / 60, 2)} au chaud après la cuisson de ${enTexte(reperes[i] as number)}`,
          explication: `Règle légale : pas plus de ${heuresEnTexte(maximum / 60)} de maintien au chaud. Ajoutez ou déplacez une cuisson (Paramètres → Rôtisserie).`,
        })
      }
      for (const cuisson of cuissons) {
        const debut = cuisson - (rotisserie.dureeCuissonMinutes ?? 0)
        const present = entrees.vacations.some((v) => {
          const c = personne(v.collaborateurId)
          return (
            v.jour === jour &&
            c !== undefined &&
            estAutonome(c, rotisserie.competence) &&
            enMinutes(v.debut) <= debut &&
            finDe(v) >= cuisson
          )
        })
        if (present) continue
        ajouter({
          ...base,
          cle: `boucher|${jour}|${cuisson}`,
          gravite: 'alerte',
          libelle: `Rôtisserie, ${jourEnTexte(jour)} — personne pour la cuisson de ${enTexte(cuisson)}`,
          explication:
            rotisserie.dureeCuissonMinutes === null
              ? 'Aucune personne formée à la rôtisserie n’est présente à cette heure. (Durée de cuisson encore à définir.)'
              : `Aucune personne formée à la rôtisserie n’est présente de ${enTexte(debut)} à ${enTexte(cuisson)}.`,
        })
      }
    }
  }

  // 9. Reunions a heure fixe : au moins une personne de la fonction, et
  // chaque rayon represente.
  for (const tache of entrees.organisation.taches) {
    if (!tache.actif || tache.fonction === null || tache.moment.type !== 'heure' || tache.jours === null) continue
    const fonction = tache.fonction
    const heure = enMinutes(tache.moment.heure)
    const fin = heure + (tache.dureeMinutes ?? 0)
    for (const jour of jours.filter((j) => tache.jours?.includes(jourDeLaSemaine(j)))) {
      const presents = entrees.vacations.filter((v) => {
        const c = personne(v.collaborateurId)
        return v.jour === jour && c !== undefined && aLaFonction(c, fonction) && enMinutes(v.debut) <= heure && finDe(v) >= fin
      })
      const absentsDuRayon = tache.rayonsRepresentes.filter((rayonId) => {
        const existe = entrees.collaborateurs.some(
          (c) => c.actif && aLaFonction(c, fonction) && rayonsPrincipaux(c).includes(rayonId),
        )
        return existe && !presents.some((v) => rayonsPrincipaux(personne(v.collaborateurId) as Collaborateur).includes(rayonId))
      })
      if (presents.length > 0 && absentsDuRayon.length === 0) continue
      ajouter({
        cle: `${tache.id}|${jour}`,
        gravite: 'alerte',
        categorie: 'Réunions et tâches',
        rayonId: null,
        collaborateurId: null,
        jour,
        libelle:
          `${tache.nom}, ${jourEnTexte(jour)} à ${tache.moment.heure} — ` +
          (presents.length === 0
            ? 'personne de la fonction n’est présent'
            : `pas de représentant pour ${absentsDuRayon.map(nomDuRayon).join(', ')}`),
        explication: 'Placez un poste qui couvre l’heure de la réunion pour une personne de la fonction.',
      })
    }
  }

  // Taches confiees nommement : assez d'occurrences dans la semaine ?
  for (const tache of entrees.organisation.taches) {
    if (!tache.actif || tache.fonction !== null || tache.jours === null || tache.dureeMinutes === null) continue
    const designes = tache.personnesDesignees ?? []
    if (designes.length === 0) continue
    const duree_ = tache.dureeMinutes
    const possibles = jours.filter(
      (jour) =>
        tache.jours?.includes(jourDeLaSemaine(jour)) === true &&
        entrees.vacations.some(
          (v) =>
            v.jour === jour &&
            designes.includes(v.collaborateurId) &&
            (tache.rayonId === null || v.rayonId === tache.rayonId) &&
            duree(v.debut, v.fin) >= duree_,
        ),
    ).length
    const voulues = tache.occurrencesParSemaine ?? tache.jours.length
    if (possibles >= voulues) continue
    ajouter({
      cle: tache.id,
      gravite: 'alerte',
      categorie: 'Réunions et tâches',
      rayonId: tache.rayonId,
      collaborateurId: null,
      jour: null,
      libelle: `${tache.nom} — ${possibles} créneau${possibles > 1 ? 'x' : ''} possible${possibles > 1 ? 's' : ''} sur ${voulues} voulu${voulues > 1 ? 's' : ''}`,
      explication: `Il faut qu’une personne désignée (${designes.map(nom).join(', ')}) soit en poste ces jours-là, assez longtemps.`,
    })
  }

  return constats.sort(
    (a, b) =>
      (a.gravite === b.gravite ? 0 : a.gravite === 'bloquant' ? -1 : 1) ||
      ORDRE.indexOf(a.categorie) - ORDRE.indexOf(b.categorie) ||
      (a.jour ?? '').localeCompare(b.jour ?? '') ||
      a.libelle.localeCompare(b.libelle, 'fr'),
  )
}
