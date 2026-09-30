import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { creerVerrou } from './verrouillage/code'
import { enBase64Url } from './verrouillage/faceId'

function afficherApplication() {
  return render(
    <HashRouter>
      <App />
    </HashRouter>,
  )
}

function taperAuClavier(code: string): void {
  for (const chiffre of code) {
    fireEvent.click(screen.getByRole('button', { name: chiffre }))
  }
}

function valider(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Valider' }))
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

describe('premier lancement', () => {
  it('demande de choisir un code', async () => {
    afficherApplication()
    expect(await screen.findByText('Choisissez un code')).toBeInTheDocument()
  })

  it('n ouvre pas l application tant que le code n est pas defini', async () => {
    afficherApplication()
    await screen.findByText('Choisissez un code')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('demande une confirmation, puis ouvre l application', async () => {
    afficherApplication()
    await screen.findByText('Choisissez un code')

    taperAuClavier('4242')
    valider()
    expect(await screen.findByText('Confirmez votre code')).toBeInTheDocument()

    taperAuClavier('4242')
    valider()
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
  })

  it('refuse deux codes differents et fait recommencer', async () => {
    afficherApplication()
    await screen.findByText('Choisissez un code')

    taperAuClavier('4242')
    valider()
    await screen.findByText('Confirmez votre code')

    taperAuClavier('9999')
    valider()
    expect(await screen.findByText(/ne correspondent pas/)).toBeInTheDocument()
    expect(screen.getByText('Choisissez un code')).toBeInTheDocument()
  })

  it('n active le bouton Valider qu a partir de quatre chiffres', async () => {
    afficherApplication()
    await screen.findByText('Choisissez un code')

    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
    taperAuClavier('123')
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled()
    taperAuClavier('4')
    expect(screen.getByRole('button', { name: 'Valider' })).toBeEnabled()
  })
})

describe('lancements suivants', () => {
  beforeEach(async () => {
    window.localStorage.setItem('equipes.verrou.v1', JSON.stringify(await creerVerrou('4242')))
  })

  it('demande le code enregistre', async () => {
    afficherApplication()
    expect(await screen.findByText('Entrez votre code')).toBeInTheDocument()
  })

  it('refuse un mauvais code sans ouvrir l application', async () => {
    afficherApplication()
    await screen.findByText('Entrez votre code')

    taperAuClavier('9999')
    valider()
    expect(await screen.findByText('Code incorrect.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('ouvre l application avec le bon code', async () => {
    afficherApplication()
    await screen.findByText('Entrez votre code')

    taperAuClavier('4242')
    valider()
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
  })
})

describe('navigation, une fois l application ouverte', () => {
  beforeEach(async () => {
    window.localStorage.setItem('equipes.verrou.v1', JSON.stringify(await creerVerrou('4242')))
    afficherApplication()
    await screen.findByText('Entrez votre code')
    taperAuClavier('4242')
    valider()
    await screen.findByRole('navigation')
  })

  it('affiche tous les modules du cahier des charges dans le menu', () => {
    const menu = screen.getByRole('navigation')
    for (const titre of ['Aujourd’hui', 'Planning', 'Besoin', 'Équipe', 'Paramètres']) {
      expect(screen.getAllByText(titre).length).toBeGreaterThan(0)
    }
    expect(menu).toBeInTheDocument()
  })

  it('ouvre l ecran d accueil sur « Aujourd’hui »', () => {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aujourd’hui')
  })

  it('annonce clairement les ecrans pas encore construits', () => {
    expect(screen.getByText('Cet écran n’est pas encore construit')).toBeInTheDocument()
  })

  it('affiche l ecran Parametres avec la version', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Paramètres/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Paramètres' })).toBeInTheDocument()
    expect(screen.getByText('tests')).toBeInTheDocument()
  })

  it('montre les sept rayons de demonstration dans les parametres', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Paramètres/ }))
    await screen.findByRole('heading', { level: 1, name: 'Paramètres' })
    expect(screen.getByText('Fruits et légumes')).toBeInTheDocument()
    expect(screen.getByText('Boulangerie')).toBeInTheDocument()
  })

  it('redemande un code apres une demande de changement', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Paramètres/ }))
    await screen.findByRole('heading', { level: 1, name: 'Paramètres' })

    fireEvent.click(screen.getByRole('button', { name: 'Changer le code de verrouillage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, changer le code' }))

    expect(await screen.findByText('Choisissez un code')).toBeInTheDocument()
  })
})


