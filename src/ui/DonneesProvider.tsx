import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clientsParTranche, tranchesOuvertes } from '../domaine/magasin'
import { calculerBesoin, type BesoinJour, type ContexteJour } from '../moteurs/besoin'
import { coefficientEvenements } from '../domaine/magasin'
import type { Planning } from '../domaine/planning'
import { aujourdhui } from '../domaine/calendrier'
import { alertesCentralisees, type Alerte } from '../moteurs/alertes'
import {
  effacerEtat,
  enregistrerEtat,
  etatInitial,
  lireEtat,
  planningDeLaSemaine,
  vacationsAnterieures,
  type EtatApplication,
} from '../donnees/etat'

interface ValeurDonnees {
  readonly etat: EtatApplication
  /** Modifie l'etat et l'enregistre aussitot. */
  readonly modifier: (transformation: (etat: EtatApplication) => EtatApplication) => void
  /** Revient aux donnees de demonstration. */
  readonly reinitialiser: () => void
  /** Remplace toutes les donnees, par exemple depuis un fichier de sauvegarde. */
  readonly remplacer: (etat: EtatApplication) => void
  /** Toutes les alertes du jour, tous modules confondus (§15). */
  readonly alertes: readonly Alerte[]
  /** Calcule le besoin d'un rayon pour une date, ou null si le rayon n'a pas de modele. */
  readonly besoinDuJour: (date: string, rayonId: string) => BesoinJour | null
  /** Planning d'une semaine, cree vide s'il n'existe pas encore. */
  readonly planning: (semaine: string) => Planning
  /** Modifie le planning d'une semaine et l'enregistre. */
  readonly modifierPlanning: (semaine: string, transformation: (planning: Planning) => Planning) => void
  /** Vacations des semaines precedentes. */
  readonly historique: (semaine: string) => ReturnType<typeof vacationsAnterieures>
}

const Contexte = createContext<ValeurDonnees | null>(null)

export function DonneesProvider({ children }: { readonly children: ReactNode }) {
  const [etat, setEtat] = useState<EtatApplication>(etatInitial)

  useEffect(() => {
    setEtat(lireEtat())
  }, [])

  const modifier = useCallback(
    (transformation: (precedent: EtatApplication) => EtatApplication) => {
      setEtat((precedent) => {
        const suivant = transformation(precedent)
        enregistrerEtat(suivant)
        return suivant
      })
    },
    [],
  )

  const reinitialiser = useCallback(() => {
    effacerEtat()
    setEtat(etatInitial())
  }, [])

  const remplacer = useCallback((nouvel: EtatApplication) => {
    enregistrerEtat(nouvel)
    setEtat(nouvel)
  }, [])

  const alertes = useMemo(
    () =>
      alertesCentralisees(
        {
          collaborateurs: etat.collaborateurs,
          entretiens: etat.entretiens,
          actionsSecurite: etat.actionsSecurite,
        },
        aujourdhui(),
        etat.reglagesAlertes,
      ),
    [etat.collaborateurs, etat.entretiens, etat.actionsSecurite, etat.reglagesAlertes],
  )

  /*
   * Memoire des besoins deja calcules.
   *
   * L'ecran Planning demande le besoin de sept rayons sur sept jours, soit
   * quarante-neuf courbes, a chaque affichage. Sans cette memoire, poser une
   * vacation relancait les quarante-neuf calculs : l'iPad ramait et un test
   * depassait meme le temps accorde sur le serveur de publication.
   *
   * La memoire est videe des que change l'une des donnees dont le besoin
   * depend — et SEULEMENT celles-la. Modifier un planning ne la vide donc pas.
   */
  const memoireDesBesoins = useMemo(
    () => new Map<string, BesoinJour | null>(),
    [
      etat.magasin,
      etat.configurations,
      etat.saisiesQualite,
      etat.meteoParDate,
      etat.promotionsParDate,
    ],
  )

  const besoinDuJour = useCallback(
    (date: string, rayonId: string): BesoinJour | null => {
      const cle = `${rayonId}|${date}`
      const deja = memoireDesBesoins.get(cle)
      if (deja !== undefined) return deja

      const configuration = etat.configurations.find(
        (candidate) => candidate.rayonId === rayonId,
      )
      if (configuration === undefined) {
        memoireDesBesoins.set(cle, null)
        return null
      }

      const contexte: ContexteJour = {
        date,
        clientsParTranche: clientsParTranche(etat.magasin, date),
        tranchesOuvertes: tranchesOuvertes(etat.magasin, date, rayonId),
        meteo: etat.meteoParDate[date] ?? 'normal',
        coefficientEvenements: coefficientEvenements(etat.magasin, date, rayonId),
        enPromotion: (etat.promotionsParDate[date] ?? []).includes(rayonId),
        saisiesQualite: etat.saisiesQualite.filter(
          (saisie) => saisie.date === date && saisie.rayonId === rayonId,
        ),
      }

      const besoin = calculerBesoin(configuration, contexte)
      memoireDesBesoins.set(cle, besoin)
      return besoin
    },
    [
      memoireDesBesoins,
      etat.magasin,
      etat.configurations,
      etat.saisiesQualite,
      etat.meteoParDate,
      etat.promotionsParDate,
    ],
  )

  const planning = useCallback(
    (semaine: string): Planning => planningDeLaSemaine(etat, semaine),
    [etat],
  )

  const modifierPlanning = useCallback(
    (semaine: string, transformation: (precedent: Planning) => Planning): void => {
      modifier((precedent) => ({
        ...precedent,
        demonstration: false,
        plannings: {
          ...precedent.plannings,
          [semaine]: transformation(planningDeLaSemaine(precedent, semaine)),
        },
      }))
    },
    [modifier],
  )

  const historique = useCallback(
    (semaine: string) => vacationsAnterieures(etat, semaine),
    [etat],
  )

  const valeur = useMemo<ValeurDonnees>(
    () => ({
      etat,
      modifier,
      reinitialiser,
      remplacer,
      alertes,
      besoinDuJour,
      planning,
      modifierPlanning,
      historique,
    }),
    [etat, modifier, reinitialiser, remplacer, alertes, besoinDuJour, planning, modifierPlanning, historique],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useDonnees(): ValeurDonnees {
  const valeur = useContext(Contexte)
  if (valeur === null) {
    throw new Error('useDonnees doit être utilisé à l’intérieur de DonneesProvider.')
  }
  return valeur
}
