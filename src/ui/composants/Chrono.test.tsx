import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider, useDonnees } from '../DonneesProvider'
import { Chrono } from './Chrono'

/** Donnees FICTIVES uniquement. */

/**
 * Comme dans l'application : la configuration vient de l'etat, pas d'une
 * constante figee. C'est ce qui permet au recalage de se voir aussitot.
 */
function ChronoDuRayon() {
  const { etat } = useDonnees()
  const configuration = etat.configurations.find((c) => c.rayonId === 'fruits-legumes')
  if (configuration === undefined) return null
  return <Chrono configuration={configuration} />
}

function afficher() {
  return render(
    <DonneesProvider>
      <ChronoDuRayon />
    </DonneesProvider>,
  )
}

/** Choisit la mise en place des etals, reglee a 22 colis par heure. */
function choisirLaMiseEnPlace(): void {
  fireEvent.change(screen.getByLabelText('Tâche'), {
    target: { value: 'fl-mise-en-place-vrac' },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-11-02T06:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mode chrono', () => {
  it('propose de démarrer une mesure', () => {
    afficher()
    expect(screen.getByRole('button', { name: 'Démarrer le chrono' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tâche')).toBeInTheDocument()
  })

  it('démarre le chrono et affiche le temps qui passe', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))

    const compteur = screen.getByRole('timer')
    expect(compteur).toHaveTextContent('00:00:00')

    act(() => {
      vi.advanceTimersByTime(65_000)
    })
    expect(compteur).toHaveTextContent('00:01:05')
  })

  it('arrête le chrono et enregistre la mesure avec sa cadence', () => {
    afficher()
    choisirLaMiseEnPlace()
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))

    act(() => {
      vi.advanceTimersByTime(60 * 60_000) // une heure
    })
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter et enregistrer' }))

    expect(screen.getByText('Dernières mesures')).toBeInTheDocument()
    // Le texte est coupe par des balises : on lit le contenu de la liste.
    const liste = screen.getByText('Dernières mesures').nextElementSibling
    expect(liste?.textContent).toContain('30 colis en 1 h')
    expect(liste?.textContent).toContain('30.0 colis par heure')
  })

  it('permet d’annuler une mesure lancée par erreur', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler cette mesure' }))
    expect(screen.getByRole('button', { name: 'Démarrer le chrono' })).toBeInTheDocument()
    expect(screen.queryByText('Dernières mesures')).not.toBeInTheDocument()
  })

  it('n’ouvre qu’un seul chrono à la fois', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    expect(screen.queryByRole('button', { name: 'Démarrer le chrono' })).not.toBeInTheDocument()
  })

  it('enregistre la qualité de la marchandise', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Qualité C' }))
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    expect(screen.getByText(/qualité C/)).toBeInTheDocument()
  })

  it('propose de recaler la cadence après plusieurs mesures concordantes', () => {
    afficher()
    // Le bloc est regle a 22 colis par heure ; on en mesure 40.
    for (let index = 0; index < 4; index += 1) {
      choisirLaMiseEnPlace()
      fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '40' } })
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
      act(() => {
        vi.advanceTimersByTime(60 * 60_000)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Arrêter et enregistrer' }))
    }

    expect(screen.getByText('Cadences à recaler')).toBeInTheDocument()
    expect(screen.getByText(/réglé à/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Appliquer/ })).toBeInTheDocument()
  })

  it('ne propose rien après une seule mesure', () => {
    afficher()
    choisirLaMiseEnPlace()
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
    act(() => {
      vi.advanceTimersByTime(60 * 60_000)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter et enregistrer' }))
    expect(screen.queryByText('Cadences à recaler')).not.toBeInTheDocument()
  })

  it('applique le recalage et fait disparaître la proposition', () => {
    afficher()
    for (let index = 0; index < 4; index += 1) {
      choisirLaMiseEnPlace()
      fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '40' } })
      fireEvent.click(screen.getByRole('button', { name: 'Démarrer le chrono' }))
      act(() => {
        vi.advanceTimersByTime(60 * 60_000)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Arrêter et enregistrer' }))
    }

    const proposition = screen.getByText('Cadences à recaler').parentElement!
    fireEvent.click(within(proposition).getByRole('button', { name: /^Appliquer/ }))

    // Le parametre a bouge d'un pas, sans sauter directement a la mesure.
    const apres = screen.getByText('Cadences à recaler').nextElementSibling?.textContent ?? ''
    expect(apres).toContain('mesuré à 40')
    // Le reglage a avance d'un pas vers la mesure, sans y sauter.
    const regle = /réglé à ([\d.]+)/.exec(apres)?.[1]
    expect(Number(regle)).toBeGreaterThan(22)
    expect(Number(regle)).toBeLessThan(40)
  })
})
