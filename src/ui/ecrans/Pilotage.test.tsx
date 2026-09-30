import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Pilotage } from './Pilotage'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Pilotage />
    </DonneesProvider>,
  )
}

function document_(): HTMLElement {
  const element = screen.getByText(/Service Frais —/).closest('.document')
  if (element === null) throw new Error('Rapport introuvable.')
  return element as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('tableau de bord', () => {
  it('rappelle qu’il est personnel', () => {
    afficher()
    expect(screen.getByText(/votre patron n’y a pas accès/)).toBeInTheDocument()
  })

  it('affiche les indicateurs attendus', () => {
    afficher()
    for (const indicateur of [
      'Effectif',
      'Heures prévues',
      'Couverture du besoin',
      'Absentéisme',
      'Polyvalence moyenne',
      'Postes fragiles',
      'Conformité',
    ]) {
      expect(screen.getAllByText(indicateur).length).toBeGreaterThan(0)
    }
  })

  it('ne calcule la productivité qu’avec un chiffre d’affaires', () => {
    afficher()
    expect(screen.queryByText(/par heure travaillée/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Chiffre d’affaires/), { target: { value: '70000' } })
    // Sans planning, aucune heure : la productivite reste incalculable.
    expect(screen.getByLabelText(/Chiffre d’affaires/)).toHaveValue(70000)
  })

  it('propose un plan d’actions', () => {
    afficher()
    expect(screen.getByText('Plan d’actions')).toBeInTheDocument()
  })
})

describe('rapport remis au patron', () => {
  beforeEach(() => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Rapport hebdomadaire' }))
  })

  it('porte un en-tête neutre', () => {
    const doc = document_()
    expect(within(doc).getByText('Rapport hebdomadaire')).toBeInTheDocument()
    expect(within(doc).getByText(/Édité le/)).toBeInTheDocument()
  })

  it('montre les indicateurs et le plan d’actions', () => {
    const doc = document_()
    expect(within(doc).getByText('Indicateurs')).toBeInTheDocument()
    expect(within(doc).getByText('Plan d’actions')).toBeInTheDocument()
  })

  it('ne porte AUCUN statut, remarque ni historique', () => {
    const texte = document_().textContent ?? ''
    for (const interdit of [
      'Brouillon',
      'Soumis',
      'Validé',
      'À corriger',
      'Publié',
      'Historique',
      'Remarques',
      'tolérance',
      'coefficient',
    ]) {
      expect(texte).not.toContain(interdit)
    }
  })

  it('ne laisse filtrer aucune remarque interne déjà saisie', () => {
    fireEvent.click(screen.getByRole('button', { name: /Imprimer ou enregistrer/ }))
    const remarques = screen.getByLabelText(/Remarques du patron et suites à donner/)
    fireEvent.change(remarques, { target: { value: 'Revoir les heures du samedi.' } })

    expect(document_().textContent).not.toContain('Revoir les heures du samedi')
    // La remarque reste bien visible dans l'application.
    expect(screen.getByDisplayValue('Revoir les heures du samedi.')).toBeInTheDocument()
  })
})

describe('liste des rapports remis', () => {
  it('rappelle qu’il n’y a pas de circuit de validation', () => {
    afficher()
    expect(screen.getByText(/un rapport ne se valide pas, il se remet/)).toBeInTheDocument()
  })

  it('enregistre le rapport quand on l’imprime', () => {
    afficher()
    expect(screen.getByText('Aucun rapport remis pour l’instant.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rapport hebdomadaire' }))
    fireEvent.click(screen.getByRole('button', { name: /Imprimer ou enregistrer/ }))

    expect(screen.queryByText('Aucun rapport remis pour l’instant.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réimprimer à l’identique' })).toBeInTheDocument()
  })

  it('conserve les remarques après rechargement', () => {
    const premiere = afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Rapport hebdomadaire' }))
    fireEvent.click(screen.getByRole('button', { name: /Imprimer ou enregistrer/ }))
    fireEvent.change(screen.getByLabelText(/Remarques du patron et suites à donner/), {
      target: { value: 'À suivre le mois prochain.' },
    })
    premiere.unmount()

    afficher()
    expect(screen.getByDisplayValue('À suivre le mois prochain.')).toBeInTheDocument()
  })

  it('supprime un rapport de la liste', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Rapport hebdomadaire' }))
    fireEvent.click(screen.getByRole('button', { name: /Imprimer ou enregistrer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.getByText('Aucun rapport remis pour l’instant.')).toBeInTheDocument()
  })
})
