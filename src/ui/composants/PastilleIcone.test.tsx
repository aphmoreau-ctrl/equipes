import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReglagePastille, etatDeLaPastille, poserLaPastille } from './PastilleIcone'

/** Simule un appareil : sait-il poser une pastille, et ou en est l'autorisation. */
function simulerAppareil(options: {
  readonly pastille: boolean
  readonly autorisation?: NotificationPermission
  readonly reponse?: NotificationPermission
}) {
  const poses: readonly number[] = []
  const journal = poses as number[]

  if (options.pastille) {
    vi.stubGlobal('navigator', {
      setAppBadge: (nombre: number) => {
        journal.push(nombre)
        return Promise.resolve()
      },
      clearAppBadge: () => {
        journal.push(0)
        return Promise.resolve()
      },
    })
  } else {
    vi.stubGlobal('navigator', {})
  }

  if (options.autorisation === undefined) {
    vi.stubGlobal('Notification', undefined)
  } else {
    vi.stubGlobal('Notification', {
      permission: options.autorisation,
      requestPermission: () => {
        const accordee = options.reponse ?? 'denied'
        ;(globalThis.Notification as unknown as { permission: string }).permission = accordee
        return Promise.resolve(accordee)
      },
    })
  }

  return journal
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('pastille sur l’icone', () => {
  it('se dit indisponible quand l’appareil ne sait pas poser de pastille', () => {
    simulerAppareil({ pastille: false, autorisation: 'granted' })
    expect(etatDeLaPastille()).toBe('indisponible')

    render(<ReglagePastille nombre={3} />)
    expect(screen.getByText(/ne sait pas afficher de nombre/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('attend un geste de l’utilisateur avant de demander l’autorisation', async () => {
    const poses = simulerAppareil({
      pastille: true,
      autorisation: 'default',
      reponse: 'granted',
    })
    expect(etatDeLaPastille()).toBe('a-demander')

    render(<ReglagePastille nombre={4} />)

    // Rien n'a ete demande ni pose tant que l'on n'a pas clique.
    expect(poses).toHaveLength(0)
    expect(screen.getByText(/aucune notification/)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Activer la pastille/ }))
    })

    expect(poses).toEqual([4])
    expect(screen.getByText(/Activée/)).toBeInTheDocument()
  })

  it('explique comment revenir en arriere apres un refus', () => {
    simulerAppareil({ pastille: true, autorisation: 'denied' })
    expect(etatDeLaPastille()).toBe('refusee')

    render(<ReglagePastille nombre={2} />)
    expect(screen.getByText(/Notifications/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('annonce le nombre d’alertes quand l’autorisation est acquise', () => {
    simulerAppareil({ pastille: true, autorisation: 'granted' })

    render(<ReglagePastille nombre={1} />)
    expect(screen.getByText(/1 alerte/)).toBeInTheDocument()
  })

  it('efface la pastille quand il n’y a plus d’alerte', () => {
    const poses = simulerAppareil({ pastille: true, autorisation: 'granted' })

    poserLaPastille(5)
    poserLaPastille(0)
    expect(poses).toEqual([5, 0])
  })
})
