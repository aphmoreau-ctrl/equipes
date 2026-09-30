import { useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import { nomAffiche } from '../../domaine/collaborateur'
import {
  LIBELLES_ABSENCE,
  type TypeAbsence,
} from '../../domaine/absence'
import {
  demandeVide,
  estAccordee,
  joursOuvrables,
  soldeDisponible,
  type DemandeConge,
} from '../../domaine/conge'
import { changerEtatSuivi, LIBELLES_ETAT, type EtatSuivi } from '../../domaine/suivi'
import {
  controlerLaDemande,
  joursAccordes,
  joursDeFractionnement,
  ordreDesDeparts,
} from '../../moteurs/conges'
import { useDonnees } from '../DonneesProvider'
import { ChampNombre } from '../composants/Champ'
import { SuiviPlanning } from '../composants/SuiviPlanning'

const TYPES: readonly TypeAbsence[] = ['conge-paye', 'rtt', 'formation', 'absence-autorisee']

export function Conges() {
  const { etat, modifier } = useDonnees()
  const [choisie, setChoisie] = useState<string | null>(null)
  const [nouveau, setNouveau] = useState({
    collaborateurId: '',
    debut: aujourdhui(),
    fin: aujourdhui(),
    type: 'conge-paye' as TypeAbsence,
  })

  const equipe = etat.collaborateurs.filter((collaborateur) => collaborateur.actif)

  function nom(collaborateurId: string): string {
    const collaborateur = equipe.find((candidat) => candidat.id === collaborateurId)
    return collaborateur === undefined ? collaborateurId : nomAffiche(collaborateur)
  }

  function ajouterLaDemande(): void {
    if (nouveau.collaborateurId === '' || nouveau.fin < nouveau.debut) return
    const demande = demandeVide(
      `dc-${Date.now()}`,
      nouveau.collaborateurId,
      nouveau.debut,
      nouveau.fin,
      aujourdhui(),
      nouveau.type,
    )
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      demandesConge: [...precedent.demandesConge, demande],
    }))
    setChoisie(demande.id)
  }

  function retirerLaDemande(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      demandesConge: precedent.demandesConge.filter((demande) => demande.id !== identifiant),
    }))
    setChoisie(null)
  }

  function changerLeSuivi(
    identifiant: string,
    nouvelEtat: EtatSuivi,
    date: string,
    remarques: string,
  ): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      demandesConge: precedent.demandesConge.map((demande) =>
        demande.id === identifiant
          ? { ...demande, ...changerEtatSuivi(demande, nouvelEtat, date, remarques) }
          : demande,
      ),
    }))
  }

  function modifierAjustement(collaborateurId: string, ajustement: number): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      soldesConges: precedent.soldesConges.map((solde) =>
        solde.collaborateurId === collaborateurId ? { ...solde, ajustement } : solde,
      ),
    }))
  }

  const demandes = [...etat.demandesConge].sort((a, b) => a.debut.localeCompare(b.debut))
  const demandeChoisie = demandes.find((demande) => demande.id === choisie)
  const rangs = ordreDesDeparts(demandes, equipe)

  return (
    <>
      <header className="entete">
        <h1>Congés</h1>
        <p>Demandes, soldes, planning des congés d’été et absences par type.</p>
      </header>

      <section className="carte">
        <h2>Nouvelle demande</h2>
        <div className="champs">
          <label className="champ">
            <span className="champ__libelle">Qui</span>
            <select
              className="champ__saisie"
              value={nouveau.collaborateurId}
              onChange={(e) => setNouveau({ ...nouveau, collaborateurId: e.target.value })}
            >
              <option value="">Choisir une personne…</option>
              {equipe.map((collaborateur) => (
                <option key={collaborateur.id} value={collaborateur.id}>
                  {nomAffiche(collaborateur)}
                </option>
              ))}
            </select>
          </label>

          <label className="champ champ--etroit">
            <span className="champ__libelle">Du</span>
            <input
              type="date"
              className="champ__saisie"
              value={nouveau.debut}
              onChange={(e) => setNouveau({ ...nouveau, debut: e.target.value })}
            />
          </label>

          <label className="champ champ--etroit">
            <span className="champ__libelle">Au</span>
            <input
              type="date"
              className="champ__saisie"
              value={nouveau.fin}
              onChange={(e) => setNouveau({ ...nouveau, fin: e.target.value })}
            />
          </label>

          <label className="champ champ--etroit">
            <span className="champ__libelle">Type</span>
            <select
              className="champ__saisie"
              value={nouveau.type}
              onChange={(e) => setNouveau({ ...nouveau, type: e.target.value as TypeAbsence })}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {LIBELLES_ABSENCE[type]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="champ__aide">
          {joursOuvrables(nouveau.debut, nouveau.fin)} jour
          {joursOuvrables(nouveau.debut, nouveau.fin) > 1 ? 's' : ''} ouvrable
          {joursOuvrables(nouveau.debut, nouveau.fin) > 1 ? 's' : ''} — le dimanche n’est pas décompté.
        </p>

        <button
          type="button"
          className="bouton bouton--principal"
          disabled={nouveau.collaborateurId === '' || nouveau.fin < nouveau.debut}
          onClick={ajouterLaDemande}
        >
          Enregistrer la demande
        </button>
      </section>

      <section className="carte">
        <h2>Demandes</h2>
        {demandes.length === 0 ? (
          <p>Aucune demande enregistrée.</p>
        ) : (
          <ul className="liste-simple">
            {demandes.map((demande) => (
              <li key={demande.id} className="ligne-saisie">
                <span>
                  <strong>{nom(demande.collaborateurId)}</strong> — du{' '}
                  {dateEnTexte(demande.debut)} au {dateEnTexte(demande.fin)} (
                  {joursOuvrables(demande.debut, demande.fin)} j)
                  <br />
                  <span className={`etat etat--${demande.etat}`}>
                    {LIBELLES_ETAT[demande.etat]}
                  </span>{' '}
                  <span className="champ__aide">{LIBELLES_ABSENCE[demande.type]}</span>
                </span>
                <button
                  type="button"
                  className="bouton"
                  onClick={() => setChoisie(choisie === demande.id ? null : demande.id)}
                >
                  {choisie === demande.id ? 'Fermer' : 'Ouvrir'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {demandeChoisie !== undefined && (
        <DetailDemande
          demande={demandeChoisie}
          onChangerSuivi={(nouvelEtat, date, remarques) =>
            changerLeSuivi(demandeChoisie.id, nouvelEtat, date, remarques)
          }
          onRetirer={() => retirerLaDemande(demandeChoisie.id)}
        />
      )}

      <section className="carte">
        <h2>Soldes</h2>
        <p>
          Jours ouvrables acquis, pris et restants. Le <strong>bulletin de paie fait foi</strong> :
          le recalage permet d’aligner l’application dessus.
        </p>
        <ul className="liste-simple">
          {equipe.map((collaborateur) => {
            const solde = etat.soldesConges.find((s) => s.collaborateurId === collaborateur.id) ?? {
              collaborateurId: collaborateur.id,
              acquis: 0,
              pris: 0,
              ajustement: 0,
            }
            const accordes = joursAccordes(demandes, collaborateur.id)
            const fractionnement = joursDeFractionnement(
              demandes,
              collaborateur.id,
              etat.parametresConges,
            )
            return (
              <li key={collaborateur.id} className="ligne-saisie">
                <span>
                  <strong>{nomAffiche(collaborateur)}</strong> —{' '}
                  {soldeDisponible(solde) - accordes} jours restants
                  <span className="champ__aide">
                    {' '}
                    ({solde.acquis} acquis, {accordes} accordés
                    {fractionnement > 0 && `, +${fractionnement} de fractionnement`})
                  </span>
                </span>
                <ChampNombre
                  libelle="Recalage"
                  valeur={solde.ajustement}
                  minimum={-60}
                  onChange={(valeur) => modifierAjustement(collaborateur.id, valeur)}
                />
              </li>
            )
          })}
        </ul>
      </section>

      {demandes.length > 0 && (
        <section className="carte">
          <h2>Ordre des départs</h2>
          <p className="avis">
            Classement <strong>indicatif</strong>, fondé sur l’ancienneté puis sur la date de la
            demande. Le critère légal de la situation de famille est volontairement absent : c’est
            une donnée interdite dans cette application.
          </p>
          <ul className="liste-simple">
            {rangs.map((rang) => (
              <li key={`${rang.collaborateurId}-${rang.rang}`}>
                {rang.rang}. <strong>{nom(rang.collaborateurId)}</strong>{' '}
                <span className="champ__aide">
                  entré le {dateEnTexte(rang.anciennete)}, demande du {dateEnTexte(rang.demandeeLe)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function DetailDemande({
  demande,
  onChangerSuivi,
  onRetirer,
}: {
  readonly demande: DemandeConge
  readonly onChangerSuivi: (etat: EtatSuivi, date: string, remarques: string) => void
  readonly onRetirer: () => void
}) {
  const { etat } = useDonnees()
  const collaborateur = etat.collaborateurs.find(
    (candidat) => candidat.id === demande.collaborateurId,
  )
  if (collaborateur === undefined) return null

  const constats = controlerLaDemande(
    demande,
    collaborateur,
    etat.demandesConge.filter((autre) => autre.id !== demande.id),
    etat.soldesConges,
    etat.collaborateurs,
    etat.parametresConges,
  )

  return (
    <>
      <section className="carte">
        <h2>{nomAffiche(collaborateur)}</h2>
        <p>
          Du {dateEnTexte(demande.debut)} au {dateEnTexte(demande.fin)} —{' '}
          {joursOuvrables(demande.debut, demande.fin)} jours ouvrables.
        </p>

        {constats.length === 0 ? (
          <p className="avis">Rien à signaler sur cette demande.</p>
        ) : (
          <ul className="liste-alertes">
            {constats.map((constat) => (
              <li
                key={constat.libelle}
                className={
                  constat.gravite === 'bloquant'
                    ? 'alerte alerte--urgent'
                    : constat.gravite === 'attention'
                      ? 'alerte alerte--attention'
                      : 'alerte alerte--information'
                }
              >
                <p className="alerte__titre">{constat.libelle}</p>
                <p className="alerte__detail">{constat.explication}</p>
              </li>
            ))}
          </ul>
        )}

        {estAccordee(demande) && (
          <p className="avis">
            Ce congé est accordé : il bloque désormais le planning et la proposition automatique.
          </p>
        )}

        <button type="button" className="bouton bouton--discret" onClick={onRetirer}>
          Supprimer cette demande
        </button>
      </section>

      <SuiviPlanning planning={demande} titre="Suivi de la demande" onChanger={onChangerSuivi} />
    </>
  )
}
