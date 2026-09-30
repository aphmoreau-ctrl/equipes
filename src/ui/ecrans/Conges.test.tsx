import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Conges } from './Conges'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Conges />
    </DonneesProvider>,
  )
}

function saisirUneDemande(
  collaborateurId = 'c-01',
  debut = '2027-07-05',
  fin = '2027-07-17',
): void {
  fireEvent.change(screen.getByLabelText('Qui'), { target: { value: collaborateurId } })
  fireEvent.change(screen.getByLabelText('Du'), { target: { value: debut } })
  fireEvent.change(screen.getByLabelText('Au'), { target: { value: fin } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la demande' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('écran Congés', () => {
  it('affiche les soldes de toute l’équipe', () => {
    afficher()
    expect(screen.getByText('Soldes')).toBeInTheDocument()
    // Le texte est coupe par une balise : on lit le contenu de la section.
    expect(screen.getByText('Soldes').parentElement?.textContent).toContain(
      'bulletin de paie fait foi',
    )
    expect(screen.getAllByText(/30 acquis/).length).toBeGreaterThan(10)
  })

  it('compte les jours ouvrables sans le dimanche', () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2027-07-05' } })
    fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2027-07-17' } })
    expect(screen.getByText(/12 jours ouvrables/)).toBeInTheDocument()
  })

  it('refuse d’enregistrer sans choisir de personne', () => {
    afficher()
    expect(screen.getByRole('button', { name: 'Enregistrer la demande' })).toBeDisabled()
  })

  it('enregistre une demande et l’ouvre', () => {
    afficher()
    saisirUneDemande()
    expect(screen.getAllByText(/Camille D./).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Brouillon').length).toBeGreaterThan(0)
    expect(screen.getByText('Suivi de la demande')).toBeInTheDocument()
  })

  it('ne signale rien sur une demande normale', () => {
    afficher()
    saisirUneDemande()
    expect(screen.getByText('Rien à signaler sur cette demande.')).toBeInTheDocument()
  })

  it('signale un solde insuffisant', () => {
    afficher()
    saisirUneDemande('c-01', '2027-05-03', '2027-07-31')
    expect(screen.getByText(/Solde insuffisant/)).toBeInTheDocument()
  })

  it('signale les jours pris hors période légale', () => {
    afficher()
    saisirUneDemande('c-01', '2027-02-01', '2027-02-16')
    expect(screen.getByText(/hors période légale/)).toBeInTheDocument()
  })

  it('suit le circuit jusqu’à la validation', () => {
    afficher()
    saisirUneDemande()

    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Validé' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Validé »/ }))

    expect(screen.getByText(/bloque désormais le planning/)).toBeInTheDocument()
  })

  it('ne bloque rien tant que la demande n’est pas validée', () => {
    afficher()
    saisirUneDemande()
    expect(screen.queryByText(/bloque désormais le planning/)).not.toBeInTheDocument()
  })

  it('recale un solde sur le bulletin de paie', () => {
    afficher()
    const soldes = screen.getByText('Soldes').parentElement!
    const recalage = within(soldes).getAllByLabelText('Recalage')[0] as HTMLElement
    fireEvent.change(recalage, { target: { value: '-3' } })
    expect(recalage).toHaveValue(-3)
  })

  it('classe l’ordre des départs sans donnée de situation familiale', () => {
    afficher()
    saisirUneDemande('c-01')
    expect(screen.getByText('Ordre des départs')).toBeInTheDocument()
    expect(screen.getByText(/donnée interdite dans cette application/)).toBeInTheDocument()
  })

  it('supprime une demande', () => {
    afficher()
    saisirUneDemande()
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer cette demande' }))
    expect(screen.getByText('Aucune demande enregistrée.')).toBeInTheDocument()
  })

  it('conserve les demandes après rechargement', () => {
    const premiere = afficher()
    saisirUneDemande()
    premiere.unmount()

    afficher()
    expect(screen.getAllByText('Brouillon').length).toBeGreaterThan(0)
  })
})
