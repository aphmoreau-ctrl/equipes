/**
 * DONNEES DE DEMONSTRATION - ENTIEREMENT FICTIVES.
 *
 * Regle absolue du projet : aucune donnee reelle ne figure dans le depot,
 * qui est public. Ce fichier ne contient que des noms de rayons, communs a
 * tous les magasins, et aucun nom de personne.
 *
 * Les collaborateurs fictifs arriveront au lot 3 (module Equipe).
 */

export interface RayonDemo {
  readonly id: string
  readonly nom: string
  /** Ordre d'affichage, tel qu'il sera reglable dans l'ecran Parametres. */
  readonly ordre: number
}

export const SERVICE_DEMO = 'Frais'

/** Rayons frais par defaut (cahier des charges §5). */
export const RAYONS_DEMO: readonly RayonDemo[] = [
  { id: 'fruits-legumes', nom: 'Fruits et légumes', ordre: 1 },
  { id: 'boucherie', nom: 'Boucherie', ordre: 2 },
  { id: 'maree', nom: 'Marée', ordre: 3 },
  { id: 'cremerie', nom: 'Crèmerie / libre-service frais', ordre: 4 },
  { id: 'charcuterie-traiteur', nom: 'Charcuterie-traiteur', ordre: 5 },
  { id: 'fromage', nom: 'Fromage', ordre: 6 },
  { id: 'boulangerie', nom: 'Boulangerie', ordre: 7 },
]

/** Horaires types de depart (cahier des charges §5), tous modifiables. */
export const HORAIRES_TYPES_DEMO: readonly { nom: string; debut: string; fin: string; pause: number }[] = [
  { nom: 'Matin', debut: '05:30', fin: '12:30', pause: 20 },
  { nom: 'Journée', debut: '07:00', fin: '14:00', pause: 20 },
  { nom: 'Après-midi', debut: '13:30', fin: '20:30', pause: 20 },
]
