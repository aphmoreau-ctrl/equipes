# Spécification — Planning automatique (appli « Équipes »)

> À donner à Claude Code dans le dossier « Equipe ».
> Objectif : l'appli **propose** des plannings adaptés, par secteur et tous secteurs, avec **les bonnes personnes au bon moment**, en tenant compte de **toutes les tâches** et de **toutes les compétences**. Arnaud ajuste, verrouille et valide. Rien n'est jamais imposé.

Outil strictement personnel. Les PDF présentés à la direction restent propres : pas de notes internes. Règle RGPD : prénoms uniquement, aucun commentaire ni appréciation sur les personnes, aucun motif d'absence.

---

## 1. Secteurs

Secteurs de départ, tous modifiables (ajout, renommage, désactivation) :

| Code | Secteur | Particularités |
|---|---|---|
| `fl` | Fruits et légumes | réception tôt, tri, mise en rayon, démarque du soir |
| `bo` | Boucherie | découpe (compétence rare), vitrine, commandes clients |
| `tr` | Charcuterie traiteur | coupe, plateaux, commandes clients, fêtes |
| `cr` | Crèmerie / libre-service frais | réception, rotation des dates, chaîne du froid |
| `bl` | Boulangerie pâtisserie | cuisson très tôt, mise en rayon |
| `vin` | Cave / vins | réception, mise en rayon, conseil client, foire aux vins |
| `drive` | Drive | préparation des commandes, contrôle, chaîne du froid, remise aux clients par créneau |

Chaque secteur a un **horaire d'ouverture** et un **horaire d'activité** (ex. le drive prépare de 7 h à 19 h, remet de 9 h à 19 h 30).

---

## 2. Données

### 2.1 Collaborateurs
```
{ id, prenom, secteurPrincipal, secteursSecondaires: [...],
  type: "CDI" | "CDD" | "interim" | "etudiant",
  contrat: { heuresSemaine, joursMaxSemaine, debut, fin },
  reposFixes: [0..6],                 // jours de repos habituels
  disponibilites: { [jour]: [{d:"06:00", f:"14:00"}] },  // facultatif
  preferences: { matin|apresMidi|indifferent },           // facultatif, poids faible
  competences: { [codeCompetence]: 0|1|2|3 } }
```
Niveaux : 0 non formé · 1 en formation · 2 autonome · 3 peut former.

### 2.2 Absences et congés
`{ personneId, du, au, type: "conge"|"absence"|"formation"|"autre" }`. Jamais de motif.

### 2.3 Compétences
Liste globale, chacune rattachée à un ou plusieurs secteurs. Exemples :
réception, contrôle températures, mise en rayon, tri F&L, découpe, désossage, vitrine, coupe charcuterie, plateaux, préparation commandes clients, commande fournisseur, étiquetage prix, démarque, cuisson, conseil vins, préparation drive, contrôle drive, remise drive, nettoyage, fermeture.

### 2.4 Catalogue des tâches (par secteur)
```
{ id, secteur, nom, competence, niveauMin,          // ex. découpe, 2
  charge: { mode: "fixe"|"variable", minutes,        // fixe : 90 min
            parUnite?: "commande"|"livraison"|"palette", minutesParUnite? },
  fenetre: { d:"06:00", f:"08:00" },                 // quand elle doit être faite
  jours: [1..6] | "livraisons",                      // fréquence
  personnes: 1,                                      // simultanées
  apres?: [idTache],                                 // ordre (mise en rayon après réception)
  priorite: "critique"|"haute"|"normale"|"basse",    // critique = jamais sautée
  fractionnable: true|false }
```
L'appli fournit une **liste de départ par secteur**, ajustable. Exemples :
- **Drive** : préparation des commandes (variable, environ X min par commande, frais en dernier), contrôle et mise en bacs froids, remise par créneau, gestion des manquants et substitutions, nettoyage des bacs.
- **Vins** : réception, mise en rayon, étiquetage, rangement, conseil client aux heures de pointe, foire aux vins (temps fort).
- **Boucherie** : réception, découpe (niveau 2 minimum), vitrine, préparation des commandes, nettoyage du labo, fermeture.

### 2.5 Volumes prévus
Ils alimentent les tâches variables :
- les commandes drive par créneau ;
- les livraisons par secteur et par jour ;
- les prévisions de ventes par jour, avec les jours particuliers, les fêtes, la foire aux vins et les promotions.

Saisie manuelle au départ, import plus tard.

### 2.6 Règles
**Dures (jamais violées)** — valeurs par défaut, à vérifier dans la convention collective IDCC 2216 et l'accord d'entreprise :
- repos quotidien ≥ 11 h consécutives ;
- repos hebdomadaire ≥ 35 h consécutives (24 h + 11 h) ;
- durée maximale de 10 h par jour, de 48 h par semaine, et de 44 h en moyenne sur 12 semaines ;
- pause ≥ 20 min dès 6 h de travail ;
- respect des absences, congés, dates de contrat et repos fixes ;
- une tâche n'est confiée qu'à une personne de niveau ≥ `niveauMin`, ou de niveau 1 **en binôme** avec une personne de niveau 3 sur le même créneau ;
- les tâches `critique` sont toujours couvertes, sinon un conflit est signalé.

**Souples (optimisées, avec des poids réglables)** :
- respecter les heures du contrat (écart minimal) ;
- garder chacun dans son secteur principal (un prêt coûte des points) ;
- équité des samedis, des fermetures et des ouvertures sur 4 semaines ;
- préférences matin ou après-midi ;
- stabilité d'une semaine à l'autre (éviter de tout changer) ;
- limiter le nombre de coupures et les amplitudes ;
- coût : salariés avant intérimaires, intérim seulement si nécessaire.

