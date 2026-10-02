import { useState } from 'react'
import {
  JOURS_SEMAINE,
  ajouterJours,
  aujourdhui,
  dateEnTexte,
  nomDuJour,
} from '../../domaine/calendrier'
import {
  LIBELLES_CONTRAT,
  LIBELLES_TRANCHE_AGE,
  LIBELLES_NIVEAU,
  LIBELLES_STATUT,
  capaciteHebdomadaire,
  disponibiliteDuJour,
  nomAffiche,
  type Collaborateur,
  type NiveauCompetence,
  type PeriodeFormation,
  type TrancheAge,
} from '../../domaine/collaborateur'
import { rayonParId, rayonsActifs } from '../../domaine/magasin'
import { competencesDuRayon, type Competence } from '../../domaine/competence'
import { useDonnees } from '../DonneesProvider'
import { ChampNombre, ChampTexte, Depliant, Interrupteur } from '../composants/Champ'
import {
  SectionIntegration,
  SectionRecrutement,
  SectionSecurite,
  SectionSuiviIndividuel,
} from './equipe/SectionsRH'
import { SectionVivier } from './equipe/SectionVivier'
import {
  NouveauCollaborateur,
  type BrouillonCollaborateur,
} from './equipe/NouveauCollaborateur'


const NIVEAUX: readonly NiveauCompetence[] = [0, 1, 2, 3]

