import { describe, expect, it } from 'vitest'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin } from '../besoin'
import type { Infraction, Vacation } from '../regles'
import { controlerAvantValidation, peutSortir } from './controles'

/** Donnees FICTIVES uniquement. */

const JOUR = '2026-11-03'

function besoin(rayonId = 'fruits-legumes') {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === rayonId)
  if (configuration === undefined) throw new Error('Rayon introuvable.')
  return calculerBesoin(configuration, {
    date: JOUR,
    clientsParTranche: clientsParTranche(MAGASIN_DEMO, JOUR),
    tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, JOUR, rayonId),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

function infraction(severite: Infraction['severite']): Infraction {
  return {
    regle: 'duree-maximale-quotidienne',
    severite,
    collaborateurId: 'c-01',
    jour: JOUR,
    libelle: '11 h de travail effectif',
    explication: 'Au-delà des dix heures permises.',
  }
}

function controles(vacations: readonly Vacation[] = [], infractions: readonly Infraction[] = []) {
  return controlerAvantValidation({
    besoins: [besoin()],
    vacations,
    collaborateurs: COLLABORATEURS_DEMO,
    infractions,
  })
}

describe('contrôles avant validation', () => {
  it('rend les cinq contrôles attendus', () => {
    expect(controles().map((controle) => controle.id)).toEqual([
      'regles',
      'competences-critiques',
      'binomes',
      'contrats',
      'competences-fragiles',
    ])
  })

  it('ne bloque que sur une règle légale', () => {
    const avecBloquante = controles([], [infraction('bloquante')])
    expect(avecBloquante[0]?.resultat).toBe('bloquant')
    expect(peutSortir(avecBloquante)).toBe(false)

    // Les autres contrôles alertent, sans jamais bloquer.
    for (const controle of avecBloquante.slice(1)) {
      expect(controle.resultat).not.toBe('bloquant')
    }
  })

  it('laisse passer un simple avertissement', () => {
    const avecAvertissement = controles([], [infraction('avertissement')])
    expect(avecAvertissement[0]?.resultat).toBe('bon')
    expect(peutSortir(avecAvertissement)).toBe(true)
  })

  it('donne un conseil chaque fois que quelque chose cloche', () => {
    for (const controle of controles([], [infraction('bloquante')])) {
      if (controle.resultat === 'bon') expect(controle.conseil).toBeUndefined()
      else expect(controle.conseil).toBeDefined()
    }
  })

  it('signale les écarts au contrat, sans les bloquer', () => {
    const contrats = controles().find((controle) => controle.id === 'contrats')
    // Planning vide : tout le monde est a zero heure, donc tres loin du contrat.
    expect(contrats?.resultat).toBe('alerte')
    expect(contrats?.detail).toMatch(/personnes? à plus de deux heures/)
    expect(peutSortir(controles())).toBe(true)
  })

  it('désigne les compétences tenues par une seule personne', () => {
    const fragiles = controles().find((controle) => controle.id === 'competences-fragiles')
    expect(fragiles).toBeDefined()
    if (fragiles?.resultat === 'alerte') {
      expect(fragiles.conseil).toContain('formation')
    }
  })

  it('ne dit jamais rien de personnel', () => {
    for (const controle of controles([], [infraction('bloquante')])) {
      const texte = `${controle.titre} ${controle.detail} ${controle.conseil ?? ''}`
      // RGPD : des faits et des heures, aucune appreciation.
      expect(texte).not.toMatch(/lent|rapide|sérieux|motivé|difficile|problème avec/i)
    }
  })
})
