/**
 * Carte complete de l'application.
 *
 * Tous les modules du cahier des charges figurent ici des l'etape 0, meme
 * ceux qui ne sont pas encore construits : l'utilisateur voit ainsi d'emblee
 * l'ensemble du projet et sait a quel moment chaque partie arrive.
 */
export interface Module {
  readonly id: string
  /** Chemin dans l'application (routage par diese, compatible GitHub Pages). */
  readonly chemin: string
  readonly titre: string
  /** Une phrase, affichee sous le titre et dans l'ecran d'attente. */
  readonly resume: string
  /** Moment de livraison, d'apres la priorisation du cahier des charges (§16.1). */
  readonly livraison: string
  /** Renseigne a true quand le module est reellement utilisable. */
  readonly pret: boolean
}

export const MODULES: readonly Module[] = [
  {
    id: 'aujourdhui',
    chemin: '/',
    titre: "Aujourd’hui",
    resume: 'Qui est là, dans quel rayon, les trous de couverture et les alertes du jour.',
    livraison: 'Lot 6',
    pret: false,
  },
  {
    id: 'planning',
    chemin: '/planning',
    titre: 'Planning',
    resume:
      'Construction du planning, contrôle automatique des règles légales, couverture du besoin et circuit de suivi.',
    livraison: 'Lot 5',
    pret: false,
  },
  {
    id: 'besoin',
    chemin: '/besoin',
    titre: 'Besoin',
    resume:
      'Combien de personnes et quelles compétences, par rayon et par tranche de 30 minutes.',
    livraison: 'Lot 2',
    pret: false,
  },
  {
    id: 'equipe',
    chemin: '/equipe',
    titre: 'Équipe',
    resume: 'Fiches des collaborateurs : contrats, disponibilités, compétences, dates clés.',
    livraison: 'Lot 3',
    pret: false,
  },
  {
    id: 'alertes',
    chemin: '/alertes',
    titre: 'Alertes',
    resume: 'Toutes les échéances et anomalies réunies au même endroit.',
    livraison: 'Lot 3',
    pret: false,
  },
  {
    id: 'heures',
    chemin: '/heures',
    titre: 'Heures',
    resume:
      'Heures prévues et réalisées, majorations, compteurs, export des éléments variables de paie.',
    livraison: 'Priorité 2',
    pret: false,
  },
  {
    id: 'conges',
    chemin: '/conges',
    titre: 'Congés',
    resume: 'Demandes, soldes, planning des congés d’été et absences par type.',
    livraison: 'Priorité 2',
    pret: false,
  },
  {
    id: 'competences',
    chemin: '/competences',
    titre: 'Compétences',
    resume: 'Grille de polyvalence, plan de formation, habilitations et leurs échéances.',
    livraison: 'Priorité 2',
    pret: false,
  },
  {
    id: 'pilotage',
    chemin: '/pilotage',
    titre: 'Pilotage',
    resume: 'Tableau de bord personnel et rapports PDF à remettre au patron.',
    livraison: 'Priorité 2',
    pret: false,
  },
  {
    id: 'parametres',
    chemin: '/parametres',
    titre: 'Paramètres',
    resume: 'Magasin, rayons, horaires, règles légales, verrouillage et sauvegarde.',
    livraison: 'Lot 2',
    pret: true,
  },
]

/** Retrouve un module par son chemin. */
export function moduleParChemin(chemin: string): Module | undefined {
  return MODULES.find((module) => module.chemin === chemin)
}
