import { useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../../domaine/calendrier'
import { nomAffiche } from '../../../domaine/collaborateur'
import {
  LIBELLES_ENTRETIEN,
  LIBELLES_SECURITE,
  PARCOURS_INTEGRATION,
  besoinRecrutementVide,
  type TypeActionSecurite,
  type TypeEntretien,
} from '../../../domaine/faits'
import { rayonsActifs } from '../../../domaine/magasin'
import { changerEtatSuivi, LIBELLES_ETAT, type EtatSuivi } from '../../../domaine/suivi'
import { alertesDEntretien, alertesDeSecurite } from '../../../moteurs/alertes'
import { useDonnees } from '../../DonneesProvider'
import { ChampNombre, ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'
import { SuiviPlanning } from '../../composants/SuiviPlanning'

const TYPES_ENTRETIEN: readonly TypeEntretien[] = ['annuel', 'professionnel', 'bilan-6-ans']
const TYPES_SECURITE: readonly TypeActionSecurite[] = [
  'prevention',
  'equipement',
  'accident',
  'affichage',
  'visite-medicale',
]

// ------------------------------------------------------- Recrutement

export function SectionRecrutement() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const [ouvert, setOuvert] = useState<string | null>(null)

  function ajouter(): void {
    const besoin = besoinRecrutementVide(`br-${Date.now()}`, rayons[0]?.id ?? '', aujourdhui())
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      besoinsRecrutement: [...precedent.besoinsRecrutement, besoin],
    }))
    setOuvert(besoin.id)
  }

  function modifierBesoin(identifiant: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      besoinsRecrutement: precedent.besoinsRecrutement.map((besoin) =>
        besoin.id === identifiant ? { ...besoin, ...changement } : besoin,
      ),
    }))
  }

  function changerLeSuivi(
    identifiant: string,
    nouvelEtat: EtatSuivi,
    date: string,
    remarques: string,
  ): void {
    modifier((precedent) => ({
      ...precedent,
      besoinsRecrutement: precedent.besoinsRecrutement.map((besoin) =>
        besoin.id === identifiant
          ? { ...besoin, ...changerEtatSuivi(besoin, nouvelEtat, date, remarques) }
          : besoin,
      ),
    }))
  }

  const choisi = etat.besoinsRecrutement.find((besoin) => besoin.id === ouvert)

  return (
    <>
      <section className="carte">
        <h2>Besoins de recrutement</h2>
        <p>
          Les demandes suivent le même circuit que les plannings : vous préparez, votre patron
          valide hors application.
        </p>

        {etat.besoinsRecrutement.length === 0 ? (
          <p>Aucun besoin de recrutement enregistré.</p>
        ) : (
          <ul className="liste-simple">
            {etat.besoinsRecrutement.map((besoin) => (
              <li key={besoin.id} className="ligne-saisie">
                <span>
                  <strong>{besoin.poste}</strong> —{' '}
                  {rayons.find((rayon) => rayon.id === besoin.rayonId)?.nom ?? besoin.rayonId}
                  <br />
                  <span className={`etat etat--${besoin.etat}`}>{LIBELLES_ETAT[besoin.etat]}</span>{' '}
                  <span className="champ__aide">
                    souhaité pour le {dateEnTexte(besoin.dateSouhaitee)}
                  </span>
                </span>
                <button
                  type="button"
                  className="bouton"
                  onClick={() => setOuvert(ouvert === besoin.id ? null : besoin.id)}
                >
                  {ouvert === besoin.id ? 'Fermer' : 'Ouvrir'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="bouton" onClick={ajouter}>
          Ajouter un besoin de recrutement
        </button>
      </section>

      {choisi !== undefined && (
        <>
          <section className="carte">
            <h2>{choisi.poste}</h2>
            <div className="champs">
              <ChampTexte
                libelle="Poste"
                valeur={choisi.poste}
                onChange={(poste) => modifierBesoin(choisi.id, { poste })}
              />
              <label className="champ champ--etroit">
                <span className="champ__libelle">Rayon</span>
                <select
                  className="champ__saisie"
                  value={choisi.rayonId}
                  onChange={(e) => modifierBesoin(choisi.id, { rayonId: e.target.value })}
                >
                  {rayons.map((rayon) => (
                    <option key={rayon.id} value={rayon.id}>
                      {rayon.nom}
                    </option>
                  ))}
                </select>
              </label>
              <ChampTexte
                libelle="Contrat"
                etroit
                valeur={choisi.contrat}
                onChange={(contrat) => modifierBesoin(choisi.id, { contrat })}
              />
              <ChampNombre
                libelle="Heures / semaine"
                valeur={choisi.heuresHebdomadaires}
                onChange={(heuresHebdomadaires) =>
                  modifierBesoin(choisi.id, { heuresHebdomadaires })
                }
              />
              <label className="champ champ--etroit">
                <span className="champ__libelle">Souhaité pour</span>
                <input
                  type="date"
                  className="champ__saisie"
                  value={choisi.dateSouhaitee}
                  onChange={(e) => modifierBesoin(choisi.id, { dateSouhaitee: e.target.value })}
                />
              </label>
            </div>
            <ChampTexte
              libelle="Motif"
              valeur={choisi.motif}
              onChange={(motif) => modifierBesoin(choisi.id, { motif })}
              placeholder="Remplacement d’un départ, renfort de saison…"
            />
          </section>

          <SuiviPlanning
            planning={choisi}
            titre="Suivi de la demande"
            onChanger={(nouvelEtat, date, remarques) =>
              changerLeSuivi(choisi.id, nouvelEtat, date, remarques)
            }
          />
        </>
      )}
    </>
  )
}

// ------------------------------------------------------- Intégration

export function SectionIntegration() {
  const { etat, modifier } = useDonnees()
  const [collaborateurId, setCollaborateurId] = useState('')

  const equipe = etat.collaborateurs.filter((collaborateur) => collaborateur.actif)

  function lancerLeParcours(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      etapesIntegration: [
        ...precedent.etapesIntegration.filter(
          (etape) => etape.collaborateurId !== identifiant,
        ),
        ...PARCOURS_INTEGRATION.map((intitule, index) => ({
          id: `int-${identifiant}-${index}`,
          collaborateurId: identifiant,
          intitule,
          faite: false,
          date: null,
        })),
      ],
    }))
  }

  function basculer(identifiant: string, faite: boolean): void {
    modifier((precedent) => ({
      ...precedent,
      etapesIntegration: precedent.etapesIntegration.map((etape) =>
        etape.id === identifiant ? { ...etape, faite, date: faite ? aujourdhui() : null } : etape,
      ),
    }))
  }

  const parPersonne = [
    ...new Set(etat.etapesIntegration.map((etape) => etape.collaborateurId)),
  ].sort()

  return (
    <section className="carte">
      <h2>Parcours d’intégration</h2>
      <p>Une check-list pour qu’aucune étape d’accueil ne soit oubliée.</p>

      <div className="champs">
        <label className="champ">
          <span className="champ__libelle">Démarrer un parcours</span>
          <select
            className="champ__saisie"
            value={collaborateurId}
            onChange={(evenement) => setCollaborateurId(evenement.target.value)}
          >
            <option value="">Choisir une personne…</option>
            {equipe.map((collaborateur) => (
              <option key={collaborateur.id} value={collaborateur.id}>
                {nomAffiche(collaborateur)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className="bouton"
        disabled={collaborateurId === ''}
        onClick={() => lancerLeParcours(collaborateurId)}
      >
        Démarrer le parcours
      </button>

      {parPersonne.map((identifiant) => {
        const collaborateur = equipe.find((candidat) => candidat.id === identifiant)
        const etapes = etat.etapesIntegration.filter((etape) => etape.collaborateurId === identifiant)
        const faites = etapes.filter((etape) => etape.faite).length

        return (
          <Depliant
            key={identifiant}
            titre={collaborateur === undefined ? identifiant : nomAffiche(collaborateur)}
            resume={`${faites} étape${faites > 1 ? 's' : ''} sur ${etapes.length}`}
          >
            <ul className="liste-simple">
              {etapes.map((etape) => (
                <li key={etape.id} className="ligne-saisie">
                  <span>
                    {etape.intitule}
                    {etape.date !== null && (
                      <span className="champ__aide"> — fait le {dateEnTexte(etape.date)}</span>
                    )}
                  </span>
                  <Interrupteur
                    libelle={etape.faite ? 'Fait' : 'À faire'}
                    actif={etape.faite}
                    onChange={(faite) => basculer(etape.id, faite)}
                  />
                </li>
              ))}
            </ul>
          </Depliant>
        )
      })}
    </section>
  )
}

// --------------------------------------------------- Suivi individuel

export function SectionSuiviIndividuel() {
  const { etat, modifier } = useDonnees()
  const equipe = etat.collaborateurs.filter((collaborateur) => collaborateur.actif)
  const alertes = alertesDEntretien(equipe, etat.entretiens, aujourdhui(), etat.reglagesAlertes)

  function ajouterUnEntretien(collaborateurId: string, type: TypeEntretien): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      entretiens: [
        ...precedent.entretiens,
        {
          id: `e-${Date.now()}`,
          collaborateurId,
          type,
          date: aujourdhui(),
          realise: false,
          objectifs: '',
        },
      ],
    }))
  }

  function modifierEntretien(identifiant: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      entretiens: precedent.entretiens.map((entretien) =>
        entretien.id === identifiant ? { ...entretien, ...changement } : entretien,
      ),
    }))
  }

  return (
    <>
      <section className="carte">
        <h2>Entretiens à tenir</h2>
        <p className="avis">
          <strong>Des faits et des objectifs de travail uniquement.</strong> Jamais d’appréciation
          sur la personne. L’entretien professionnel est obligatoire tous les deux ans, avec un
          bilan à six ans.
        </p>

        {alertes.length === 0 ? (
          <p>Aucun entretien obligatoire à venir dans les deux prochains mois.</p>
        ) : (
          <ul className="liste-alertes">
            {alertes.map((alerte) => (
              <li
                key={alerte.id}
                className={alerte.gravite === 'urgent' ? 'alerte alerte--urgent' : 'alerte alerte--attention'}
              >
                <p className="alerte__titre">{alerte.titre}</p>
                <p className="alerte__detail">{alerte.detail}</p>
                {alerte.collaborateurId !== null && (
                  <p>
                    <button
                      type="button"
                      className="bouton bouton--discret"
                      onClick={() =>
                        ajouterUnEntretien(
                          alerte.collaborateurId as string,
                          alerte.id.includes('bilan') ? 'bilan-6-ans' : 'professionnel',
                        )
                      }
                    >
                      Programmer cet entretien
                    </button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte">
        <h2>Entretiens enregistrés</h2>
        {etat.entretiens.length === 0 ? (
          <p>Aucun entretien enregistré.</p>
        ) : (
          [...etat.entretiens]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((entretien) => {
              const collaborateur = equipe.find(
                (candidat) => candidat.id === entretien.collaborateurId,
              )
              return (
                <Depliant
                  key={entretien.id}
                  titre={`${collaborateur === undefined ? entretien.collaborateurId : nomAffiche(collaborateur)} — ${LIBELLES_ENTRETIEN[entretien.type]}`}
                  resume={`${dateEnTexte(entretien.date)}${entretien.realise ? ' · réalisé' : ' · prévu'}`}
                >
                  <div className="champs">
                    <label className="champ champ--etroit">
                      <span className="champ__libelle">Date</span>
                      <input
                        type="date"
                        className="champ__saisie"
                        value={entretien.date}
                        onChange={(e) => modifierEntretien(entretien.id, { date: e.target.value })}
                      />
                    </label>
                    <label className="champ champ--etroit">
                      <span className="champ__libelle">Type</span>
                      <select
                        className="champ__saisie"
                        value={entretien.type}
                        onChange={(e) =>
                          modifierEntretien(entretien.id, { type: e.target.value as TypeEntretien })
                        }
                      >
                        {TYPES_ENTRETIEN.map((valeur) => (
                          <option key={valeur} value={valeur}>
                            {LIBELLES_ENTRETIEN[valeur]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="champ">
                    <span className="champ__libelle">Objectifs de travail convenus</span>
                    <textarea
                      className="champ__saisie champ__saisie--texte"
                      rows={3}
                      value={entretien.objectifs}
                      placeholder="Objectifs, formations souhaitées, souhaits d’évolution…"
                      onChange={(e) =>
                        modifierEntretien(entretien.id, { objectifs: e.target.value })
                      }
                    />
                    <span className="champ__aide">
                      Des objectifs, pas une appréciation. Rien sur la personne, tout sur le travail.
                    </span>
                  </label>

                  <Interrupteur
                    libelle={entretien.realise ? 'Réalisé' : 'Prévu'}
                    actif={entretien.realise}
                    onChange={(realise) => modifierEntretien(entretien.id, { realise })}
                  />
                </Depliant>
              )
            })
        )}
      </section>
    </>
  )
}

// ------------------------------------------------------------ Sécurité

export function SectionSecurite() {
  const { etat, modifier } = useDonnees()
  const equipe = etat.collaborateurs.filter((collaborateur) => collaborateur.actif)
  const alertes = alertesDeSecurite(
    etat.actionsSecurite,
    etat.collaborateurs,
    aujourdhui(),
    etat.reglagesAlertes,
  )

  const [titre, setTitre] = useState('')
  const [type, setType] = useState<TypeActionSecurite>('prevention')
  const [collaborateurId, setCollaborateurId] = useState('')

  function ajouter(): void {
    if (titre.trim() === '') return
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      actionsSecurite: [
        ...precedent.actionsSecurite,
        {
          id: `s-${Date.now()}`,
          type,
          titre: titre.trim(),
          date: aujourdhui(),
          collaborateurId: collaborateurId === '' ? null : collaborateurId,
          echeance: null,
          faite: false,
        },
      ],
    }))
    setTitre('')
  }

  function modifierAction(identifiant: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      actionsSecurite: precedent.actionsSecurite.map((action) =>
        action.id === identifiant ? { ...action, ...changement } : action,
      ),
    }))
  }

  return (
    <>
      {alertes.length > 0 && (
        <section className="carte">
          <h2>Échéances de sécurité</h2>
          <ul className="liste-alertes">
            {alertes.map((alerte) => (
              <li key={alerte.id} className="alerte alerte--urgent">
                <p className="alerte__titre">{alerte.titre}</p>
                <p className="alerte__detail">{alerte.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="carte">
        <h2>Sécurité et conformité</h2>
        <p className="avis">
          Actions de prévention, équipements, accidents du travail, affichages, dates de visite
          médicale. <strong>Les dates seulement</strong> : jamais le contenu d’une visite médicale.
        </p>

        <div className="champs">
          <ChampTexte libelle="Intitulé" valeur={titre} onChange={setTitre} />
          <label className="champ champ--etroit">
            <span className="champ__libelle">Type</span>
            <select
              className="champ__saisie"
              value={type}
              onChange={(e) => setType(e.target.value as TypeActionSecurite)}
            >
              {TYPES_SECURITE.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {LIBELLES_SECURITE[valeur]}
                </option>
              ))}
            </select>
          </label>
          <label className="champ champ--etroit">
            <span className="champ__libelle">Personne</span>
            <select
              className="champ__saisie"
              value={collaborateurId}
              onChange={(e) => setCollaborateurId(e.target.value)}
            >
              <option value="">Tout le service</option>
              {equipe.map((collaborateur) => (
                <option key={collaborateur.id} value={collaborateur.id}>
                  {nomAffiche(collaborateur)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="bouton"
          disabled={titre.trim() === ''}
          onClick={ajouter}
        >
          Enregistrer
        </button>

        {etat.actionsSecurite.length > 0 && (
          <ul className="liste-simple">
            {[...etat.actionsSecurite]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((action) => (
                <li key={action.id} className="ligne-saisie">
                  <span>
                    <strong>{action.titre}</strong>{' '}
                    <span className="champ__aide">
                      {LIBELLES_SECURITE[action.type]} · {dateEnTexte(action.date)}
                      {action.collaborateurId !== null &&
                        ` · ${nomAffiche(equipe.find((c) => c.id === action.collaborateurId) ?? equipe[0]!)}`}
                    </span>
                  </span>
                  <Interrupteur
                    libelle={action.faite ? 'Traitée' : 'À traiter'}
                    actif={action.faite}
                    onChange={(faite) => modifierAction(action.id, { faite })}
                  />
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  )
}
