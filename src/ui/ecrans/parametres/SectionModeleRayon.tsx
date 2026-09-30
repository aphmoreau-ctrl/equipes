import type { ReactNode } from 'react'
import { JOURS_SEMAINE, nomDuJour, nomDuMois, type JourSemaine } from '../../../domaine/calendrier'
import { rayonParId } from '../../../domaine/magasin'
import type { Bloc, ConfigurationRayon, Meteo, NiveauQualite } from '../../../moteurs/besoin'
import { useDonnees } from '../../DonneesProvider'
import { ChampHeure, ChampNombre, ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'

/**
 * Reglage du modele d'un rayon : taille, presence minimum, tolerance,
 * coefficients, et parametres de chacun de ses blocs.
 *
 * Aucune valeur n'est ecrite en dur : tout ce qui sert au calcul du besoin
 * se regle depuis cet ecran.
 */

const LIBELLES_METEO: Readonly<Record<Meteo, string>> = {
  normal: 'Normal',
  chaud: 'Chaud',
  'tres-chaud': 'Très chaud',
  froid: 'Froid',
  pluie: 'Pluie',
}

const LIBELLES_QUALITE: Readonly<Record<NiveauQualite, string>> = {
  A: 'A — sans tri',
  B: 'B — tri léger',
  C: 'C — tri important',
  refus: 'Refus',
}

const LIBELLES_TYPE: Readonly<Record<Bloc['type'], string>> = {
  reception: 'Réception',
  'mise-en-place': 'Mise en place',
  reassort: 'Réassort',
  tri: 'Tri',
  facing: 'Facing',
  'controle-dates': 'Contrôle des dates',
  nettoyage: 'Nettoyage',
  balances: 'Balances',
  transformation: 'Transformation',
  'tache-fixe': 'Tâche fixe',
  comptoir: 'Comptoir',
  'plan-cuisson': 'Plan de cuisson',
  'format-livraison': 'Format de livraison',
}

export function SectionModeleRayon({ rayonId }: { readonly rayonId: string }) {
  const { etat, modifier } = useDonnees()
  const configuration = etat.configurations.find((candidat) => candidat.rayonId === rayonId)
  const rayon = rayonParId(etat.magasin, rayonId)

  if (configuration === undefined || rayon === undefined) return null

  function modifierConfiguration(changement: Partial<ConfigurationRayon>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      configurations: precedent.configurations.map((candidat) =>
        candidat.rayonId === rayonId ? { ...candidat, ...changement } : candidat,
      ),
    }))
  }

  function modifierBloc(blocId: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      configurations: precedent.configurations.map((candidat) =>
        candidat.rayonId === rayonId
          ? {
              ...candidat,
              blocs: candidat.blocs.map((bloc) =>
                bloc.id === blocId ? ({ ...bloc, ...changement } as Bloc) : bloc,
              ),
            }
          : candidat,
      ),
    }))
  }

  const config = configuration

  return (
    <>
      <section className="carte">
        <h2>Modèle du rayon {rayon.nom}</h2>
        <p>
          Le besoin de ce rayon est la somme de {config.blocs.length} blocs, chacun avec ses
          propres formules et ses propres réglages.
        </p>

        <p className="champ__libelle">Taille du rayon</p>
        <div className="champs">
          <ChampNombre
            libelle="Mètres linéaires"
            valeur={config.taille.metresLineaires}
            onChange={(metresLineaires) =>
              modifierConfiguration({ taille: { ...config.taille, metresLineaires } })
            }
          />
          <ChampNombre
            libelle="Étals"
            valeur={config.taille.etals}
            onChange={(etals) => modifierConfiguration({ taille: { ...config.taille, etals } })}
          />
          <ChampNombre
            libelle="Meubles froids"
            valeur={config.taille.meublesFroids}
            onChange={(meublesFroids) =>
              modifierConfiguration({ taille: { ...config.taille, meublesFroids } })
            }
          />
          <ChampNombre
            libelle="Références"
            valeur={config.taille.nombreReferences}
            pas={10}
            onChange={(nombreReferences) =>
              modifierConfiguration({ taille: { ...config.taille, nombreReferences } })
            }
          />
        </div>

        <p className="champ__libelle">Règles de conversion</p>
        <div className="champs">
          <ChampNombre
            libelle="Présence minimum"
            valeur={config.presenceMinimum}
            aide="Personnes présentes au minimum pendant l’ouverture"
            onChange={(presenceMinimum) => modifierConfiguration({ presenceMinimum })}
          />
          <ChampNombre
            libelle="Tolérance"
            valeur={config.tolerance}
            pas={0.05}
            aide="0,2 laisse absorber jusqu’à 6 minutes par tranche"
            onChange={(tolerance) => modifierConfiguration({ tolerance })}
          />
        </div>
      </section>

      <section className="carte">
        <h2>Coefficients du rayon</h2>

        <Depliant titre="Qualité à la réception" resume="A, B, C et refus">
          <div className="champs">
            {(Object.keys(LIBELLES_QUALITE) as NiveauQualite[]).map((niveau) => (
              <ChampNombre
                key={niveau}
                libelle={LIBELLES_QUALITE[niveau]}
                valeur={config.coefficientsQualite[niveau]}
                pas={0.05}
                onChange={(valeur) =>
                  modifierConfiguration({
                    coefficientsQualite: { ...config.coefficientsQualite, [niveau]: valeur },
                  })
                }
              />
            ))}
          </div>
        </Depliant>

        <Depliant titre="Météo" resume="Influence du temps qu’il fait">
          <div className="champs">
            {(Object.keys(LIBELLES_METEO) as Meteo[]).map((meteo) => (
              <ChampNombre
                key={meteo}
                libelle={LIBELLES_METEO[meteo]}
                valeur={config.coefficientsMeteo[meteo]}
                pas={0.05}
                onChange={(valeur) =>
                  modifierConfiguration({
                    coefficientsMeteo: { ...config.coefficientsMeteo, [meteo]: valeur },
                  })
                }
              />
            ))}
          </div>
        </Depliant>

        <Depliant titre="Saison" resume="Un coefficient par mois">
          <div className="champs">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((mois) => (
              <ChampNombre
                key={mois}
                libelle={nomDuMois(mois)}
                valeur={config.coefficientsSaison[mois] ?? 1}
                pas={0.05}
                onChange={(valeur) =>
                  modifierConfiguration({
                    coefficientsSaison: { ...config.coefficientsSaison, [mois]: valeur },
                  })
                }
              />
            ))}
          </div>
        </Depliant>

        <div className="champs">
          <ChampNombre
            libelle="Promotion sur le rayon"
            valeur={config.coefficientPromotion}
            pas={0.05}
            onChange={(coefficientPromotion) => modifierConfiguration({ coefficientPromotion })}
          />
        </div>
      </section>

      <section className="carte">
        <h2>Blocs de travail</h2>
        <p>Chaque bloc apporte sa part du besoin. Touchez un bloc pour le régler.</p>

        {config.blocs.map((bloc) => (
          <Depliant
            key={bloc.id}
            titre={bloc.nom}
            resume={`${LIBELLES_TYPE[bloc.type]} · ${bloc.plage.debut}–${bloc.plage.fin}${bloc.actif ? '' : ' · désactivé'}`}
          >
            <div className="champs">
              <ChampTexte
                libelle="Nom"
                valeur={bloc.nom}
                onChange={(nom) => modifierBloc(bloc.id, { nom })}
              />
              <ChampHeure
                libelle="Début"
                valeur={bloc.plage.debut}
                onChange={(debut) => modifierBloc(bloc.id, { plage: { ...bloc.plage, debut } })}
              />
              <ChampHeure
                libelle="Fin"
                valeur={bloc.plage.fin}
                onChange={(fin) => modifierBloc(bloc.id, { plage: { ...bloc.plage, fin } })}
              />
            </div>

            <p className="champ__libelle">Jours d’application</p>
            <div className="groupe-boutons">
              {JOURS_SEMAINE.map((jour) => (
                <Interrupteur
                  key={jour}
                  libelle={nomDuJour(jour).slice(0, 3)}
                  actif={bloc.jours.includes(jour)}
                  onChange={(actif) =>
                    modifierBloc(bloc.id, {
                      jours: actif
                        ? [...bloc.jours, jour].sort((a, b) => a - b)
                        : bloc.jours.filter((candidat) => candidat !== jour),
                    })
                  }
                />
              ))}
            </div>

            <p className="champ__libelle">Réglages propres à ce bloc</p>
            {champsDuBloc(bloc, (changement) => modifierBloc(bloc.id, changement))}

            <p className="champ__libelle">État</p>
            <Interrupteur
              libelle={bloc.actif ? 'Bloc actif' : 'Bloc désactivé'}
              actif={bloc.actif}
              onChange={(actif) => modifierBloc(bloc.id, { actif })}
            />
          </Depliant>
        ))}
      </section>
    </>
  )
}