export function Equipe() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const [filtre, setFiltre] = useState('tous')
  const [fenetreOuverte, setFenetreOuverte] = useState(false)

  const competencesProposees = (collaborateur: Collaborateur): string[] =>
    competencesDeLaFiche(etat.competences, collaborateur)

  const equipe = etat.collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .filter(
      (collaborateur) =>
        filtre === 'tous' ||
        collaborateur.rayonPrincipal === filtre ||
        collaborateur.rayonsSecondaires.includes(filtre),
    )
    .sort((a, b) => nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))

  function modifierCollaborateur(identifiant: string, changement: Partial<Collaborateur>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      collaborateurs: precedent.collaborateurs.map((collaborateur) =>
        collaborateur.id === identifiant ? { ...collaborateur, ...changement } : collaborateur,
      ),
    }))
  }

  /**
   * Enregistre la fiche saisie dans la fenetre. Tout ce qui n'y figure pas
   * prend une valeur de depart raisonnable, modifiable ensuite dans la fiche.
   */
  function enregistrerNouveau(brouillon: BrouillonCollaborateur): void {
    const identifiant = `c-${Date.now()}`
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      collaborateurs: [
        ...precedent.collaborateurs,
        {
          id: identifiant,
          prenom: brouillon.prenom,
          initiale: brouillon.initiale,
          serviceId: 'frais',
          rayonPrincipal: brouillon.rayonPrincipal,
          rayonsSecondaires: [...brouillon.rayonsSecondaires],
          poste: 'Employé commercial',
          statut: 'employe',
          niveauClassification: 'Niveau 2',
          contrat: brouillon.contrat,
          heuresHebdomadaires: brouillon.heuresHebdomadaires,
          tempsPlein: brouillon.heuresHebdomadaires >= 35,
          dateEntree: brouillon.dateEntree,
          finPeriodeEssai: null,
          finContrat: brouillon.finContrat,
          // Un repos fixe se traduit par une journee declaree non disponible.
          disponibilites: brouillon.reposFixes.map((jour) => ({
            jour,
            disponible: false,
            plage: null,
          })),
          competences: {},
          habilitations: [],
          compteursEquite: {
            samedisTravailles: 0,
            dimanchesTravailles: 0,
            fermetures: 0,
            feriesTravailles: 0,
          },
          periodesFormation: [],
          trancheAge: 'majeur',
          contactAutorise: false,
          actif: true,
        },
      ],
    }))
  }

  const heuresContrat = equipe.reduce(
    (somme, collaborateur) => somme + collaborateur.heuresHebdomadaires,
    0,
  )

  return (
    <>
      <header className="entete">
        <h1>Équipe</h1>
        <p>Fiches des collaborateurs : contrats, disponibilités, compétences, dates clés.</p>
      </header>

      <section className="carte">
        <div className="champs">
          <label className="champ">
            <span className="champ__libelle">Filtrer par rayon</span>
            <select
              className="champ__saisie"
              value={filtre}
              onChange={(evenement) => setFiltre(evenement.target.value)}
            >
              <option value="tous">Tous les rayons</option>
              {rayons.map((rayon) => (
                <option key={rayon.id} value={rayon.id}>
                  {rayon.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="liste-faits">
          <dt>Effectif</dt>
          <dd>
            {equipe.length} personne{equipe.length > 1 ? 's' : ''}
          </dd>
          <dt>Heures au contrat</dt>
          <dd>{heuresContrat} h par semaine</dd>
          {filtre !== 'tous' && (
            <>
              <dt>Capacité du rayon</dt>
              <dd>
                {capaciteHebdomadaire(etat.collaborateurs, filtre)} h — budget{' '}
                {etat.magasin.budgetHeuresParRayon[filtre] ?? 0} h
              </dd>
            </>
          )}
        </dl>
      </section>

      <section className="carte">
        <h2>Fiches</h2>
        <p className="avis">
          <strong>RGPD.</strong> Prénom et initiale uniquement, faits datés seulement. Jamais de
          motif d’absence détaillé, de situation personnelle ni d’appréciation.
        </p>

        {equipe.map((collaborateur) => (
          <Depliant
            key={collaborateur.id}
            titre={nomAffiche(collaborateur)}
            resume={`${collaborateur.poste} · ${LIBELLES_CONTRAT[collaborateur.contrat]} ${collaborateur.heuresHebdomadaires} h · ${rayonParId(etat.magasin, collaborateur.rayonPrincipal)?.nom ?? '—'}`}
          >
            <div className="champs">
              <ChampTexte
                libelle="Prénom"
                valeur={collaborateur.prenom}
                onChange={(prenom) => modifierCollaborateur(collaborateur.id, { prenom })}
              />
              <ChampTexte
                libelle="Initiale"
                etroit
                valeur={collaborateur.initiale}
                onChange={(initiale) => modifierCollaborateur(collaborateur.id, { initiale })}
                aide="Initiale du nom uniquement"
              />
              <ChampTexte
                libelle="Poste"
                valeur={collaborateur.poste}
                onChange={(poste) => modifierCollaborateur(collaborateur.id, { poste })}
              />
            </div>

            <div className="champs">
              <label className="champ champ--etroit">
                <span className="champ__libelle">Contrat</span>
                <select
                  className="champ__saisie"
                  value={collaborateur.contrat}
                  onChange={(evenement) =>
                    modifierCollaborateur(collaborateur.id, {
                      contrat: evenement.target.value as Collaborateur['contrat'],
                    })
                  }
                >
                  {Object.entries(LIBELLES_CONTRAT).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>

              <label className="champ champ--etroit">
                <span className="champ__libelle">Statut</span>
                <select
                  className="champ__saisie"
                  value={collaborateur.statut}
                  onChange={(evenement) =>
                    modifierCollaborateur(collaborateur.id, {
                      statut: evenement.target.value as Collaborateur['statut'],
                    })
                  }
                >
                  {Object.entries(LIBELLES_STATUT).map(([valeur, libelle]) => (
                    <option key={valeur} value={valeur}>
                      {libelle}
                    </option>
                  ))}
                </select>
              </label>

              <ChampNombre
                libelle="Heures / semaine"
                valeur={collaborateur.heuresHebdomadaires}
                onChange={(heures) =>
                  modifierCollaborateur(collaborateur.id, {
                    heuresHebdomadaires: heures,
                    tempsPlein: heures >= 35,
                  })
                }
              />

              <ChampTexte
                libelle="Classification 2216"
                etroit
                valeur={collaborateur.niveauClassification}
                onChange={(niveauClassification) =>
                  modifierCollaborateur(collaborateur.id, { niveauClassification })
                }
              />
            </div>

            <div className="champs">
              <label className="champ champ--etroit">
                <span className="champ__libelle">Rayon principal</span>
                <select
                  className="champ__saisie"
                  value={collaborateur.rayonPrincipal}
                  onChange={(evenement) =>
                    modifierCollaborateur(collaborateur.id, { rayonPrincipal: evenement.target.value })
                  }
                >
                  {rayons.map((rayon) => (
                    <option key={rayon.id} value={rayon.id}>
                      {rayon.nom}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="champ__libelle">Rayons secondaires</p>
            <div className="groupe-boutons">
              {rayons
                .filter((rayon) => rayon.id !== collaborateur.rayonPrincipal)
                .map((rayon) => (
                  <Interrupteur
                    key={rayon.id}
                    libelle={rayon.nom}
                    actif={collaborateur.rayonsSecondaires.includes(rayon.id)}
                    onChange={(actif) =>
                      modifierCollaborateur(collaborateur.id, {
                        rayonsSecondaires: actif
                          ? [...collaborateur.rayonsSecondaires, rayon.id]
                          : collaborateur.rayonsSecondaires.filter((id) => id !== rayon.id),
                      })
                    }
                  />
                ))}
            </div>

            <p className="champ__libelle">Dates clés</p>
            <div className="champs">
              <ChampDate
                libelle="Entrée"
                valeur={collaborateur.dateEntree}
                onChange={(valeur) =>
                  modifierCollaborateur(collaborateur.id, {
                    dateEntree: valeur ?? collaborateur.dateEntree,
                  })
                }
              />
              <ChampDate
                libelle="Fin de période d’essai"
                valeur={collaborateur.finPeriodeEssai}
                onChange={(finPeriodeEssai) =>
                  modifierCollaborateur(collaborateur.id, { finPeriodeEssai })
                }
              />
              <ChampDate
                libelle="Fin de contrat"
                valeur={collaborateur.finContrat}
                onChange={(finContrat) => modifierCollaborateur(collaborateur.id, { finContrat })}
              />
            </div>

            <p className="champ__libelle" id={`age-${collaborateur.id}`}>
              Tranche d’âge
            </p>
            <div className="groupe-boutons" role="group" aria-labelledby={`age-${collaborateur.id}`}>
              {(Object.keys(LIBELLES_TRANCHE_AGE) as TrancheAge[]).map((tranche) => (
                <button
                  key={tranche}
                  type="button"
                  className={
                    collaborateur.trancheAge === tranche ? 'bouton bouton--principal' : 'bouton'
                  }
                  aria-pressed={collaborateur.trancheAge === tranche}
                  onClick={() => modifierCollaborateur(collaborateur.id, { trancheAge: tranche })}
                >
                  {LIBELLES_TRANCHE_AGE[tranche]}
                </button>
              ))}
            </div>
            <p className="champ__aide">
              Seule la tranche est enregistrée, jamais la date de naissance. Elle déclenche les
              protections légales : repos de 12 h, 8 h par jour, et l’arrêt du travail à 22 h —
              à 20 h avant 16 ans. Pensez à la mettre à jour à l’anniversaire.
            </p>

            <PeriodesDeFormation collaborateur={collaborateur} onChanger={modifierCollaborateur} />

            <p className="champ__libelle">Disponibilités déclarées</p>
            <div className="groupe-boutons">
              {JOURS_SEMAINE.map((jour) => {
                const disponibilite = disponibiliteDuJour(collaborateur, jour)
                return (
                  <Interrupteur
                    key={jour}
                    libelle={nomDuJour(jour).slice(0, 3)}
                    actif={disponibilite.disponible}
                    onChange={(disponible) =>
                      modifierCollaborateur(collaborateur.id, {
                        disponibilites: [
                          ...collaborateur.disponibilites.filter((d) => d.jour !== jour),
                          { jour, disponible, plage: disponibilite.plage },
                        ].sort((a, b) => a.jour - b.jour),
                      })
                    }
                  />
                )
              })}
            </div>
            <PlagesDeclarees collaborateur={collaborateur} />

            <p className="champ__libelle">Compétences</p>
            <ul className="liste-competences">
              {competencesProposees(collaborateur).map((competence) => (
                <li key={competence} className="ligne-competence">
                  <span className="ligne-competence__nom">{competence}</span>
                  <span className="groupe-boutons">
                    {NIVEAUX.map((niveau) => (
                      <button
                        key={niveau}
                        type="button"
                        className={
                          (collaborateur.competences[competence] ?? 0) === niveau
                            ? 'bouton bouton--principal bouton--niveau'
                            : 'bouton bouton--niveau'
                        }
                        aria-label={`${competence} : ${LIBELLES_NIVEAU[niveau]}`}
                        onClick={() =>
                          modifierCollaborateur(collaborateur.id, {
                            competences: { ...collaborateur.competences, [competence]: niveau },
                          })
                        }
                      >
                        {niveau}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="champ__aide">
              0 ne fait pas · 1 avec aide · 2 autonome · 3 sait former les autres
            </p>

            {collaborateur.habilitations.length > 0 && (
              <>
                <p className="champ__libelle">Habilitations</p>
                <ul className="liste-simple">
                  {collaborateur.habilitations.map((habilitation) => (
                    <li key={habilitation.id}>
                      {habilitation.nom} —{' '}
                      {habilitation.expire === null
                        ? 'sans expiration'
                        : `expire le ${dateEnTexte(habilitation.expire)}`}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p className="champ__libelle">Équité</p>
            <dl className="liste-faits">
              <dt>Samedis travaillés</dt>
              <dd>{collaborateur.compteursEquite.samedisTravailles}</dd>
              <dt>Dimanches travaillés</dt>
              <dd>{collaborateur.compteursEquite.dimanchesTravailles}</dd>
              <dt>Fermetures</dt>
              <dd>{collaborateur.compteursEquite.fermetures}</dd>
              <dt>Jours fériés travaillés</dt>
              <dd>{collaborateur.compteursEquite.feriesTravailles}</dd>
            </dl>

            <p className="champ__libelle">Remplacements</p>
            <Interrupteur
              libelle={
                collaborateur.contactAutorise
                  ? 'Accepte d’être contacté'
                  : 'N’a pas donné son accord'
              }
              actif={collaborateur.contactAutorise}
              onChange={(contactAutorise) =>
                modifierCollaborateur(collaborateur.id, { contactAutorise })
              }
            />

            <p className="champ__libelle">Présence dans l’effectif</p>
            <button
              type="button"
              className="bouton bouton--discret"
              onClick={() => modifierCollaborateur(collaborateur.id, { actif: false })}
            >
              Retirer de l’effectif
            </button>
          </Depliant>
        ))}

        <button type="button" className="bouton" onClick={() => setFenetreOuverte(true)}>
          Ajouter un collaborateur
        </button>
      </section>

      {fenetreOuverte && (
        <NouveauCollaborateur
          rayons={rayons}
          rayonParDefaut={filtre === 'tous' ? (rayons[0]?.id ?? '') : filtre}
          onEnregistrer={enregistrerNouveau}
          onFermer={() => setFenetreOuverte(false)}
        />
      )}

      <SectionSuiviIndividuel />
      <SectionVivier />
      <SectionRecrutement />
      <SectionIntegration />
      <SectionSecurite />
    </>
  )
}

/**
 * Competences a proposer sur une fiche : celles qui servent dans son rayon
 * principal ou dans ses rayons d'appui, plus celles qu'il possede deja — une
 * competence notee ne doit jamais disparaitre parce qu'on a change de rayon.
 */
function competencesDeLaFiche(
  catalogue: readonly Competence[],
  collaborateur: Collaborateur,
): string[] {
  const rayons = [collaborateur.rayonPrincipal, ...collaborateur.rayonsSecondaires]
  const retenues = new Set<string>(Object.keys(collaborateur.competences))
  for (const rayon of rayons) {
    for (const competence of competencesDuRayon(catalogue, rayon)) retenues.add(competence.nom)
  }
  return [...retenues].sort((a, b) => a.localeCompare(b, 'fr'))
}

/**
 * Periodes de formation en centre, pour les apprentis.
 *
 * Le temps de formation est du temps de travail : l'application refuse de
 * poser une vacation pendant ces periodes.
 */
function PeriodesDeFormation({
  collaborateur,
  onChanger,
}: {
  readonly collaborateur: Collaborateur
  readonly onChanger: (identifiant: string, changement: Partial<Collaborateur>) => void
}) {
  const periodes = collaborateur.periodesFormation

  function ajouter(): void {
    const debut = aujourdhui()
    onChanger(collaborateur.id, {
      periodesFormation: [
        ...periodes,
        { id: `f-${Date.now()}`, debut, fin: ajouterJours(debut, 4), intitule: 'CFA' },
      ],
    })
  }

  function changer(identifiant: string, changement: Partial<PeriodeFormation>): void {
    onChanger(collaborateur.id, {
      periodesFormation: periodes.map((periode) =>
        periode.id === identifiant ? { ...periode, ...changement } : periode,
      ),
    })
  }

  function retirer(identifiant: string): void {
    onChanger(collaborateur.id, {
      periodesFormation: periodes.filter((periode) => periode.id !== identifiant),
    })
  }

  return (
    <>
      <p className="champ__libelle">Formation en centre (CFA)</p>
      {periodes.length === 0 ? (
        <p className="champ__aide">
          Aucune période enregistrée. Pour un apprenti, ajoutez ses semaines de cours : le
          planning ne pourra plus lui donner de vacation pendant ces jours-là.
        </p>
      ) : (
        <ul className="liste-simple">
          {periodes.map((periode) => (
            <li key={periode.id} className="champs">
              <ChampTexte
                libelle="Intitulé"
                valeur={periode.intitule}
                etroit
                onChange={(intitule) => changer(periode.id, { intitule })}
              />
              <ChampDate
                libelle="Du"
                valeur={periode.debut}
                onChange={(debut) => changer(periode.id, { debut: debut ?? periode.debut })}
              />
              <ChampDate
                libelle="Au"
                valeur={periode.fin}
                onChange={(fin) => changer(periode.id, { fin: fin ?? periode.fin })}
              />
              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => retirer(periode.id)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="bouton" onClick={ajouter}>
        Ajouter une période de formation
      </button>
    </>
  )
}

function ChampDate({
  libelle,
  valeur,
  onChange,
}: {
  readonly libelle: string
  readonly valeur: string | null
  readonly onChange: (valeur: string | null) => void
}) {
  return (
    <label className="champ champ--etroit">
      <span className="champ__libelle">{libelle}</span>
      <input
        type="date"
        className="champ__saisie"
        value={valeur ?? ''}
        onChange={(evenement) => onChange(evenement.target.value === '' ? null : evenement.target.value)}
      />
    </label>
  )
}

function PlagesDeclarees({ collaborateur }: { readonly collaborateur: Collaborateur }) {
  const restreintes = JOURS_SEMAINE.map((jour) => ({
    jour,
    disponibilite: disponibiliteDuJour(collaborateur, jour),
  })).filter(({ disponibilite }) => disponibilite.disponible && disponibilite.plage !== null)

  if (restreintes.length === 0) return null

  return (
    <p className="champ__aide">
      Plages restreintes :{' '}
      {restreintes
        .map(
          ({ jour, disponibilite }) =>
            `${nomDuJour(jour)} ${disponibilite.plage?.debut}–${disponibilite.plage?.fin}`,
        )
        .join(', ')}
      .
    </p>
  )
}

