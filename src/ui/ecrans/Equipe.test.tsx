import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Equipe } from './Equipe'
import { Alertes } from './Alertes'

/** Donnees FICTIVES uniquement. */

function afficher(contenu: React.ReactNode) {
  return render(<DonneesProvider>{contenu}</DonneesProvider>)
}

function fiche(nom: string): HTMLElement {
  const element = screen.getByText(nom).closest('details')
  if (element === null) throw new Error(`Fiche « ${nom} » introuvable.`)
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ecran Equipe', () => {
  it('affiche toute l equipe de demonstration', () => {
    afficher(<Equipe />)
    expect(screen.getByText('Camille D.')).toBeInTheDocument()
    expect(screen.getByText('Thierry M.')).toBeInTheDocument()
    expect(screen.getByText(/20 personnes/)).toBeInTheDocument()
  })

  it('filtre par rayon, en tenant compte des rayons secondaires', () => {
    afficher(<Equipe />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'cremerie' } })

    // Julien S. y est rattache, Camille D. y intervient en secondaire.
    expect(screen.getByText('Julien S.')).toBeInTheDocument()
    expect(screen.getByText('Camille D.')).toBeInTheDocument()
    expect(screen.queryByText('Thierry M.')).not.toBeInTheDocument()
  })

  it('compare la capacite du rayon a son budget', () => {
    afficher(<Equipe />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'fruits-legumes' } })
    expect(screen.getByText('Capacité du rayon')).toBeInTheDocument()
    expect(screen.getByText(/147 h — budget 180 h/)).toBeInTheDocument()
  })

  it('rappelle la regle RGPD sur l ecran', () => {
    afficher(<Equipe />)
    expect(screen.getByText(/Prénom et initiale uniquement/)).toBeInTheDocument()
  })

  it('modifie les heures d un contrat et conserve la modification', () => {
    const premiere = afficher(<Equipe />)
    const champ = within(fiche('Sofia B.')).getByLabelText('Heures / semaine')
    fireEvent.change(champ, { target: { value: '25' } })
    expect(champ).toHaveValue(25)
    premiere.unmount()

    afficher(<Equipe />)
    expect(within(fiche('Sofia B.')).getByLabelText('Heures / semaine')).toHaveValue(25)
  })

  it('modifie le niveau d une competence', () => {
    afficher(<Equipe />)
    const carte = fiche('Sofia B.')
    const bouton = within(carte).getByRole('button', { name: 'boucherie : Autonome' })
    fireEvent.click(bouton)
    expect(bouton).toHaveClass('bouton--principal')
  })

  it('declare une indisponibilite', () => {
    afficher(<Equipe />)
    const carte = fiche('Mathieu R.')
    const mercredi = within(carte).getAllByRole('button', { name: 'mer' })[0] as HTMLElement
    expect(mercredi).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(mercredi)
    expect(mercredi).toHaveAttribute('aria-pressed', 'false')
  })

  it('ajoute puis retire un collaborateur', () => {
    afficher(<Equipe />)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un collaborateur' }))
    expect(screen.getByText('Nouveau X.')).toBeInTheDocument()
    expect(screen.getByText(/21 personnes/)).toBeInTheDocument()

    const carte = fiche('Nouveau X.')
    fireEvent.click(within(carte).getByRole('button', { name: 'Retirer de l’effectif' }))
    expect(screen.queryByText('Nouveau X.')).not.toBeInTheDocument()
    expect(screen.getByText(/20 personnes/)).toBeInTheDocument()
  })

  it('affiche les plages restreintes declarees', () => {
    afficher(<Equipe />)
    expect(within(fiche('Aurélie G.')).getByText(/Plages restreintes/)).toBeInTheDocument()
  })
})

describe('ecran Alertes', () => {
  it('liste les echeances de l equipe de demonstration', () => {
    afficher(<Alertes />)
    expect(screen.getByText('Alertes')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('signale les rayons qui ne tiennent qu a une personne', () => {
    afficher(<Alertes />)
    expect(screen.getByText(/Une seule personne est autonome en « marée »/)).toBeInTheDocument()
  })

  it('regroupe par urgence', () => {
    afficher(<Alertes />)
    expect(screen.getByRole('heading', { name: 'À anticiper' })).toBeInTheDocument()
  })

  it('fait varier le nombre d alertes selon le preavis', () => {
    afficher(<Alertes />)
    const avant = screen.getAllByRole('listitem').length
    fireEvent.change(screen.getByLabelText(/Habilitation/), { target: { value: '0' } })
    expect(screen.getAllByRole('listitem').length).toBeLessThan(avant)
  })
})
