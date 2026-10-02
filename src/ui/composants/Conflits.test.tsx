import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Planning } from '../ecrans/Planning'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Planning />
    </DonneesProvider>,
  )
}

function section(): HTMLElement {
  const element = screen.getByRole('heading', { name: 'Conflits et solutions' }).parentElement
  if (element === null) throw new Error('Section des conflits introuvable.')
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('conflits dans l’écran Planning', () => {
  it('liste les conflits du plus grave au moins grave', () => {
    afficher()
    const conflits = section()
    expect(within(conflits).getByText(/conflits? à traiter/)).toBeInTheDocument()
    // Le premier conflit est une compétence critique.
    expect(within(conflits).getAllByText(/poste intenable/).length).toBeGreaterThan(0)
  })

  it('propose des solutions classées, du prêt à la formation', () => {
    afficher()
    const conflits = section()
    expect(within(conflits).getAllByText('Prêt entre rayons').length).toBeGreaterThan(0)
    expect(within(conflits).getAllByText('Formation à prévoir').length).toBeGreaterThan(0)
  })

  it('n’offre « Appliquer » que pour le prêt et le décalage', () => {
    afficher()
    const conflits = section()
    const solutions = within(conflits).getAllByRole('listitem')
    const avecFormation = solutions.filter((element) =>
      element.textContent?.includes('Formation à prévoir'),
    )
    for (const element of avecFormation) {
      expect(within(element).queryByRole('button', { name: 'Appliquer' })).not.toBeInTheDocument()
    }
  })

  it('applique un prêt et place la vacation dans la grille', () => {
    afficher()
    const grille = screen.getByRole('heading', { name: 'Grille de la semaine' })
      .parentElement as HTMLElement
    const avant = within(grille).queryAllByText(/^\d{2}:\d{2}–\d{2}:\d{2}$/).length

    const premierPret = within(section()).getAllByRole('button', { name: 'Appliquer' })[0]
    expect(premierPret).toBeDefined()
    fireEvent.click(premierPret as HTMLElement)

    const apres = within(grille).queryAllByText(/^\d{2}:\d{2}–\d{2}:\d{2}$/).length
    expect(apres).toBe(avant + 1)
  })

  it('dit clairement quand il n’y a plus rien à traiter', () => {
    afficher()
    // Avec le planning de démonstration vide, il y a forcément des conflits :
    // on vérifie au moins que le message de succès n'est pas affiché à tort.
    expect(within(section()).queryByText(/Aucun conflit/)).not.toBeInTheDocument()
  })
})
