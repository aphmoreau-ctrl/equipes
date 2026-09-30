import { useMemo, useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import { LIBELLES_NIVEAU, nomAffiche, type NiveauCompetence } from '../../domaine/collaborateur'
import { LIBELLES_FORMATION, type EtatFormation } from '../../domaine/formation'
import { joursEntre } from '../../moteurs/alertes'
import {
  besoinsDeFormation,
  competencesConnues,
  couvertureDesCompetences,
  grilleDePolyvalence,
} from '../../moteurs/competences'
import { useDonnees } from '../DonneesProvider'
import { ChampTexte, Depliant } from '../composants/Champ'

export function Competences() {
  const { etat, modifier } = useDonnees()
  const [nouvelle, setNouvelle] = useState('')

  const equipe = etat.collaborateurs.filter((collaborateur) => collaborateur.actif)
  const competences = useMemo(() => competencesConnues(equipe), [equipe])

  const grille = grilleDePolyvalence(equipe, competences)
  const couverture = couvertureDesCompetences(equipe, competences, etat.formations)
  const besoins = besoinsDeFormation(equipe, competences, etat.formations)

  const habilitations = equipe
    .flatMap((collaborateur) =>
      collaborateur.habilitations.map((habilitation) => ({ collaborateur, habilitation })),
    )
    .sort((a, b) =>
      (a.habilitation.expire ?? '9999').localeCompare(b.habilitation.expire ?? '9999'),
    )

  function modifierNiveau(
    collaborateurId: string,
    competence: string,
    niveau: NiveauCompetence,
  ): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      collaborateurs: precedent.collaborateurs.map((collaborateur) =>
        collaborateur.id === collaborateurId
          ? { ...collaborateur, competences: { ...collaborateur.competences, [competence]: niveau } }
          : collaborateur,
      ),
    }))
  }

  function planifierUneFormation(collaborateurId: string, competence: string): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      formations: [
        ...precedent.formations,
        {
          id: `f-${Date.now()}`,
          collaborateurId,
          intitule: `Formation « ${competence} »`,
          debut: aujourdhui(),
          fin: aujourdhui(),
          competenceVisee: competence,
          niveauVise: 2,
          etat: 'prevue',
          habilitationDelivree: null,
        },
      ],
    }))
  }

  function modifierFormation(identifiant: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      formations: precedent.formations.map((formation) =>
        formation.id === identifiant ? { ...formation, ...changement } : formation,
      ),
    }))
  }

  function retirerFormation(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      formations: precedent.formations.filter((formation) => formation.id !== identifiant),
    }))
  }

  function ajouterUneCompetence(): void {
    const nom = nouvelle.trim()
    if (nom === '' || competences.includes(nom)) return
    const premier = equipe[0]
    if (premier === undefined) return
    modifierNiveau(premier.id, nom, 0)
    setNouvelle('')
  }

  return (
    <>
      <header className="entete">
        <h1>Compétences</h1>
        <p>Grille de polyvalence, plan de formation, habilitations et leurs échéances.</p>
      </header>

      <section className="carte">
        <h2>Postes fragiles</h2>
        <p>Une compétence tenue par une seule personne met le rayon à la merci d’une absence.</p>

        {besoins.length === 0 ? (
          <p className="avis">
            Chaque compétence est tenue par au moins deux personnes. Rien à signaler.
          </p>
        ) : (
          <ul className="liste-alertes">
            {besoins.map((besoin) => (
              <li
                key={besoin.competence}
                className={besoin.manque >= 2 ? 'alerte alerte--urgent' : 'alerte alerte--attention'}
              >
                <p className="alerte__titre">{besoin.competence}</p>
                <p className="alerte__detail">{besoin.message}</p>
                {besoin.candidats.length > 0 && (
                  <p className="alerte__detail">
                    À former en priorité :{' '}
                    {besoin.candidats.map((candidat) => (
                      <button
                        key={candidat.collaborateurId}
                        type="button"
                        className="bouton bouton--discret"
                        onClick={() =>
                          planifierUneFormation(candidat.collaborateurId, besoin.competence)
                        }
                      >
                        {candidat.nom} ({LIBELLES_NIVEAU[candidat.niveau as NiveauCompetence]})
                      </button>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte">
        <h2>Couverture par compétence</h2>
        <ul className="liste-simple">
          {couverture.map((ligne) => (
            <li key={ligne.competence} className="ligne-saisie">
              <span>
                <strong>{ligne.competence}</strong>{' '}
                <span className="champ__aide">
                  {ligne.autonomes} autonome{ligne.autonomes > 1 ? 's' : ''},{' '}
                  {ligne.enApprentissage} en apprentissage
                  {ligne.enFormation > 0 && `, ${ligne.enFormation} en formation`}
                </span>
              </span>
              <span className={ligne.fragile ? 'verdict verdict--mauvais' : 'verdict verdict--bon'}>
                {ligne.fragile ? 'Fragile' : 'Couvert'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="carte">
        <h2>Grille de polyvalence</h2>
        <p className="champ__aide">
          0 ne fait pas · 1 avec aide · 2 autonome · 3 sait former les autres
        </p>

        <div className="grille-cadre">
          <table className="grille grille--compacte">
            <thead>
              <tr>
                <th scope="col" className="grille__personne">
                  Collaborateur
                </th>
                {competences.map((competence) => (
                  <th key={competence} scope="col">
                    {competence}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {grille.map((ligne) => (
                <tr key={ligne.collaborateurId}>
                  <th scope="row" className="grille__personne">
                    {ligne.nom}
                  </th>
                  {competences.map((competence) => {
                    const niveau = (ligne.niveaux[competence] ?? 0) as NiveauCompetence
                    return (
                      <td key={competence}>
                        <button
                          type="button"
                          className={`niveau niveau--${niveau}`}
                          aria-label={`${ligne.nom}, ${competence} : ${LIBELLES_NIVEAU[niveau]}`}
                          onClick={() =>
                            modifierNiveau(
                              ligne.collaborateurId,
                              competence,
                              ((niveau + 1) % 4) as NiveauCompetence,
                            )
                          }
                        >
                          {niveau}
                        </button>
                      </td>
                    )
                  })}
                  <td className="grille__total">{ligne.polyvalence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="champs">
          <ChampTexte
            libelle="Nouvelle compétence"
            valeur={nouvelle}
            onChange={setNouvelle}
            placeholder="Transpalette, caisse…"
          />
        </div>
        <button
          type="button"
          className="bouton"
          disabled={nouvelle.trim() === ''}
          onClick={ajouterUneCompetence}
        >
          Ajouter
        </button>
      </section>

      <section className="carte">
        <h2>Plan de formation</h2>
        {etat.formations.length === 0 ? (
          <p>Aucune formation planifiée. Utilisez les boutons « à former en priorité » ci-dessus.</p>
        ) : (
          [...etat.formations]
            .sort((a, b) => a.debut.localeCompare(b.debut))
            .map((formation) => {
              const collaborateur = equipe.find(
                (candidat) => candidat.id === formation.collaborateurId,
              )
              return (
                <Depliant
                  key={formation.id}
                  titre={`${collaborateur === undefined ? formation.collaborateurId : nomAffiche(collaborateur)} — ${formation.intitule}`}
                  resume={`${LIBELLES_FORMATION[formation.etat]} · ${dateEnTexte(formation.debut)}`}
                >
                  <div className="champs">
                    <ChampTexte
                      libelle="Intitulé"
                      valeur={formation.intitule}
                      onChange={(intitule) => modifierFormation(formation.id, { intitule })}
                    />
                    <label className="champ champ--etroit">
                      <span className="champ__libelle">Début</span>
                      <input
                        type="date"
                        className="champ__saisie"
                        value={formation.debut}
                        onChange={(e) => modifierFormation(formation.id, { debut: e.target.value })}
                      />
                    </label>
                    <label className="champ champ--etroit">
                      <span className="champ__libelle">Fin</span>
                      <input
                        type="date"
                        className="champ__saisie"
                        value={formation.fin}
                        onChange={(e) => modifierFormation(formation.id, { fin: e.target.value })}
                      />
                    </label>
                  </div>

                  <p className="champ__libelle">État</p>
                  <div className="groupe-boutons">
                    {(['prevue', 'realisee', 'annulee'] as EtatFormation[]).map((valeur) => (
                      <button
                        key={valeur}
                        type="button"
                        className={
                          formation.etat === valeur ? 'bouton bouton--principal' : 'bouton'
                        }
                        onClick={() => {
                          modifierFormation(formation.id, { etat: valeur })
                          // Une formation realisee fait progresser la competence.
                          if (valeur === 'realisee' && collaborateur !== undefined) {
                            modifierNiveau(
                              collaborateur.id,
                              formation.competenceVisee,
                              formation.niveauVise,
                            )
                          }
                        }}
                      >
                        {LIBELLES_FORMATION[valeur]}
                      </button>
                    ))}
                  </div>
                  <p className="champ__aide">
                    Marquer « Réalisée » fait passer {collaborateur === undefined ? 'la personne' : nomAffiche(collaborateur)} au
                    niveau {formation.niveauVise} en « {formation.competenceVisee} ».
                  </p>

                  <button
                    type="button"
                    className="bouton bouton--discret"
                    onClick={() => retirerFormation(formation.id)}
                  >
                    Supprimer cette formation
                  </button>
                </Depliant>
              )
            })
        )}
      </section>

      <section className="carte">
        <h2>Habilitations</h2>
        {habilitations.length === 0 ? (
          <p>Aucune habilitation enregistrée.</p>
        ) : (
          <ul className="liste-simple">
            {habilitations.map(({ collaborateur, habilitation }) => {
              const jours =
                habilitation.expire === null ? null : joursEntre(aujourdhui(), habilitation.expire)
              return (
                <li key={`${collaborateur.id}-${habilitation.id}`} className="ligne-saisie">
                  <span>
                    <strong>{nomAffiche(collaborateur)}</strong> — {habilitation.nom}
                    <br />
                    <span className="champ__aide">
                      {habilitation.expire === null
                        ? 'Sans expiration'
                        : `Expire le ${dateEnTexte(habilitation.expire)}`}
                    </span>
                  </span>
                  {jours !== null && (
                    <span
                      className={
                        jours < 0
                          ? 'verdict verdict--mauvais'
                          : jours < 90
                            ? 'verdict verdict--moyen'
                            : 'verdict verdict--bon'
                      }
                    >
                      {jours < 0 ? 'Périmée' : `${jours} j`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
