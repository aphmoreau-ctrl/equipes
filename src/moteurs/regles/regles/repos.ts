import { ajouterJours, lundiDeLaSemaine } from '../../../domaine/calendrier'
import { dureeEnTexte } from '../../../domaine/temps'
import { collaborateursConcernes, debutDe, finDe, instant, vacationsDe } from '../reperes'
import type { Infraction, Regle, Vacation } from '../types'

/** Repos quotidien : heures consecutives entre la fin d'une journee et le debut de la suivante. */
export const reposQuotidien: Regle = {
  id: 'repos-quotidien',
  nom: 'Repos quotidien',
  reference: 'Code du travail, article L3131-1',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const mineur = collaborateurs.find((c) => c.id === collaborateurId)?.estMineur === true
      const minimum = mineur
        ? parametres.reposQuotidienJeuneMinutes
        : parametres.reposQuotidienMinutes

      const ordonnees = vacationsDe(vacations, collaborateurId)
      for (let index = 1; index < ordonnees.length; index += 1) {
        const precedente = ordonnees[index - 1] as Vacation
        const suivante = ordonnees[index] as Vacation
        const repos = debutDe(suivante) - finDe(precedente)

        // Deux vacations du meme jour forment une coupure, pas un repos quotidien :
        // elles relevent des regles du temps partiel.
        if (precedente.jour === suivante.jour) continue
        if (repos >= minimum) continue

        infractions.push({
          regle: 'repos-quotidien',
          severite: parametres.severites['repos-quotidien'],
          collaborateurId,
          jour: suivante.jour,
          libelle: `Repos quotidien insuffisant : ${dureeEnTexte(Math.max(0, repos))}`,
          explication:
            `Fin de service à ${precedente.fin} le ${precedente.jour}, reprise à ` +
            `${suivante.debut} le ${suivante.jour} : ${dureeEnTexte(Math.max(0, repos))} ` +
            `de repos au lieu des ${dureeEnTexte(minimum)} exigées` +
            (mineur ? ' pour un salarié de moins de 18 ans.' : '.'),
        })
      }
    }

    return infractions
  },
}

/**
 * Repos hebdomadaire : 35 heures CONSECUTIVES (24 h de repos hebdomadaire
 * AUXQUELLES S'AJOUTENT les 11 h de repos quotidien), article L3132-2.
 * Les moins de 18 ans ont droit a deux jours consecutifs, soit 48 h.
 *
 * Methode : on mesure les repos REELS, d'une vacation a la suivante, en
 * utilisant les semaines voisines. Un repos qui deborde sur la semaine
 * suivante compte pour sa duree entiere, jamais pour sa partie visible.
 *
 * Aucun assouplissement : 33 h de repos restent 33 h, meme si elles couvrent
 * un dimanche entier. Quand la semaine voisine n'est pas renseignee, la duree
 * du repos est inconnue : le constat est alors « a confirmer », ni validation
 * ni accusation.
 */
