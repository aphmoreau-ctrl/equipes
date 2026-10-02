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
  const element = screen.getByRole('heading', { name: 'Équité sur quatre semaines' }).parentElement
  if (element === null) throw new Error('Section équité introuvable.')
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('équité sur quatre semaines', () => {
  it('ne dit rien quand aucune sujétion n’est enregistrée', () => {
    afficher()
    expect(within(section()).getByText(/Aucune sujétion enregistrée/)).toBeInTheDocument()
  })

  it('compte un samedi dès qu’il est posé', () => {
    afficher()
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., samedi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))

    const equite = section()
    const ligne = within(equite).getByRole('row', { name: /^Camille D\./ })
    expect(within(ligne).getAllByText('1').length).toBeGreaterThan(0)
  })

  it('propose de construire plusieurs semaines d’affilée', () => {
    afficher()
    const choix = screen.getByLabelText('Nombre de semaines à construire')
    expect(choix).toHaveValue('1')
    fireEvent.change(choix, { target: { value: '4' } })
    expect(choix).toHaveValue('4')
  })

  it('explique que toutes les sujétions ne se valent pas', () => {
    afficher()
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., samedi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    expect(within(section()).getByText(/Un dimanche pèse une fois et demie/)).toBeInTheDocument()
  })
})
