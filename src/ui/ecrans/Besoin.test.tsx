import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Besoin } from './Besoin'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Besoin />
    </DonneesProvider>,
  )
}

/** Un lundi de novembre, jour de livraison dans les donnees de demonstration. */
const LUNDI = '2026-11-02'

function choisirLeJour(date: string): void {
  fireEvent.change(screen.getByLabelText('Jour'), { target: { value: date } })
}

function choisirLeRayon(nom: string): void {
  fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: nom } })
}

/**
 * La legende de la courbe. Les noms de blocs apparaissent aussi dans le
 * selecteur du mode chrono : on limite la recherche a la legende.
 */
function legende(): HTMLElement {
  const element = document.querySelector('.courbe__legende')
  if (element === null) throw new Error('Légende introuvable.')
  return element as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ecran Besoin', () => {
  it('propose les sept rayons du magasin', async () => {
    afficher()
    const choix = await screen.findByLabelText('Rayon')
    expect(within(choix).getAllByRole('option')).toHaveLength(7)
  })

  it('affiche la courbe et les totaux du rayon fruits et legumes', async () => {
    afficher()
    choisirLeJour(LUNDI)

    expect(await screen.findByText('Courbe du besoin')).toBeInTheDocument()
    expect(screen.getByText('Totaux de la journée')).toBeInTheDocument()
    expect(screen.getByText('Travail à faire')).toBeInTheDocument()
    expect(screen.getByText(/personnes en même temps/)).toBeInTheDocument()
  })

  it('decompose la courbe bloc par bloc', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')

    // La legende nomme les blocs qui apportent du travail ce jour-la.
    const noms = legende().textContent ?? ''
    expect(noms).toContain('Réception et contrôle')
    expect(noms).toContain('Mise en place des étals (vrac)')
    expect(noms).toContain('Réassort en journée')
    expect(noms).toContain('Personnes retenues')
  })

  it('calcule aussi les six autres rayons, avec leurs propres blocs', async () => {
    afficher()
    choisirLeJour(LUNDI)
    choisirLeRayon('boucherie')

    expect(await screen.findByText('Courbe du besoin')).toBeInTheDocument()
    // Blocs propres a la boucherie, absents des fruits et legumes.
    const noms = legende().textContent ?? ''
    expect(noms).toContain('Comptoir boucherie')
    expect(noms).toContain('Laboratoire : hachés, brochettes, barquettes')
    expect(noms).not.toContain('Réassort en journée')
  })

  it('recalcule le besoin quand la meteo change', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')

    expect(screen.queryByText('×1,30')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Très chaud' }))
    expect(screen.getByText('×1,30')).toBeInTheDocument()
  })

  it('recalcule le besoin quand le rayon passe en promotion', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')

    expect(screen.getByRole('button', { name: 'Pas de promotion' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pas de promotion' }))
    expect(screen.getByRole('button', { name: 'Rayon en promotion' })).toBeInTheDocument()
    expect(screen.getByText('×1,25')).toBeInTheDocument()
  })

  it('enregistre une qualite a la reception et augmente le besoin', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')

    fireEvent.change(screen.getByLabelText('Produit'), { target: { value: 'Fraises' } })
    fireEvent.change(screen.getByLabelText('Palettes'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Qualité C — Tri important' }))

    expect(screen.getByText(/Fraises/)).toBeInTheDocument()
    expect(screen.getByText('×1,80')).toBeInTheDocument()
  })

  it('n enregistre rien sans nom de produit', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')
    expect(screen.getByRole('button', { name: 'Qualité C — Tri important' })).toBeDisabled()
  })

  it('permet de retirer une saisie de qualite', async () => {
    afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')

    fireEvent.change(screen.getByLabelText('Produit'), { target: { value: 'Fraises' } })
    fireEvent.click(screen.getByRole('button', { name: 'Qualité C — Tri important' }))
    expect(screen.getByText(/Fraises/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }))
    expect(screen.queryByText(/Fraises/)).not.toBeInTheDocument()
  })

  it('signale les evenements du calendrier', async () => {
    afficher()
    choisirLeJour('2026-11-05') // pendant le catalogue promotionnel
    await screen.findByText('Courbe du besoin')
    expect(screen.getByText(/Catalogue promotionnel automne/)).toBeInTheDocument()
  })

  it('conserve les saisies apres rechargement de l application', async () => {
    const premiere = afficher()
    choisirLeJour(LUNDI)
    await screen.findByText('Courbe du besoin')
    fireEvent.change(screen.getByLabelText('Produit'), { target: { value: 'Tomates' } })
    fireEvent.click(screen.getByRole('button', { name: 'Qualité B — Tri léger' }))
    expect(screen.getByText(/Tomates/)).toBeInTheDocument()
    premiere.unmount()

    afficher()
    choisirLeJour(LUNDI)
    expect(await screen.findByText(/Tomates/)).toBeInTheDocument()
  })
})
