import { describe, expect, it } from 'vitest'
import { rangDansRayon, rayonsPossibles, nomAffiche } from '../domaine/collaborateur'
import { construireEtatReel, identifiantDe, versCollaborateur, type SaisieCollaborateur } from './import-equipe'
import { COMPETENCE, RAYON, ROTATION_SAMEDI_PREPARATION, TACHE } from './modele-la-vaugine'
import { pointsADefinir } from '../moteurs/organisation'
import { creerSauvegarde, lireSauvegarde } from './sauvegarde'

/** Prenoms ENTIEREMENT FICTIFS. */
const EQUIPE: readonly SaisieCollaborateur[] = [
  { prenom: 'Alix', statut: 'employe', heures: 36.75, principaux: [RAYON.maree], secondaires: [RAYON.cuisineMobile] },
  {
    prenom: 'Basile',
    statut: 'employe',
    heures: 39,
    principaux: [RAYON.charcuterieFromage],
    secondaires: [RAYON.maree],
    depannage: [RAYON.boucherieTrad],
    taches: [TACHE.emballageCharcuterie],
  },
  {
    prenom: 'Côme',
    statut: 'manager',
    heures: 36.75,
    principaux: [RAYON.boucherieLs, RAYON.boucherieTrad],
    fonctions: ['responsable'],
    taches: [TACHE.emballageBoucherie, TACHE.emballageCharcuterie],
  },
  { prenom: 'Dana', initiale: 'r', statut: 'apprenti', trancheAge: '16-17', heures: 36.75, principaux: [RAYON.boucherieTrad, RAYON.boucherieLs] },
  { prenom: 'Dana', initiale: 'S.', statut: 'interim', heures: 36.75, principaux: [RAYON.fruitsLegumes], posteDuMatin: 'preference' },
  { prenom: 'Élio', statut: 'employe', heures: 36.75, principaux: [RAYON.preparationTraiteur], rotations: [ROTATION_SAMEDI_PREPARATION] },
  { prenom: 'Fanny', statut: 'cadre-forfait', principaux: [RAYON.preparationTraiteur], fonctions: ['responsable'], rotations: [ROTATION_SAMEDI_PREPARATION] },
]

describe('fiche importée', () => {
  it('donne un identifiant sans accent, distinct par initiale', () => {
    expect(identifiantDe('Jean Luc', 'C.')).toBe('jean-luc-c')
    expect(identifiantDe('Élio')).toBe('elio')
  })

  it('range les rayons par rang : titulaire, renfort, dépannage', () => {
    const basile = versCollaborateur(EQUIPE[1] as SaisieCollaborateur)
    expect(rangDansRayon(basile, RAYON.charcuterieFromage)).toBe('principal')
    expect(rangDansRayon(basile, RAYON.maree)).toBe('secondaire')
    expect(rangDansRayon(basile, RAYON.boucherieTrad)).toBe('depannage')
    expect(rangDansRayon(basile, RAYON.fruitsLegumes)).toBeNull()
    // Le depannage ne se propose jamais d'office.
    expect(rayonsPossibles(basile)).not.toContain(RAYON.boucherieTrad)
    expect(basile.heuresHebdomadaires).toBe(39)
  })

  it('accepte plusieurs rayons principaux et donne la rôtisserie aux bouchers', () => {
    const come = versCollaborateur(EQUIPE[2] as SaisieCollaborateur)
    expect(come.rayonPrincipal).toBe(RAYON.boucherieLs)
    expect(rangDansRayon(come, RAYON.boucherieTrad)).toBe('principal')
    expect(come.competences[COMPETENCE.rotisserie]).toBe(2)
    expect(come.fonctions).toEqual(['manager', 'responsable'])
    expect(versCollaborateur(EQUIPE[0] as SaisieCollaborateur).competences[COMPETENCE.rotisserie]).toBeUndefined()
  })

  it('note le mineur, l’apprenti et le cadre au forfait', () => {
    const dana = versCollaborateur(EQUIPE[3] as SaisieCollaborateur)
    expect(dana.trancheAge).toBe('16-17')
    expect(dana.contrat).toBe('apprenti')
    expect(dana.joursEcole).toBeUndefined()
    expect(nomAffiche(dana)).toBe('Dana R.')
    const fanny = versCollaborateur(EQUIPE[6] as SaisieCollaborateur)
    expect(fanny.forfait).toBe(true)
    expect(fanny.statut).toBe('cadre')
    expect(nomAffiche(fanny)).toBe('Fanny')
  })

  it('refuse un rayon inconnu ou une fiche sans rayon principal', () => {
    expect(() => versCollaborateur({ prenom: 'X', statut: 'employe', principaux: [] })).toThrow()
    expect(() => versCollaborateur({ prenom: 'X', statut: 'employe', principaux: ['boulangerie'] })).toThrow()
  })
})

describe('état complet du magasin', () => {
  const etat = construireEtatReel(EQUIPE)

  it('ne mélange aucune donnée de démonstration', () => {
    expect(etat.demonstration).toBe(false)
    expect(etat.collaborateurs).toHaveLength(EQUIPE.length)
    expect(etat.renforts).toEqual([])
    expect(etat.magasin.rayons.map((r) => r.id)).toContain(RAYON.boucherieLs)
  })

  it('range les personnes désignées dans les tâches et la rotation', () => {
    const tache = (id: string) => etat.organisation.taches.find((t) => t.id === id)
    expect(tache(TACHE.emballageCharcuterie)?.personnesDesignees).toEqual(['c-basile', 'c-come'])
    expect(tache(TACHE.emballageBoucherie)?.personnesDesignees).toEqual(['c-come'])
    expect(etat.organisation.rotations[0]?.personnes).toEqual(['c-elio', 'c-fanny'])
  })

  it('refuse deux personnes de même nom', () => {
    expect(() => construireEtatReel([EQUIPE[0] as SaisieCollaborateur, EQUIPE[0] as SaisieCollaborateur])).toThrow(
      /même nom/,
    )
  })

  it('se sauvegarde et se restaure à l’identique', () => {
    const lecture = lireSauvegarde(creerSauvegarde(etat, new Date('2026-11-01T10:00:00Z')))
    expect(lecture.ok).toBe(true)
    if (lecture.ok) expect(lecture.etat).toEqual(etat)
  })

  it('signale ce qui reste à définir, sans les points réglés par l’import', () => {
    const points = pointsADefinir(etat).map((p) => p.libelle)
    expect(points).toContain('Dana R. : jours d’école.')
    expect(points).toContain('Rôtisserie : durée d’une cuisson.')
    expect(points).toContain('Emballage fromage : qui la fait, les jours, l’heure et la durée.')
    expect(points).toContain('Emballage boucherie : les jours, l’heure et la durée.')
    expect(points).toContain('Remballe (7 rayons) : l’heure et la durée.')
    expect(points).toContain(
      'Réunion secteur trad : responsable (réunion trad) à désigner pour Marée et Charcuterie / Fromage.',
    )
    expect(points.some((p) => p.startsWith('Samedi en préparation traiteur'))).toBe(false)
    expect(points.some((p) => p.startsWith('Réunion managers'))).toBe(false)
  })
})
