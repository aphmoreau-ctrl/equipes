import type { JourSemaine } from '../../domaine/calendrier'
import type { TachePlanifiee } from '../../domaine/organisation'
import { duree, enMinutes, enTexte } from '../../domaine/temps'
import type { BlocTacheFixe, ConfigurationRayon } from './types'

/**
 * Les taches d'un rayon (fiche rayon) converties en charge de travail.
 *
 * Elles restent rangees a un seul endroit — l'organisation — et deviennent,
 * au moment du calcul, des « taches fixes » du moteur de besoin : leurs
 * minutes se repartissent entre l'heure de debut au plus tot et l'heure
 * limite, et s'AJOUTENT a la presence en vente (D-159).
 */

/** Jours ou la tache se fait cette semaine, en tenant compte du nombre de fois. */
export function joursDeLaTache(tache: TachePlanifiee): JourSemaine[] {
  const jours = [...(tache.jours ?? [])].sort((a, b) => a - b)
  const fois = tache.occurrencesParSemaine
  return fois === null || fois >= jours.length ? jours : jours.slice(0, Math.max(0, fois))
}

/** Plage ou la charge se repartit, ou null si elle reste a definir. */
export function plageDeLaTache(tache: TachePlanifiee): { debut: string; fin: string } | null {
  if (tache.dureeMinutes === null) return null
  if (tache.moment.type === 'heure') {
    const debut = enMinutes(tache.moment.heure)
    return { debut: tache.moment.heure, fin: enTexte(Math.min(debut + tache.dureeMinutes, 24 * 60 - 1)) }
  }
  if (tache.moment.type === 'libre' && tache.fenetre != null) {
    const largeur = duree(tache.fenetre.debut, tache.fenetre.fin)
    return largeur > 0 ? tache.fenetre : null
  }
  return null
}

/** Une tache rattachee au rayon, convertie en bloc ; null si elle est incomplete. */
export function blocDeLaTache(tache: TachePlanifiee): BlocTacheFixe | null {
  if (!tache.actif || tache.rayonId === null || tache.nature === 'remballe' || tache.nature === 'reunion') {
    return null
  }
  const plage = plageDeLaTache(tache)
  const jours = joursDeLaTache(tache)
  if (plage === null || jours.length === 0 || tache.dureeMinutes === null) return null
  const personnes = Math.max(1, tache.personnes ?? 1)
  return {
    type: 'tache-fixe',
    id: `tache-${tache.id}`,
    nom: tache.nom,
    actif: true,
    jours,
    plage,
    competences:
      tache.competence === null ? [] : [{ competence: tache.competence, niveauMinimum: 2 }],
    coefficients: [],
    minutes: tache.dureeMinutes * personnes,
    ...(tache.personnesDesignees === null || tache.personnesDesignees.length === 0
      ? {}
      : { personnesDesignees: tache.personnesDesignees }),
  }
}

/** La configuration du rayon, completee des taches saisies dans sa fiche. */
export function configurationAvecTaches(
  configuration: ConfigurationRayon,
  taches: readonly TachePlanifiee[],
): ConfigurationRayon {
  const blocs = taches
    .filter((tache) => tache.rayonId === configuration.rayonId)
    .map(blocDeLaTache)
    .filter((bloc): bloc is BlocTacheFixe => bloc !== null)
  return blocs.length === 0 ? configuration : { ...configuration, blocs: [...configuration.blocs, ...blocs] }
}
