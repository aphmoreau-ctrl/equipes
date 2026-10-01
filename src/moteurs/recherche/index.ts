import { LIBELLES_CONTRAT, nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import {
  LIBELLES_DOCUMENT,
  LIBELLES_NOTE,
  type BesoinRecrutement,
  type DocumentInterne,
  type Note,
} from '../../domaine/faits'
import type { Formation } from '../../domaine/formation'
import type { Rayon } from '../../domaine/magasin'

/**
 * Recherche globale (cahier des charges §15).
 *
 * Module pur : il recoit les donnees et un texte, et rend une liste de
 * resultats ordonnee. La recherche ignore les majuscules et les accents
 * (« maree » trouve « Marée »), et chaque mot tape doit apparaitre.
 */

export type TypeResultat = 'collaborateur' | 'rayon' | 'note' | 'document' | 'formation' | 'recrutement'

export const LIBELLES_RESULTAT: Readonly<Record<TypeResultat, string>> = {
  collaborateur: 'Collaborateur',
  rayon: 'Rayon',
  note: 'Communication',
  document: 'Document',
  formation: 'Formation',
  recrutement: 'Recrutement',
}

export interface ResultatRecherche {
  readonly id: string
  readonly type: TypeResultat
  readonly titre: string
  /** Precision courte affichee sous le titre. */
  readonly detail: string
  /** Ecran ou trouver l'element. */
  readonly chemin: string
}

export interface SourcesRecherche {
  readonly collaborateurs: readonly Collaborateur[]
  readonly rayons: readonly Rayon[]
  readonly notes: readonly Note[]
  readonly documents: readonly DocumentInterne[]
  readonly formations: readonly Formation[]
  readonly besoinsRecrutement: readonly BesoinRecrutement[]
}

/** Minuscules, sans accents, espaces reduits. */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Longueur minimale d'une recherche : en dessous, tout correspondrait. */
export const LONGUEUR_MINIMALE = 2

/** Nombre maximal de resultats affiches. */
export const RESULTATS_MAXIMUM = 50

interface Candidat {
  readonly resultat: ResultatRecherche
  /** Texte prioritaire : une correspondance ici classe le resultat en tete. */
  readonly principal: string
  /** Tout le texte cherchable. */
  readonly complet: string
}

function extrait(texte: string, longueur = 90): string {
  const net = texte.replace(/\s+/g, ' ').trim()
  return net.length <= longueur ? net : `${net.slice(0, longueur - 1)}…`
}

function candidats(sources: SourcesRecherche): Candidat[] {
  const nomRayon = (id: string): string =>
    sources.rayons.find((rayon) => rayon.id === id)?.nom ?? id
  const nomDe = (id: string): string => {
    const personne = sources.collaborateurs.find((candidat) => candidat.id === id)
    return personne === undefined ? '' : nomAffiche(personne)
  }
  const liste: Candidat[] = []

  for (const personne of sources.collaborateurs) {
    const nom = nomAffiche(personne)
    const rayon = nomRayon(personne.rayonPrincipal)
    liste.push({
      resultat: {
        id: `collaborateur-${personne.id}`,
        type: 'collaborateur',
        titre: nom,
        detail:
          `${personne.poste} · ${rayon} · ${LIBELLES_CONTRAT[personne.contrat]} ` +
          `${personne.heuresHebdomadaires} h` +
          (personne.actif ? '' : ' · inactif'),
        chemin: '/equipe',
      },
      principal: nom,
      complet: [
        nom,
        personne.poste,
        rayon,
        ...personne.rayonsSecondaires.map(nomRayon),
        LIBELLES_CONTRAT[personne.contrat],
        ...Object.keys(personne.competences),
        ...personne.habilitations.map((habilitation) => habilitation.nom),
      ].join(' '),
    })
  }

  for (const rayon of sources.rayons) {
    liste.push({
      resultat: {
        id: `rayon-${rayon.id}`,
        type: 'rayon',
        titre: rayon.nom,
        detail: rayon.actif ? 'Besoin et modèle du rayon' : 'Rayon inactif',
        chemin: '/besoin',
      },
      principal: rayon.nom,
      complet: rayon.nom,
    })
  }

  for (const note of sources.notes) {
    liste.push({
      resultat: {
        id: `note-${note.id}`,
        type: 'note',
        titre: note.titre,
        detail: `${LIBELLES_NOTE[note.type]} du ${note.date} · ${extrait(note.contenu, 60)}`,
        chemin: '/communication',
      },
      principal: note.titre,
      complet: `${note.titre} ${note.contenu} ${LIBELLES_NOTE[note.type]}`,
    })
  }

  for (const document of sources.documents) {
    liste.push({
      resultat: {
        id: `document-${document.id}`,
        type: 'document',
        titre: document.titre,
        detail: `${LIBELLES_DOCUMENT[document.categorie]} · ${extrait(document.contenu, 60)}`,
        chemin: '/documents',
      },
      principal: document.titre,
      complet: `${document.titre} ${document.contenu} ${LIBELLES_DOCUMENT[document.categorie]}`,
    })
  }

  for (const formation of sources.formations) {
    const nom = nomDe(formation.collaborateurId)
    liste.push({
      resultat: {
        id: `formation-${formation.id}`,
        type: 'formation',
        titre: formation.intitule,
        detail: `${nom} · du ${formation.debut} au ${formation.fin}`,
        chemin: '/competences',
      },
      principal: formation.intitule,
      complet: `${formation.intitule} ${nom} ${formation.competenceVisee} ${formation.habilitationDelivree ?? ''}`,
    })
  }

  for (const besoin of sources.besoinsRecrutement) {
    const rayon = nomRayon(besoin.rayonId)
    liste.push({
      resultat: {
        id: `recrutement-${besoin.id}`,
        type: 'recrutement',
        titre: `${besoin.poste} — ${rayon}`,
        detail: `${besoin.heuresHebdomadaires} h · souhaité le ${besoin.dateSouhaitee}`,
        chemin: '/equipe',
      },
      principal: besoin.poste,
      complet: `${besoin.poste} ${rayon} ${besoin.motif} ${besoin.contrat}`,
    })
  }

  return liste
}

/**
 * Cherche dans toutes les donnees. Ordre : d'abord les elements dont le titre
 * correspond, puis les autres ; a egalite, l'ordre des types puis le titre.
 */
export function rechercher(sources: SourcesRecherche, texte: string): ResultatRecherche[] {
  const requete = normaliser(texte)
  if (requete.length < LONGUEUR_MINIMALE) return []
  const mots = requete.split(' ')

  const ordreTypes = Object.keys(LIBELLES_RESULTAT)
  return candidats(sources)
    .filter((candidat) => {
      const complet = normaliser(candidat.complet)
      return mots.every((mot) => complet.includes(mot))
    })
    .map((candidat) => {
      const principal = normaliser(candidat.principal)
      return { candidat, enTitre: mots.every((mot) => principal.includes(mot)) }
    })
    .sort(
      (a, b) =>
        Number(b.enTitre) - Number(a.enTitre) ||
        ordreTypes.indexOf(a.candidat.resultat.type) - ordreTypes.indexOf(b.candidat.resultat.type) ||
        a.candidat.resultat.titre.localeCompare(b.candidat.resultat.titre, 'fr'),
    )
    .slice(0, RESULTATS_MAXIMUM)
    .map(({ candidat }) => candidat.resultat)
}
