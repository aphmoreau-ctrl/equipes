import { useState } from 'react'
import { JOURS_SEMAINE, aujourdhui, dateEnTexte, nomDuJour } from '../../../domaine/calendrier'
import { LIBELLES_NIVEAU, type NiveauCompetence } from '../../../domaine/collaborateur'
import { rayonsActifs } from '../../../domaine/magasin'
import {
  LIBELLES_MOTIF_MISSION,
  LIBELLES_ORIGINE,
  nomRenfort,
  renfortVide,
  type MotifMission,
  type OrigineRenfort,
  type Renfort,
} from '../../../domaine/vivier'
import { competencesConnues } from '../../../moteurs/competences'
import { bilanDesMissions, heuresTravaillees } from '../../../moteurs/vivier'
import { useDonnees } from '../../DonneesProvider'
import { ChampHeure, ChampNombre, ChampTexte, Interrupteur } from '../../composants/Champ'
import { eurosEnTexte, nombreEnTexte } from '../../../domaine/nombres'

const ORIGINES: readonly OrigineRenfort[] = ['interim', 'etudiant', 'ancien', 'autre']
const MOTIFS: readonly MotifMission[] = ['remplacement', 'renfort', 'saison']
const NIVEAUX: readonly NiveauCompetence[] = [0, 1, 2, 3]

export function euros(valeur: number): string {
  return eurosEnTexte(valeur)
}

function heuresEnTexte(valeur: number): string {
  return `${nombreEnTexte(valeur, 1)} h`
}

/**
 * Vivier de remplacants exterieurs (module 8) : interimaires, etudiants,
 * anciens salaries. Ils sont proposes sur l'ecran du jour quand personne de
 * l'equipe ne peut couvrir une absence.
 */