// ---------------------------------------------------------------- Face ID
//
// jsdom n'a ni Face ID ni Touch ID : on simule les reponses de l'appareil
// pour verifier le parcours, pas la biometrie elle-meme.

function simulerAppareilAvecFaceId(reussite: boolean): void {
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: { isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true) },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(navigator, 'credentials', {
    value: {
      create: vi.fn(() => Promise.resolve({ rawId: new Uint8Array([4, 2]).buffer })),
      get: vi.fn(() => {
        if (reussite) return Promise.resolve({ id: 'ok' })
        const refus = new Error('refus')
        refus.name = 'NotAllowedError'
        return Promise.reject(refus)
      }),
    },
    configurable: true,
  })
}

function enregistrerCleAccesFictive(): void {
  window.localStorage.setItem(
    'equipes.cle-acces.v1',
    JSON.stringify({ identifiant: enBase64Url(new Uint8Array([4, 2]).buffer), cree: '2026-09-30' }),
  )
}

describe('ouverture par Face ID', () => {
  beforeEach(async () => {
    window.localStorage.setItem('equipes.verrou.v1', JSON.stringify(await creerVerrou('4242')))
    enregistrerCleAccesFictive()
  })

  afterEach(() => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  it('propose Face ID plutot que le clavier', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    expect(
      await screen.findByRole('button', { name: 'Déverrouiller avec Face ID' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Valider' })).not.toBeInTheDocument()
  })

  it('ouvre l application quand l appareil reconnait son proprietaire', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Déverrouiller avec Face ID' }))
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
  })

  it('n ouvre rien si la demande est fermee, et laisse reessayer', async () => {
    simulerAppareilAvecFaceId(false)
    afficherApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Déverrouiller avec Face ID' }))
    expect(
      await screen.findByRole('button', { name: 'Déverrouiller avec Face ID' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('permet de revenir au code a tout moment', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser mon code' }))

    expect(screen.getByText('Entrez votre code')).toBeInTheDocument()
    taperAuClavier('4242')
    valider()
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
  })
})

describe('proposition de Face ID au premier lancement', () => {
  afterEach(() => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  it('propose Face ID juste apres le choix du code', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    await screen.findByText('Choisissez un code')

    taperAuClavier('4242')
    valider()
    await screen.findByText('Confirmez votre code')
    taperAuClavier('4242')
    valider()

    expect(await screen.findByText('Activer Face ID ?')).toBeInTheDocument()
  })

  it('laisse passer sans activer Face ID', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    await screen.findByText('Choisissez un code')

    taperAuClavier('4242')
    valider()
    await screen.findByText('Confirmez votre code')
    taperAuClavier('4242')
    valider()
    fireEvent.click(await screen.findByRole('button', { name: 'Plus tard' }))

    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(window.localStorage.getItem('equipes.cle-acces.v1')).toBeNull()
  })

  it('enregistre la cle d acces quand on active Face ID', async () => {
    simulerAppareilAvecFaceId(true)
    afficherApplication()
    await screen.findByText('Choisissez un code')

    taperAuClavier('4242')
    valider()
    await screen.findByText('Confirmez votre code')
    taperAuClavier('4242')
    valider()
    fireEvent.click(await screen.findByRole('button', { name: 'Activer Face ID' }))

    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(window.localStorage.getItem('equipes.cle-acces.v1')).not.toBeNull()
  })
})