---

## 3. Algorithme de proposition

Pour une semaine donnée (ou plusieurs, à l'avance) :

1. **Calcul de la charge** : pour chaque secteur, chaque jour et chaque tranche de 15 min, la somme des tâches à faire, avec leur compétence et leur niveau. Les tâches variables sont multipliées par les volumes prévus.
2. **Besoins par créneau** : le nombre de personnes nécessaires par compétence et par tranche, en respectant les fenêtres et l'ordre des tâches.
3. **Génération des horaires** : on construit des postes (ex. 6 h – 13 h) qui couvrent les besoins. Un poste dure au moins 3 h et ne dépasse pas les maximums. Les créneaux les plus contraints passent en premier (compétence rare, fenêtre étroite, priorité critique).
4. **Affectation des personnes** aux postes, par score : compétence ✓, disponibilité ✓, règles dures ✓, puis meilleur score sur les règles souples. Le secteur principal d'abord, puis les **prêts** entre secteurs si quelqu'un est compétent et disponible.
5. **Affectation des tâches** dans chaque poste : c'est la **feuille de route** de chacun (heure, tâche, secteur).
6. **Amélioration locale** : échanges de postes entre personnes, décalages de 15 à 30 min, fusion de postes, tant que le score s'améliore et qu'aucune règle dure n'est violée.
7. **Conflits** : tout ce qui reste non couvert est listé, avec des **solutions classées** (prêt depuis le secteur X, décalage d'horaire, heures complémentaires, intérimaire sur tel créneau, ou formation à prévoir).

**Verrouillage** : les cases verrouillées par Arnaud ne bougent jamais. « Relancer » ne recalcule que le reste.
**Reproductibilité** : à données égales, la proposition doit être identique (pas de hasard non maîtrisé).
**Performance** : environ 7 secteurs × 60 personnes × 1 semaine en moins de 5 secondes sur iPad. Le calcul tourne dans un Web Worker pour ne pas bloquer l'écran.

---

## 4. Écrans

1. **Proposition par secteur** : grille personnes × jours avec les horaires. Les créneaux non couverts sont en rouge, les prêts marqués. Un bouton « Proposer », un bouton « Relancer » (hors cases verrouillées), et un verrou par case.
2. **Tous secteurs** : grille secteurs × jours, avec la couverture des besoins en %, les heures planifiées par rapport aux heures nécessaires, les prêts entre secteurs et le total par rapport au budget d'heures.
3. **Journée** : courbe charge/présents par secteur, tranche par tranche, et la liste des tâches non couvertes.
4. **Feuille de route** par personne et par jour, imprimable ou partageable.
5. **Conflits et solutions** : chaque conflit avec ses solutions classées, applicables d'un geste.
6. **Comparer** la proposition avec le planning en cours : ce qui change, et pour qui.
7. **Réglages** : secteurs, compétences, catalogue de tâches, règles (valeurs et poids).
8. **Export PDF propre** pour la direction : planning par secteur et tous secteurs, sans notes internes ni conflits.

---

## 5. Contrôles automatiques (avant validation)

- Chaque tâche critique est couverte par une personne au bon niveau.
- Aucune règle dure n'est violée : la liste est vide, sinon on bloque la validation.
- Aucun binôme de formation n'est incomplet.
- Écarts d'heures au contrat, par personne.
- Fragilités : compétence couverte par une seule personne, avec une suggestion de formation.

---

## 6. Construction par étapes (pour Claude Code)

| Lot | Contenu | Test de fin de lot |
|---|---|---|
| 1 | Modèle de données : secteurs (dont vins et drive), compétences, catalogue de tâches avec liste de départ, règles | Tout est saisissable, modifiable et synchronisé |
| 2 | Calcul de la charge et des besoins par tranche de 15 min | Une journée type donne une courbe de charge correcte |
| 3 | Vérificateur de règles dures | Des plannings piégés sont tous détectés |
| 4 | Génération des postes et affectation des personnes (score) | Un jeu d'essai de 3 secteurs et 15 personnes est couvert à 100 % sans violation |
| 5 | Affectation des tâches et feuilles de route | Chaque tâche a une personne compétente dans sa fenêtre |
| 6 | Amélioration locale, verrouillage, relance | Les cases verrouillées sont intactes, le score progresse |
| 7 | Conflits et solutions classées | Une absence non remplaçable produit une solution « intérim » |
| 8 | Vue tous secteurs, prêts, budget d'heures | Les prêts apparaissent quand un secteur manque |
| 9 | Plusieurs semaines à l'avance, équité sur 4 semaines | Les samedis sont répartis équitablement |
| 10 | Exports PDF propres | Aucune donnée interne n'apparaît dans le PDF |

Prévoir un **jeu de données d'essai** fictif (7 secteurs, environ 40 personnes, catalogue complet) pour tester chaque lot. Écrire les fonctions de calcul **sans dépendance à l'interface**, dans un module `planner/` avec des tests unitaires.

---

## 7. Phrase de démarrage à donner à Claude Code

> « Lis SPEC_PLANNING_AUTO.md. On construit le planning automatique lot par lot, dans l'ordre du tableau de la section 6. Avant chaque lot, présente-moi ce que tu vas faire et attends mon accord. À la fin de chaque lot, lance les tests et montre-moi le résultat. Commence par le lot 1 en tenant compte de ce qui existe déjà dans l'appli. »
