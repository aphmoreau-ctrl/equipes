import type { JourSemaine } from '../domaine/calendrier'
import type { EtatApplication } from './etat'
import { AFFLUENCE_SAMEDI, GRILLES_WEEK_END, HORAIRES_RAYONS, RAYON } from './modele-la-vaugine'

/**
 * Applique les grilles du week-end proposees (vendredi, samedi, dimanche)
 * aux donnees de l'iPad.
 *
 * Seuls les jours encore A DEFINIR sont remplis : rien de ce qu'Arnaud a deja
 * saisi n'est ecrase. L'affluence du samedi suit la meme regle.
 */
export interface ResultatWeekEnd {
  readonly etat: EtatApplication
  /** Nombre de journees de rayon remplies. */
  readonly journees: number
  readonly affluenceSamedi: boolean
}

const JOURS_DU_WEEK_END: readonly (5 | 6 | 7)[] = [5, 6, 7]

/** Combien de journees le bouton remplirait. */
export function journeesARemplir(etat: EtatApplication): number {
  return etat.configurations.reduce((total, configuration) => {
    const grille = configuration.grilleEffectifs
    const proposees = GRILLES_WEEK_END[configuration.rayonId]
    if (grille === undefined || proposees === undefined) return total
    return total + JOURS_DU_WEEK_END.filter((jour) => grille.jours[jour] === null).length
  }, 0)
}

export function appliquerGrillesDuWeekEnd(etat: EtatApplication): ResultatWeekEnd {
  let journees = 0
  const configurations = etat.configurations.map((configuration) => {
    const grille = configuration.grilleEffectifs
    const proposees = GRILLES_WEEK_END[configuration.rayonId]
    if (grille === undefined || proposees === undefined) return configuration
    const jours = { ...grille.jours } as Record<JourSemaine, (typeof grille.jours)[JourSemaine]>
    for (const jour of JOURS_DU_WEEK_END) {
      if (jours[jour] !== null) continue
      jours[jour] = proposees[jour]
      journees += 1
    }
    return { ...configuration, grilleEffectifs: { ...grille, jours } }
  })
  const affluenceSamedi = etat.organisation.plagesAffluence[6] === null
  return {
    etat: {
      ...etat,
      configurations,
      organisation: affluenceSamedi
        ? {
            ...etat.organisation,
            plagesAffluence: { ...etat.organisation.plagesAffluence, 6: AFFLUENCE_SAMEDI },
          }
        : etat.organisation,
    },
    journees,
    affluenceSamedi,
  }
}

/**
 * Horaires de la preparation traiteur donnes par Arnaud : fin a 12 h du
 * lundi au vendredi, 13 h 30 le samedi. Ne s'applique que si ces horaires
 * sont encore « a confirmer » dans les donnees de l'iPad.
 */
export function horairesDeLaPreparationAAppliquer(etat: EtatApplication): boolean {
  const rayon = etat.magasin.rayons.find((r) => r.id === RAYON.preparationTraiteur)
  return rayon !== undefined && (rayon.horairesAConfirmer ?? []).length > 0
}

export function appliquerHorairesDeLaPreparation(etat: EtatApplication): EtatApplication {
  if (!horairesDeLaPreparationAAppliquer(etat)) return etat
  const horaires = HORAIRES_RAYONS[RAYON.preparationTraiteur]
  if (horaires === undefined) return etat
  return {
    ...etat,
    magasin: {
      ...etat.magasin,
      rayons: etat.magasin.rayons.map((rayon) =>
        rayon.id === RAYON.preparationTraiteur
          ? { ...rayon, horairesPropres: horaires, horairesAConfirmer: [] }
          : rayon,
      ),
    },
    // Les creneaux de la grille suivent : ils s'arretent a la nouvelle heure de fin.
    configurations: etat.configurations.map((configuration) => {
      const grille = configuration.grilleEffectifs
      if (configuration.rayonId !== RAYON.preparationTraiteur || grille === undefined) return configuration
      const jours = { ...grille.jours } as Record<JourSemaine, (typeof grille.jours)[JourSemaine]>
      for (const jour of [1, 2, 3, 4, 5, 6, 7] as const) {
        const fin = horaires[jour].fermeture
        jours[jour] = (jours[jour] ?? null)?.map((creneau) =>
          creneau.fin > fin ? { ...creneau, fin } : creneau,
        ) ?? null
      }
      return { ...configuration, grilleEffectifs: { ...grille, jours } }
    }),
  }
}
