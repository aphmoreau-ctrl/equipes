import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Equipe } from './Equipe'
import { Alertes } from './Alertes'

/** Donnees FICTIVES uniquement. */

function afficher(contenu: React.ReactNode) {
  return render(<DonneesProvider>{contenu}</DonneesProvider>)
}

/** La section des fiches : les noms apparaissent aussi ailleurs sur l'ecran. */
function sectionFiches(): HTMLElement {
  const element = screen.getByRole('heading', { name: 'Fiches' }).parentElement
  if (element === null) throw new Error('Section des fiches introuvable.')
  return element
}

function fiche(nom: string): HTMLElement {
  const element = within(sectionFiches()).getByText(nom).closest('details')
  if (element === null) throw new Error(`Fiche « ${nom} » introuvable.`)
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ecran Equipe', () => {
  it('affiche toute l equipe de demonstration', () => {
    afficher(<Equipe />)
    expect(within(sectionFiches()).getByText('Camille D.')).toBeInTheDocument()
    expect(within(sectionFiches()).getByText('Thierry M.')).toBeInTheDocument()
    expect(screen.getByText(/26 personnes/)).toBeInTheDocument()
  })

  it('filtre par rayon, en tenant compte des rayons secondaires', () => {
    afficher(<Equipe />)
    fireEvent.change(screen.getByLabelText('Filtrer par rayon'), { target: { value: 'cremerie' } })

    // Julien S. y est rattache, Camille D. y intervient en secondaire.
    const fiches = sectionFiches()
    expect(within(fiches).getByText('Julien S.')).toBeInTheDocument()
    expect(within(fiches).getByText('Camille D.')).toBeInTheDocument()
    expect(within(fiches).queryByText('Thierry M.')).not.toBeInTheDocument()
  })

  it('compare la capacite du rayon a son budget', () => {
    afficher(<Equipe />)
    fireEvent.change(screen.getByLabelText('Filtrer par rayon'), { target: { value: 'fruits-legumes' } })
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
    const bouton = within(carte).getByRole('button', { name: 'tri : Autonome' })
    fireEvent.click(bouton)
    expect(bouton).toHaveClass('bouton--principal')
  })

  it('ne propose que les compétences utiles au rayon de la personne', () => {
    afficher(<Equipe />)
    // Sofia tient les fruits et legumes : le tri la concerne, la boucherie non.
    const fruitsLegumes = fiche('Sofia B.')
    expect(within(fruitsLegumes).getByText('tri')).toBeInTheDocument()
    expect(within(fruitsLegumes).queryByText('boucherie')).not.toBeInTheDocument()

    // Une competence deja notee reste affichee, meme hors de son rayon.
    expect(within(fruitsLegumes).getByText('hygiène')).toBeInTheDocument()

    // Le caviste, lui, a bien le conseil en vins.
    expect(within(fiche('Victor M.')).getByText('conseil vins')).toBeInTheDocument()
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

    // La fiche n'existe qu'une fois la fenetre remplie et enregistree.
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un collaborateur' }))
    const fenetre = screen.getByRole('dialog', { name: 'Nouveau collaborateur' })
    fireEvent.change(within(fenetre).getByLabelText('Prénom'), { target: { value: 'Noémie' } })
    fireEvent.change(within(fenetre).getByLabelText('Initiale du nom'), { target: { value: 'T.' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Fermer' }))

    expect(within(sectionFiches()).getByText('Noémie T.')).toBeInTheDocument()
    expect(screen.getByText(/27 personnes/)).toBeInTheDocument()

    const carte = fiche('Noémie T.')
    fireEvent.click(within(carte).getByRole('button', { name: 'Retirer de l’effectif' }))
    expect(within(sectionFiches()).queryByText('Noémie T.')).not.toBeInTheDocument()
    expect(screen.getByText(/26 personnes/)).toBeInTheDocument()
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