export function SectionVivier() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const [ouvert, setOuvert] = useState<string | null>(null)
  const date = aujourdhui()
  const debutMois = `${date.slice(0, 7)}-01`
  const bilan = bilanDesMissions(etat.missions, etat.renforts, debutMois, date)
  const competences = competencesConnues(
    etat.collaborateurs,
    etat.renforts.flatMap((renfort) => Object.keys(renfort.competences)),
  )

  function nomRayon(id: string): string {
    return rayons.find((rayon) => rayon.id === id)?.nom ?? id
  }

  function ajouter(): void {
    const renfort = renfortVide(`r-${Date.now()}`, rayons[0]?.id ?? '')
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      renforts: [...precedent.renforts, renfort],
    }))
    setOuvert(renfort.id)
  }

  function modifierRenfort(identifiant: string, changement: Partial<Renfort>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      renforts: precedent.renforts.map((renfort) =>
        renfort.id === identifiant ? { ...renfort, ...changement } : renfort,
      ),
    }))
  }

  const choisi = etat.renforts.find((renfort) => renfort.id === ouvert)

  return (
    <>
      <section className="carte">
        <h2>Vivier de remplaçants extérieurs</h2>
        <p>
          Intérimaires, étudiants, anciens salariés : les personnes à rappeler quand l’équipe ne
          suffit pas. Ils sont proposés sur l’écran du jour, après les collaborateurs internes.
        </p>
        <p className="avis">
          Prénom et initiale seulement. Pas de téléphone ni d’adresse ici : le contact passe par
          l’agence ou par vos propres moyens.
        </p>

        <dl className="liste-faits">
          <dt>Ce mois-ci</dt>
          <dd>
            {bilan.lignes.length === 0
              ? 'aucune mission'
              : `${heuresEnTexte(bilan.heures)} pour ${euros(bilan.cout)}`}
          </dd>
        </dl>

        {etat.renforts.length === 0 ? (
          <p>Personne dans le vivier pour l’instant.</p>
        ) : (
          <ul className="liste-simple">
            {etat.renforts.map((renfort) => (
              <li key={renfort.id} className="ligne-saisie">
                <span>
                  <strong>{renfort.prenom === '' ? 'Nouvelle personne' : nomRenfort(renfort)}</strong>{' '}
                  <span className="etiquette">{LIBELLES_ORIGINE[renfort.origine]}</span>
                  {!renfort.actif && <span className="champ__aide"> · inactif</span>}
                  <br />
                  <span className="champ__aide">
                    {renfort.rayons.map(nomRayon).join(', ')} · {euros(renfort.coutHoraire)} de
                    l’heure
                  </span>
                </span>
                <button
                  type="button"
                  className="bouton"
                  onClick={() => setOuvert(ouvert === renfort.id ? null : renfort.id)}
                >
                  {ouvert === renfort.id ? 'Fermer' : 'Ouvrir'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="bouton" onClick={ajouter}>
          Ajouter une personne au vivier
        </button>
      </section>

      {choisi !== undefined && (
        <section className="carte">
          <h2>{choisi.prenom === '' ? 'Nouvelle personne' : nomRenfort(choisi)}</h2>
          <div className="champs">
            <ChampTexte
              libelle="Prénom"
              valeur={choisi.prenom}
              onChange={(prenom) => modifierRenfort(choisi.id, { prenom })}
            />
            <ChampTexte
              libelle="Initiale du nom"
              etroit
              valeur={choisi.initiale}
              aide="Une lettre suivie d’un point : jamais le nom entier."
              onChange={(saisie) => {
                const lettre = saisie.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 1).toUpperCase()
                modifierRenfort(choisi.id, { initiale: lettre === '' ? '' : `${lettre}.` })
              }}
            />
            <label className="champ champ--etroit">
              <span className="champ__libelle">Origine</span>
              <select
                className="champ__saisie"
                value={choisi.origine}
                onChange={(e) =>
                  modifierRenfort(choisi.id, { origine: e.target.value as OrigineRenfort })
                }
              >
                {ORIGINES.map((origine) => (
                  <option key={origine} value={origine}>
                    {LIBELLES_ORIGINE[origine]}
                  </option>
                ))}
              </select>
            </label>
            <ChampTexte
              libelle="Agence"
              valeur={choisi.agence}
              placeholder="Pour un intérimaire"
              onChange={(agence) => modifierRenfort(choisi.id, { agence })}
            />
            <ChampNombre
              libelle="Coût horaire"
              suffixe="€"
              pas={0.1}
              valeur={choisi.coutHoraire}
              onChange={(coutHoraire) => modifierRenfort(choisi.id, { coutHoraire })}
            />
          </div>

          <p className="champ__libelle">Rayons possibles</p>
          <div className="groupe-boutons">
            {rayons.map((rayon) => (
              <Interrupteur
                key={rayon.id}
                libelle={rayon.nom}
                actif={choisi.rayons.includes(rayon.id)}
                onChange={(actif) =>
                  modifierRenfort(choisi.id, {
                    rayons: actif
                      ? [...choisi.rayons, rayon.id]
                      : choisi.rayons.filter((identifiant) => identifiant !== rayon.id),
                  })
                }
              />
            ))}
          </div>

          <p className="champ__libelle">Jours habituellement possibles</p>
          <div className="groupe-boutons">
            {JOURS_SEMAINE.map((jour) => (
              <Interrupteur
                key={jour}
                libelle={nomDuJour(jour).slice(0, 3)}
                actif={choisi.joursPossibles.includes(jour)}
                onChange={(actif) =>
                  modifierRenfort(choisi.id, {
                    joursPossibles: actif
                      ? [...choisi.joursPossibles, jour].sort((a, b) => a - b)
                      : choisi.joursPossibles.filter((autre) => autre !== jour),
                  })
                }
              />
            ))}
          </div>

          <p className="champ__libelle">Compétences</p>
          <ul className="liste-competences">
            {competences.map((competence) => (
              <li key={competence} className="ligne-competence">
                <span className="ligne-competence__nom">{competence}</span>
                <span className="groupe-boutons">
                  {NIVEAUX.map((niveau) => (
                    <button
                      key={niveau}
                      type="button"
                      className={
                        (choisi.competences[competence] ?? 0) === niveau
                          ? 'bouton bouton--principal bouton--niveau'
                          : 'bouton bouton--niveau'
                      }
                      aria-label={`${competence} : ${LIBELLES_NIVEAU[niveau]}`}
                      onClick={() =>
                        modifierRenfort(choisi.id, {
                          competences: { ...choisi.competences, [competence]: niveau },
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

          <div className="groupe-boutons">
            <Interrupteur
              libelle="Accepte d’être recontacté"
              actif={choisi.contactAutorise}
              onChange={(contactAutorise) => modifierRenfort(choisi.id, { contactAutorise })}
            />
            <Interrupteur
              libelle="Actif dans le vivier"
              actif={choisi.actif}
              onChange={(actif) => modifierRenfort(choisi.id, { actif })}
            />
          </div>
        </section>
      )}

      <HistoriqueMissions />
    </>
  )
}

function HistoriqueMissions() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const actifs = etat.renforts.filter((renfort) => renfort.actif)
  const [renfortId, setRenfortId] = useState('')
  const [date, setDate] = useState(aujourdhui())
  const [rayonId, setRayonId] = useState('')
  const [debut, setDebut] = useState('06:00')
  const [fin, setFin] = useState('13:00')
  const [pause, setPause] = useState(20)
  const [motif, setMotif] = useState<MotifMission>('remplacement')

  const renfortChoisi = renfortId === '' ? actifs[0]?.id ?? '' : renfortId
  const rayonChoisi =
    rayonId === ''
      ? etat.renforts.find((renfort) => renfort.id === renfortChoisi)?.rayons[0] ?? rayons[0]?.id ?? ''
      : rayonId

  const recentes = [...etat.missions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)

  function nomDe(identifiant: string): string {
    const renfort = etat.renforts.find((candidat) => candidat.id === identifiant)
    return renfort === undefined ? '—' : nomRenfort(renfort)
  }

  function enregistrer(): void {
    if (renfortChoisi === '' || rayonChoisi === '') return
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      missions: [
        ...precedent.missions,
        {
          id: `m-${Date.now()}`,
          renfortId: renfortChoisi,
          date,
          rayonId: rayonChoisi,
          debut,
          fin,
          pauseMinutes: pause,
          motif,
          vacationCouverte: null,
        },
      ],
    }))
  }

  function supprimer(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      missions: precedent.missions.filter((mission) => mission.id !== identifiant),
    }))
  }

  return (
    <section className="carte">
      <h2>Missions des renforts extérieurs</h2>
      {actifs.length === 0 ? (
        <p>Ajoutez d’abord une personne au vivier.</p>
      ) : (
        <>
          <div className="champs">
            <label className="champ champ--etroit">
              <span className="champ__libelle">Personne</span>
              <select
                className="champ__saisie"
                value={renfortChoisi}
                onChange={(e) => setRenfortId(e.target.value)}
              >
                {actifs.map((renfort) => (
                  <option key={renfort.id} value={renfort.id}>
                    {nomRenfort(renfort)}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ champ--etroit">
              <span className="champ__libelle">Date de la mission</span>
              <input
                type="date"
                className="champ__saisie"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="champ champ--etroit">
              <span className="champ__libelle">Rayon de la mission</span>
              <select
                className="champ__saisie"
                value={rayonChoisi}
                onChange={(e) => setRayonId(e.target.value)}
              >
                {rayons.map((rayon) => (
                  <option key={rayon.id} value={rayon.id}>
                    {rayon.nom}
                  </option>
                ))}
              </select>
            </label>
            <ChampHeure libelle="Début" valeur={debut} onChange={setDebut} />
            <ChampHeure libelle="Fin" valeur={fin} onChange={setFin} />
            <ChampNombre libelle="Pause" suffixe="min" pas={5} valeur={pause} onChange={setPause} />
            <label className="champ champ--etroit">
              <span className="champ__libelle">Motif</span>
              <select
                className="champ__saisie"
                value={motif}
                onChange={(e) => setMotif(e.target.value as MotifMission)}
              >
                {MOTIFS.map((valeur) => (
                  <option key={valeur} value={valeur}>
                    {LIBELLES_MOTIF_MISSION[valeur]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="bouton bouton--principal" onClick={enregistrer}>
            Enregistrer la mission
          </button>
        </>
      )}

      {recentes.length > 0 && (
        <ul className="liste-simple">
          {recentes.map((mission) => (
            <li key={mission.id} className="ligne-saisie">
              <span>
                <strong>{nomDe(mission.renfortId)}</strong> — {dateEnTexte(mission.date)},{' '}
                {mission.debut}–{mission.fin}
                <br />
                <span className="champ__aide">
                  {rayons.find((rayon) => rayon.id === mission.rayonId)?.nom ?? mission.rayonId} ·{' '}
                  {LIBELLES_MOTIF_MISSION[mission.motif]} · {heuresEnTexte(heuresTravaillees(mission))}
                </span>
              </span>
              <button type="button" className="bouton" onClick={() => supprimer(mission.id)}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