/** Champs specifiques a chaque type de bloc. */
function champsDuBloc(bloc: Bloc, modifier: (changement: Record<string, unknown>) => void): ReactNode {
  function parJour(
    libelle: string,
    valeurs: Readonly<Record<JourSemaine, number>>,
    cle: string,
    pas: number,
  ): ReactNode {
    return (
      <>
        <p className="champ__aide">{libelle}</p>
        <div className="champs">
          {JOURS_SEMAINE.map((jour) => (
            <ChampNombre
              key={jour}
              libelle={nomDuJour(jour)}
              valeur={valeurs[jour]}
              pas={pas}
              onChange={(valeur) => modifier({ [cle]: { ...valeurs, [jour]: valeur } })}
            />
          ))}
        </div>
      </>
    )
  }

  switch (bloc.type) {
    case 'reception':
      return (
        <>
          <div className="champs">
            <ChampNombre
              libelle="Contrôle par palette"
              suffixe="min"
              valeur={bloc.minutesParPalette}
              onChange={(minutesParPalette) => modifier({ minutesParPalette })}
            />
          </div>
          {parJour('Palettes reçues chaque jour', bloc.palettesParJour, 'palettesParJour', 1)}
        </>
      )

    case 'mise-en-place':
      return (
        <>
          <div className="champs">
            <ChampNombre
              libelle="Cadence"
              suffixe="colis / h"
              valeur={bloc.cadenceColisParHeure}
              onChange={(cadenceColisParHeure) => modifier({ cadenceColisParHeure })}
              aide="Mesurable avec le mode chrono"
            />
          </div>
          {parJour('Colis à mettre en place chaque jour', bloc.colisParJour, 'colisParJour', 5)}
        </>
      )

    case 'reassort':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Pour 100 clients"
            suffixe="min"
            valeur={bloc.minutesPour100Clients}
            onChange={(minutesPour100Clients) => modifier({ minutesPour100Clients })}
          />
        </div>
      )

    case 'tri':
    case 'facing':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Par mètre linéaire"
            suffixe="min"
            valeur={bloc.minutesParMetre}
            pas={0.1}
            onChange={(minutesParMetre) => modifier({ minutesParMetre })}
          />
        </div>
      )

    case 'controle-dates':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Par référence"
            suffixe="min"
            valeur={bloc.minutesParReference}
            pas={0.05}
            onChange={(minutesParReference) => modifier({ minutesParReference })}
          />
        </div>
      )

    case 'nettoyage':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Par meuble ou étal"
            suffixe="min"
            valeur={bloc.minutesParMeuble}
            onChange={(minutesParMeuble) => modifier({ minutesParMeuble })}
          />
        </div>
      )

    case 'balances':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Par jour"
            suffixe="min"
            valeur={bloc.minutesParJour}
            pas={5}
            onChange={(minutesParJour) => modifier({ minutesParJour })}
          />
        </div>
      )

    case 'tache-fixe':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Durée"
            suffixe="min"
            valeur={bloc.minutes}
            pas={5}
            onChange={(minutes) => modifier({ minutes })}
          />
        </div>
      )

    case 'comptoir':
      return (
        <div className="champs">
          <ChampNombre
            libelle="Part des clients"
            suffixe="%"
            valeur={bloc.partClientsPourcent}
            onChange={(partClientsPourcent) => modifier({ partClientsPourcent })}
            aide="Clients du magasin qui passent à ce comptoir"
          />
          <ChampNombre
            libelle="Temps par client"
            suffixe="min"
            valeur={bloc.minutesParClient}
            pas={0.5}
            onChange={(minutesParClient) => modifier({ minutesParClient })}
          />
          <ChampNombre
            libelle="Présence minimum"
            valeur={bloc.presenceMinimum ?? 0}
            onChange={(presenceMinimum) => modifier({ presenceMinimum })}
            aide="Personnes derrière le comptoir quand il est ouvert"
          />
        </div>
      )

    case 'plan-cuisson':
      return (
        <>
          <div className="champs">
            <ChampNombre
              libelle="Temps par fournée"
              suffixe="min"
              valeur={bloc.minutesParFournee}
              pas={5}
              onChange={(minutesParFournee) => modifier({ minutesParFournee })}
            />
          </div>
          {parJour('Fournées prévues chaque jour', bloc.fourneesParJour, 'fourneesParJour', 1)}
        </>
      )

    case 'format-livraison':
      return (
        <>
          <div className="champs">
            <ChampTexte
              libelle="Format reçu"
              valeur={bloc.format}
              onChange={(format) => modifier({ format })}
            />
            <ChampNombre
              libelle="Temps par unité"
              suffixe="min"
              valeur={bloc.minutesParUnite}
              pas={0.1}
              onChange={(minutesParUnite) => modifier({ minutesParUnite })}
              aide="Par kilo ou par pièce, selon le rayon"
            />
          </div>
          {parJour('Quantité reçue chaque jour', bloc.quantiteParJour, 'quantiteParJour', 5)}
        </>
      )

    case 'transformation':
      return (
        <>
          <div className="champs">
            <ChampNombre
              libelle="Mise en route"
              suffixe="min"
              valeur={bloc.minutesMiseEnRoute}
              pas={5}
              onChange={(minutesMiseEnRoute) => modifier({ minutesMiseEnRoute })}
            />
            <ChampNombre
              libelle="Nettoyage"
              suffixe="min"
              valeur={bloc.minutesNettoyage}
              pas={5}
              onChange={(minutesNettoyage) => modifier({ minutesNettoyage })}
            />
            <ChampNombre
              libelle="Postes"
              valeur={bloc.postes}
              minimum={1}
              onChange={(postes) => modifier({ postes })}
            />
          </div>

          <p className="champ__aide">Produits fabriqués</p>
          {bloc.produits.map((produit, index) => (
            <div key={produit.nom} className="champs">
              <ChampTexte
                libelle="Produit"
                valeur={produit.nom}
                onChange={(nom) =>
                  modifier({
                    produits: bloc.produits.map((p, i) => (i === index ? { ...p, nom } : p)),
                  })
                }
              />
              <ChampNombre
                libelle="Quantité"
                valeur={produit.quantite}
                onChange={(quantite) =>
                  modifier({
                    produits: bloc.produits.map((p, i) => (i === index ? { ...p, quantite } : p)),
                  })
                }
              />
              <ChampNombre
                libelle="Temps unitaire"
                suffixe="min"
                valeur={produit.minutesParUnite}
                pas={0.5}
                onChange={(minutesParUnite) =>
                  modifier({
                    produits: bloc.produits.map((p, i) =>
                      i === index ? { ...p, minutesParUnite } : p,
                    ),
                  })
                }
              />
            </div>
          ))}
        </>
      )
  }
}
