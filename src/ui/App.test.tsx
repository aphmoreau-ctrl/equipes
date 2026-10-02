import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { creerVerrou } from './verrouillage/code'
import { enBase64Url } from './verrouillage/faceId'
import { REQUETE_COLONNE } from './useDisposition'

/**
 * jsdom n'a pas de taille d'ecran : on lui en donne une, pour choisir entre
 * le menu lateral de l'iPad et la barre d'onglets de l'iPhone.
 */
function simulerEcran(disposition: 'colonne' | 'onglets'): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (requete: string) => ({
      matches: requete === REQUETE_COLONNE && disposition === 'colonne',
      media: requete,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  })
}

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
  /*
   * Remettre l'adresse a zero SANS declencher « hashchange ».
   * « window.location.hash = '' » declenche l'evenement de facon differee :
   * il arrivait pendant le test SUIVANT, faisait croire a un changement
   * d'ecran et refermait aussitot le panneau « Plus » a peine ouvert. D'ou
   * un echec au hasard, qui a deja bloque une publication.
   */
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  simulerEcran('colonne')
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

  it('ouvre l ecran d accueil sur « Aujourd’hui », desormais construit', () => {
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Aujourd’hui')
    expect(screen.getByText('Absence imprévue')).toBeInTheDocument()
  })

  it('n a plus aucun ecran en attente : tous les modules sont construits', async () => {
    for (const titre of [
      'Planning',
      'Besoin',
      'Équipe',
      'Alertes',
      'Heures',
      'Congés',
      'Compétences',
      'Pilotage',
      'Communication',
      'Documents',
      'Paramètres',
    ]) {
      fireEvent.click(screen.getByRole('link', { name: new RegExp(titre) }))
      expect(
        await screen.findByRole('heading', { level: 1 }),
        `l’écran « ${titre} » devrait être construit`,
      ).toBeInTheDocument()
      expect(screen.queryByText('Cet écran n’est pas encore construit')).not.toBeInTheDocument()
    }
  })

  it('affiche l ecran Parametres avec la version', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Paramètres/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Paramètres' })).toBeInTheDocument()
    expect(screen.getByText('tests')).toBeInTheDocument()
  })

  it('montre les neuf rayons de demonstration dans les parametres', async () => {
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


// ------------------------------------------------- Navigation sur iPhone

describe('barre d onglets de l iPhone', () => {
  beforeEach(async () => {
    simulerEcran('onglets')
    window.localStorage.setItem('equipes.verrou.v1', JSON.stringify(await creerVerrou('4242')))
    afficherApplication()
    await screen.findByText('Entrez votre code')
    taperAuClavier('4242')
    valider()
    /*
     * Attendre le bouton « Plus » lui-meme, et non une barre de navigation
     * quelconque : « navigation » correspond aussi au menu lateral de l'iPad,
     * affiche un instant avant que la disposition ne soit mesuree. Les tests
     * agissaient alors sur une barre d'onglets pas encore en place, et
     * echouaient au hasard — ce qui a deja bloque une publication.
     */
    await screen.findByRole('button', { name: 'Plus' })
  })

  it('affiche quatre onglets et un bouton « Plus »', () => {
    const barre = screen.getByRole('navigation')
    expect(within(barre).getAllByRole('link').map((lien) => lien.textContent)).toEqual([
      'Aujourd’hui',
      'Planning',
      'Équipe',
      'Besoin',
    ])
    expect(within(barre).getByRole('button', { name: 'Plus' })).toBeInTheDocument()
  })

  it('ne montre pas les autres modules tant que « Plus » n est pas ouvert', () => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Paramètres/ })).not.toBeInTheDocument()
  })

  it('ouvre la liste de tous les autres modules', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))

    const panneau = await screen.findByRole('dialog', { name: 'Autres modules' })
    const titres = within(panneau)
      .getAllByRole('link')
      .map((lien) => lien.textContent ?? '')

    for (const attendu of [
      'Alertes',
      'Heures',
      'Congés',
      'Compétences',
      'Pilotage',
      'Communication',
      'Documents',
      'Paramètres',
    ]) {
      expect(titres.some((titre) => titre.startsWith(attendu))).toBe(true)
    }
  })

  it('ouvre l ecran choisi et referme le panneau', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    const panneau = await screen.findByRole('dialog', { name: 'Autres modules' })
    fireEvent.click(within(panneau).getByRole('link', { name: /Paramètres/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Paramètres' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('referme le panneau avec la touche Échap', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('referme le panneau en touchant a cote', async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Plus' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Fermer le menu' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('n affiche pas le menu lateral', () => {
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getByRole('navigation')).toHaveClass('onglets')
  })
})

describe('menu lateral de l iPad', () => {
  beforeEach(async () => {
    simulerEcran('colonne')
    window.localStorage.setItem('equipes.verrou.v1', JSON.stringify(await creerVerrou('4242')))
    afficherApplication()
    await screen.findByText('Entrez votre code')
    taperAuClavier('4242')
    valider()
    await screen.findByRole('navigation')
  })

  it('affiche les treize modules d un seul coup d oeil', () => {
    const menu = screen.getByRole('navigation')
    expect(menu).toHaveClass('menu-lateral')
    expect(within(menu).getAllByRole('link')).toHaveLength(13)
  })

  it('signale les alertes urgentes par une pastille sur le menu', () => {
    // Les entretiens professionnels de la demonstration sont en retard.
    const lien = screen.getByRole('link', { name: /Alertes/ })
    expect(lien).toHaveTextContent(/à traiter tout de suite/)
    expect(lien.querySelector('.navigation__pastille--urgent')).not.toBeNull()
  })

  it('retrouve un collaborateur depuis la recherche globale', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Rechercher/ }))
    const champ = await screen.findByLabelText('Texte à rechercher')
    fireEvent.change(champ, { target: { value: 'CAMILLE' } })
    expect(await screen.findByText('Camille D.')).toBeInTheDocument()
  })

  it('refuse de restaurer un fichier qui n est pas une sauvegarde', async () => {
    fireEvent.click(screen.getByRole('link', { name: /Paramètres/ }))
    await screen.findByRole('heading', { level: 1, name: 'Paramètres' })
    const fichier = new File(['{"autre":1}'], 'autre.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Fichier de sauvegarde à restaurer'), {
      target: { files: [fichier] },
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/n’est pas une sauvegarde/)
  })

  it('n affiche ni barre d onglets ni bouton « Plus »', () => {
    expect(screen.queryByRole('button', { name: 'Plus' })).not.toBeInTheDocument()
  })
})