export const reposHebdomadaire: Regle = {
  id: 'repos-hebdomadaire',
  nom: 'Repos hebdomadaire',
  reference: 'Code du travail, article L3132-2',

  verifier({ vacations, vacationsAnterieures, parametres, collaborateurs }) {
    const infractions: Infraction[] = []
    const toutes = [...vacationsAnterieures, ...vacations]

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const mineur = collaborateurs.find((c) => c.id === collaborateurId)?.estMineur === true
      const minimum = mineur
        ? parametres.reposHebdomadaireJeuneMinutes
        : parametres.reposHebdomadaireMinutes

      const ordonnees = vacationsDe(toutes, collaborateurId)
      const semaines = [
        ...new Set(
          vacationsDe(vacations, collaborateurId).map((vacation) =>
            lundiDeLaSemaine(vacation.jour),
          ),
        ),
      ].sort()

      for (const lundi of semaines) {
        const debutSemaine = instant(lundi, '00:00')
        const finSemaine = instant(ajouterJours(lundi, 7), '00:00')

        const dansLaSemaine = ordonnees.filter(
          (vacation) => finDe(vacation) > debutSemaine && debutDe(vacation) < finSemaine,
        )
        if (dansLaSemaine.length === 0) continue

        const derniere = dansLaSemaine[dansLaSemaine.length - 1] as Vacation

        /*
         * Un repos est rattache a la semaine ou il COMMENCE. Le repos qui
         * precede le premier jour travaille appartient a la semaine d'avant :
         * le compter ici masquerait une vraie infraction derriere une
         * incertitude sur des donnees qui ne concernent pas cette semaine.
         */
        const reposMesures: number[] = []
        let reposIndetermine = false

        for (let index = 1; index < dansLaSemaine.length; index += 1) {
          reposMesures.push(
            debutDe(dansLaSemaine[index] as Vacation) - finDe(dansLaSemaine[index - 1] as Vacation),
          )
        }

        // Repos ouvert par la derniere vacation de la semaine : sa duree n'est
        // connue que si l'on sait quand le travail reprend.
        const apres = ordonnees.filter((vacation) => debutDe(vacation) >= finDe(derniere))
        const premiereApres = apres[0]
        if (premiereApres !== undefined) {
          reposMesures.push(debutDe(premiereApres) - finDe(derniere))
        } else {
          reposIndetermine = true
        }

        const plusLongMesure = reposMesures.length === 0 ? 0 : Math.max(...reposMesures)
        if (plusLongMesure >= minimum) continue

        if (reposIndetermine) {
          infractions.push({
            regle: 'repos-hebdomadaire',
            severite: 'a-confirmer',
            collaborateurId,
            jour: lundi,
            libelle: 'Repos hebdomadaire à confirmer',
            explication:
              `Semaine du ${lundi} : le plus long repos connu dure ` +
              `${dureeEnTexte(plusLongMesure)}, et il se poursuit au-delà des semaines ` +
              `renseignées. Les ${dureeEnTexte(minimum)} consécutives ne pourront être ` +
              `vérifiées qu’une fois la semaine voisine construite.`,
          })
          continue
        }

        infractions.push({
          regle: 'repos-hebdomadaire',
          severite: parametres.severites['repos-hebdomadaire'],
          collaborateurId,
          jour: lundi,
          libelle: `Repos hebdomadaire insuffisant : ${dureeEnTexte(plusLongMesure)}`,
          explication:
            `Semaine du ${lundi} : le plus long repos consécutif dure ` +
            `${dureeEnTexte(plusLongMesure)}, au lieu des ${dureeEnTexte(minimum)} exigées ` +
            (mineur
              ? '(deux jours consécutifs pour un salarié de moins de 18 ans).'
              : '(24 h de repos hebdomadaire auxquelles s’ajoutent les 11 h de repos quotidien).'),
        })
      }
    }

    return infractions
  },
}

/**
 * Six jours de travail au maximum par semaine civile (L3132-1).
 *
 * Ce controle est independant du precedent : travailler les sept jours d'une
 * semaine est interdit en soi, quelle que soit la duree des repos.
 */
export const joursMaximumParSemaine: Regle = {
  id: 'jours-maximum-par-semaine',
  nom: 'Nombre de jours travaillés par semaine',
  reference: 'Code du travail, article L3132-1',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const mineur = collaborateurs.find((c) => c.id === collaborateurId)?.estMineur === true
      const maximum = mineur
        ? parametres.joursMaximumParSemaineJeune
        : parametres.joursMaximumParSemaine

      const parSemaine = new Map<string, Set<string>>()
      for (const vacation of vacationsDe(vacations, collaborateurId)) {
        const lundi = lundiDeLaSemaine(vacation.jour)
        const jours = parSemaine.get(lundi)
        if (jours === undefined) parSemaine.set(lundi, new Set([vacation.jour]))
        else jours.add(vacation.jour)
      }

      for (const [lundi, jours] of [...parSemaine].sort(([a], [b]) => a.localeCompare(b))) {
        if (jours.size <= maximum) continue

        infractions.push({
          regle: 'jours-maximum-par-semaine',
          severite: parametres.severites['jours-maximum-par-semaine'],
          collaborateurId,
          jour: lundi,
          libelle: `${jours.size} jours travaillés dans la semaine`,
          explication:
            `Semaine du ${lundi} : ${jours.size} jours de travail, alors que le maximum ` +
            `est de ${maximum}` +
            (mineur ? ' pour un salarié de moins de 18 ans.' : '.'),
        })
      }
    }

    return infractions
  },
}
