import type { Mission, Renfort } from '../domaine/vivier'

/**
 * Vivier de DEMONSTRATION. Personnes entierement fictives : prenoms courants,
 * initiales arbitraires, agence imaginaire.
 */
export const RENFORTS_DEMO: readonly Renfort[] = [
  {
    id: 'r-01', prenom: 'Yanis', initiale: 'T.', origine: 'interim', agence: 'Agence du centre (fictive)',
    rayons: ['fruits-legumes', 'cremerie'],
    competences: { 'réception': 2, 'mise en place': 3, 'hygiène': 2 },
    joursPossibles: [1, 2, 3, 4, 5, 6], coutHoraire: 24.5, contactAutorise: true, actif: true,
  },
  {
    id: 'r-02', prenom: 'Léa', initiale: 'G.', origine: 'etudiant', agence: '',
    rayons: ['fruits-legumes', 'boulangerie', 'cremerie'],
    competences: { 'mise en place': 2, 'hygiène': 2, 'boulangerie': 1 },
    joursPossibles: [3, 6, 7], coutHoraire: 15.8, contactAutorise: true, actif: true,
  },
  {
    id: 'r-03', prenom: 'Hervé', initiale: 'L.', origine: 'ancien', agence: '',
    rayons: ['boucherie', 'charcuterie-traiteur'],
    competences: { 'boucherie': 3, 'découpe': 3, 'hygiène': 3, 'charcuterie': 2 },
    joursPossibles: [2, 4, 5, 6], coutHoraire: 21, contactAutorise: true, actif: true,
  },
  {
    id: 'r-04', prenom: 'Inès', initiale: 'K.', origine: 'interim', agence: 'Agence du centre (fictive)',
    rayons: ['maree', 'fromage'],
    competences: { 'marée': 2, 'fromage': 2, 'hygiène': 2 },
    joursPossibles: [1, 2, 3, 4, 5, 6], coutHoraire: 26, contactAutorise: false, actif: true,
  },
]

export const MISSIONS_DEMO: readonly Mission[] = [
  {
    id: 'm-01', renfortId: 'r-01', date: '2026-09-12', rayonId: 'fruits-legumes',
    debut: '06:00', fin: '13:00', pauseMinutes: 20, motif: 'renfort', vacationCouverte: null,
  },
  {
    id: 'm-02', renfortId: 'r-01', date: '2026-09-19', rayonId: 'fruits-legumes',
    debut: '06:00', fin: '13:00', pauseMinutes: 20, motif: 'renfort', vacationCouverte: null,
  },
  {
    id: 'm-03', renfortId: 'r-03', date: '2026-09-24', rayonId: 'boucherie',
    debut: '07:00', fin: '14:00', pauseMinutes: 20, motif: 'remplacement', vacationCouverte: null,
  },
]
