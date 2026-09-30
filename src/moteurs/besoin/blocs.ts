import { jourDeLaSemaine, moisDe } from '../../domaine/calendrier'
import { TRANCHE_MINUTES, TRANCHES_PAR_JOUR, enMinutes, indexTranche, type Minutes } from '../../domaine/temps'
import type {
  Bloc,
  ConfigurationRayon,
  ContexteJour,
  NatureCoefficient,
  PlageBloc,
} from './types'

/**
 * Calcul des minutes de travail apportees par un bloc, tranche par tranche.
 * Chaque fonction est independante et testee separement.
 */

/** Numeros des tranches couvertes par la plage horaire d'un bloc. */
export function tranchesDeLaPlage(plage: PlageBloc): number[] {
  const debut = enMinutes(plage.debut)
  const fin = enMinutes(plage.fin)
  if (fin <= debut) {
    throw new Error(
      `Plage horaire invalide : de ${plage.debut} à ${plage.fin}. La fin doit suivre le début.`,
    )
  }
  const premiere = indexTranche(debut)
  const derniere = indexTranche(fin - 1)
  const tranches: number[] = []
  for (let index = premiere; index <= derniere; index += 1) tranches.push(index)
  return tranches
}

/**
 * Repartit un total de minutes a parts egales sur la plage du bloc.
 *
 * Choix assume : repartition uniforme. Le cahier des charges ne precise pas de
 * courbe a l'interieur d'une plage, et une repartition uniforme est celle qui
 * se regle le plus simplement en reduisant la plage.
 */
export function repartirSurLaPlage(minutes: Minutes, plage: PlageBloc): number[] {
  const resultat = new Array<number>(TRANCHES_PAR_JOUR).fill(0)
  if (minutes <= 0) return resultat

  const tranches = tranchesDeLaPlage(plage)
  const part = minutes / tranches.length
  for (const index of tranches) resultat[index] = part
  return resultat
}

/**
 * Coefficient de qualite du jour : moyenne des receptions saisies, ponderee
 * par les quantites. Sans aucune saisie, on suppose une qualite A.
 */
export function coefficientQualite(
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): number {
  const saisies = contexte.saisiesQualite.filter(
    (saisie) => saisie.rayonId === configuration.rayonId && saisie.date === contexte.date,
  )
  const quantiteTotale = saisies.reduce((somme, saisie) => somme + saisie.quantite, 0)
  if (quantiteTotale <= 0) return configuration.coefficientsQualite.A

  const pondere = saisies.reduce(
    (somme, saisie) => somme + saisie.quantite * configuration.coefficientsQualite[saisie.niveau],
    0,
  )
  return pondere / quantiteTotale
}

/** Valeur d'un coefficient donne, pour ce rayon ce jour-la. */
export function valeurDuCoefficient(
  nature: NatureCoefficient,
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): number {
  switch (nature) {
    case 'saison':
      return configuration.coefficientsSaison[moisDe(contexte.date)] ?? 1
    case 'meteo':
      return configuration.coefficientsMeteo[contexte.meteo] ?? 1
    case 'evenement':
      return contexte.coefficientEvenements
    case 'promotion':
      return contexte.enPromotion ? configuration.coefficientPromotion : 1
    case 'qualite':
      return coefficientQualite(configuration, contexte)
  }
}

/** Produit de tous les coefficients qu'un bloc accepte de subir. */
export function coefficientDuBloc(
  bloc: Bloc,
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): number {
  return bloc.coefficients.reduce(
    (produit, nature) => produit * valeurDuCoefficient(nature, configuration, contexte),
    1,
  )
}

/**
 * Minutes apportees par un bloc, tranche par tranche, AVANT coefficients.
 * Renvoie 48 valeurs, une par tranche de 30 minutes.
 */
export function minutesBrutesDuBloc(
  bloc: Bloc,
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): number[] {
  const jour = jourDeLaSemaine(contexte.date)
  const vide = new Array<number>(TRANCHES_PAR_JOUR).fill(0)

  if (!bloc.actif || !bloc.jours.includes(jour)) return vide

  const taille = configuration.taille

  switch (bloc.type) {
    case 'reception': {
      const palettes = bloc.palettesParJour[jour]
      return repartirSurLaPlage(palettes * bloc.minutesParPalette, bloc.plage)
    }

    case 'mise-en-place': {
      const colis = bloc.colisParJour[jour]
      if (bloc.cadenceColisParHeure <= 0) {
        throw new Error(`Bloc « ${bloc.nom} » : la cadence doit être supérieure à zéro.`)
      }
      const minutes = (colis / bloc.cadenceColisParHeure) * 60
      return repartirSurLaPlage(minutes, bloc.plage)
    }

    case 'reassort': {
      // Proportionnel a la frequentation : seul bloc calcule tranche par tranche.
      const resultat = new Array<number>(TRANCHES_PAR_JOUR).fill(0)
      for (const index of tranchesDeLaPlage(bloc.plage)) {
        const clients = contexte.clientsParTranche[index] ?? 0
        resultat[index] = (clients / 100) * bloc.minutesPour100Clients
      }
      return resultat
    }

    case 'tri':
      return repartirSurLaPlage(taille.metresLineaires * bloc.minutesParMetre, bloc.plage)

    case 'facing':
      return repartirSurLaPlage(taille.metresLineaires * bloc.minutesParMetre, bloc.plage)

    case 'controle-dates':
      return repartirSurLaPlage(taille.nombreReferences * bloc.minutesParReference, bloc.plage)

    case 'nettoyage':
      return repartirSurLaPlage(
        (taille.meublesFroids + taille.etals) * bloc.minutesParMeuble,
        bloc.plage,
      )

    case 'balances':
      return repartirSurLaPlage(bloc.minutesParJour, bloc.plage)

    case 'transformation': {
      const production = bloc.produits.reduce(
        (somme, produit) => somme + produit.quantite * produit.minutesParUnite,
        0,
      )
      const total = production + bloc.minutesMiseEnRoute + bloc.minutesNettoyage
      return repartirSurLaPlage(total, bloc.plage)
    }

    case 'tache-fixe':
      return repartirSurLaPlage(bloc.minutes, bloc.plage)
  }
}

/** Minutes apportees par un bloc, coefficients compris. */
export function minutesDuBloc(
  bloc: Bloc,
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): number[] {
  const coefficient = coefficientDuBloc(bloc, configuration, contexte)
  return minutesBrutesDuBloc(bloc, configuration, contexte).map((minutes) => minutes * coefficient)
}

/**
 * Nombre de postes reellement occupes par un bloc de transformation,
 * au plus fort de la journee. Sert a reperer un depassement de capacite.
 */
export function postesNecessaires(minutesParTranche: readonly number[]): number {
  return Math.max(0, ...minutesParTranche.map((minutes) => minutes / TRANCHE_MINUTES))
}
