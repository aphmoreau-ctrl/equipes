import type { Competence } from '../domaine/competence'

/**
 * Catalogue de competences de DEPART - entierement modifiable.
 *
 * Il reprend les savoir-faire courants d'un service frais. Arnaud ajoutera,
 * renommera ou desactivera les siens au fil de ses premieres semaines.
 *
 * Une competence sans rayon sert PARTOUT : l'hygiene, le nettoyage et la
 * reception ne sont pas l'affaire d'un seul rayon.
 */

function competence(nom: string, rayons: readonly string[] = []): Competence {
  return { id: nom, nom, rayons, actif: true }
}

export const COMPETENCES_DEMO: readonly Competence[] = [
  // ------------------------------------------- Communes a tous les rayons
  competence('réception'),
  competence('contrôle températures'),
  competence('mise en rayon'),
  competence('mise en place'),
  competence('étiquetage'),
  competence('démarque'),
  competence('hygiène'),
  competence('nettoyage'),
  competence('fermeture'),
  competence('commande fournisseur'),
  competence('commandes'),

  // ------------------------------------------------------ Propres a un rayon
  competence('tri', ['fruits-legumes']),
  competence('découpe', ['boucherie', 'charcuterie-traiteur', 'fruits-legumes']),
  competence('boucherie', ['boucherie']),
  competence('vitrine', ['boucherie', 'charcuterie-traiteur', 'fromage', 'maree']),
  competence('marée', ['maree']),
  competence('coupe', ['charcuterie-traiteur', 'fromage']),
  competence('plateaux', ['charcuterie-traiteur', 'fromage']),
  competence('charcuterie', ['charcuterie-traiteur']),
  competence('traiteur', ['charcuterie-traiteur']),
  competence('fromage', ['fromage']),
  competence('préparation commandes clients', [
    'boucherie',
    'charcuterie-traiteur',
    'fromage',
    'maree',
  ]),
  competence('cuisson', ['boulangerie']),
  competence('boulangerie', ['boulangerie']),

  // ------------------------------------------------------ Cave / vins
  competence('conseil vins', ['cave-vins']),

  // ------------------------------------------------------------- Drive
  competence('préparation drive', ['drive']),
  competence('contrôle drive', ['drive']),
  competence('remise drive', ['drive']),
]
