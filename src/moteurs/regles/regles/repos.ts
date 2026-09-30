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

        // Deux vacations du meme jour (coupure) ne sont pas un repos quotidien.
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
 * Repos hebdomadaire : une coupure d'au moins 35 heures consecutives.
 *
 * Methode retenue, et pourquoi :
 * on cherche, dans la semaine, un repos de 35 h d'affilee. Un repos qui
 * commence dans la semaine et se poursuit au-dela du dimanche soir compte
 * des lors qu'il atteint deja 24 h avant la fin de la semaine : les 11 h de
 * repos quotidien qui suivent sont alors acquises de toute facon.
 *
 * Cette nuance evite deux erreurs symetriques :
 * - signaler a tort une semaine finie le samedi midi, suivie d'un dimanche
 *   de repos (le repos deborde sur la semaine suivante) ;
 * - laisser passer sept jours travailles d'affilee, ou aucun repos de 24 h
 *   n'apparait nulle part.
 */
export const reposHebdomadaire: Regle = {
  id: 'repos-hebdomadaire',
  nom: 'Repos hebdomadaire',
  reference: 'Code du travail, article L3132-2',

  verifier({ vacations, vacationsAnterieures, parametres }) {
    const infractions: Infraction[] = []
    const toutes = [...vacationsAnterieures, ...vacations]
    const REPOS_QUOTIDIEN_ACQUIS = 24 * 60

    for (const collaborateurId of collaborateursConcernes(vacations)) {
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

        const dedans = ordonnees.filter(
          (v) => finDe(v) > debutSemaine && debutDe(v) < finSemaine,
        )
        if (dedans.length === 0) continue

        const avant = ordonnees.filter((v) => finDe(v) <= debutSemaine)
        const apres = ordonnees.filter((v) => debutDe(v) >= finSemaine)
        const derniereAvant = avant[avant.length - 1]
        const premiereApres = apres[0]

        /** Repos candidats : debut et fin de chaque intervalle sans travail. */
        const repos: { debut: number; fin: number; finConnue: boolean }[] = []

        // Repos en tete de semaine, seulement si l'on sait ce qui precede.
        const premiere = dedans[0] as Vacation
        if (derniereAvant !== undefined) {
          repos.push({ debut: finDe(derniereAvant), fin: debutDe(premiere), finConnue: true })
        }

        for (let index = 1; index < dedans.length; index += 1) {
          repos.push({
            debut: finDe(dedans[index - 1] as Vacation),
            fin: debutDe(dedans[index] as Vacation),
            finConnue: true,
          })
        }

        // Repos en fin de semaine : sa fin n'est connue que si l'on sait ce qui suit.
        const derniere = dedans[dedans.length - 1] as Vacation
        repos.push({
          debut: finDe(derniere),
          fin: premiereApres === undefined ? finSemaine : debutDe(premiereApres),
          finConnue: premiereApres !== undefined,
        })

        let meilleur = 0
        let suffisant = false
        for (const intervalle of repos) {
          const duree = Math.max(0, intervalle.fin - intervalle.debut)
          meilleur = Math.max(meilleur, duree)
          if (duree >= parametres.reposHebdomadaireMinutes) suffisant = true
          // Repos qui deborde sur la semaine suivante : 24 h visibles suffisent.
          if (!intervalle.finConnue && duree >= REPOS_QUOTIDIEN_ACQUIS) suffisant = true
        }

        if (!suffisant) {
          infractions.push({
            regle: 'repos-hebdomadaire',
            severite: parametres.severites['repos-hebdomadaire'],
            collaborateurId,
            jour: lundi,
            libelle: `Repos hebdomadaire insuffisant : ${dureeEnTexte(meilleur)}`,
            explication:
              `Le plus long repos de la semaine du ${lundi} dure ` +
              `${dureeEnTexte(meilleur)}, au lieu des ` +
              `${dureeEnTexte(parametres.reposHebdomadaireMinutes)} consécutives exigées ` +
              `(24 h de repos hebdomadaire plus les 11 h de repos quotidien).`,
          })
        }
      }
    }

    return infractions
  },
}
