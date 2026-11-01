# Équipes — Règles du planning automatique (v2)

## Consignes pour Claude Code

Ce fichier décrit les règles métier du planning automatique de l'appli Équipes (Intermarché La Vaugine).

- Lis tout le fichier avant de coder et reformule-moi ce que tu as compris, puis attends ma validation.
- **Aucune règle en dur dans le code** : rayons, horaires, tâches, durées, besoins, compétences et seuils sont des **paramètres modifiables dans l'app** (écran Réglages). Les valeurs ci-dessous sont les valeurs de départ.
- Avance par étapes, chacune testée avant la suivante :
  1. Modèle de données + données de départ ci-dessous
  2. **Moteur de contrôle** : il vérifie un planning (même saisi à la main) et liste les violations, classées en **bloquant** (illégal) ou **alerte** (règle interne, sous-effectif)
  3. Générateur automatique qui propose un planning respectant le moteur de contrôle ; je garde toujours la main pour corriger
- Les éléments marqués **[À DÉFINIR]** doivent exister comme paramètres vides ou provisoires, signalés dans l'app tant qu'ils ne sont pas renseignés.
- Rappel : outil strictement personnel. Les exports PDF restent propres, sans notes internes.

---

## 1. Rayons et horaires de présence en rayon

| Rayon | Lun | Mar | Mer | Jeu | Ven | Sam | Dim |
|---|---|---|---|---|---|---|---|
| Fruits & Légumes | 6h–20h | 5h–20h | 5h–20h | 5h–20h | 5h–20h | 5h–20h | 7h–12h45 |
| Marée | 7h–20h | 6h30–20h | 6h45–20h | 6h30–20h | 6h30–20h | 6h30–20h | 7h–12h45 |
| Charcuterie / Fromage | 7h–20h | 6h30–20h | 7h–20h | 6h30–20h | 7h–20h | 6h30–20h | 7h–12h45 |
| Boucherie Trad + Boucherie LS | 6h–20h | 6h–20h | 6h–20h | 6h–20h | 6h–20h | 6h–20h | 7h–12h45 |
| Fraîche découpe | 6h30–13h | 6h30–12h | 6h30–12h | 6h30–13h | 6h30–13h | 6h30–13h | fermé |
| Cuisine mobile | fermé | fermé | fermé | fermé | 10h–19h | 10h–18h | fermé |

Boucherie Trad et Boucherie LS sont deux compétences distinctes mais partagent les mêmes horaires.

## 2. Couverture minimale (vente)

- **Présence permanente d'au moins 1 personne** de 8h30 à 20h (dimanche 8h30–12h30) en : Fruits & Légumes, Marée, Boucherie Trad, Charcuterie / Fromage.
- **Cuisine mobile** : 1 personne obligatoire, uniquement pendant ses horaires d'ouverture.
- **Charcuterie / Fromage** : 2 personnes minimum en rayon le vendredi et le samedi.
- **Heures d'affluence** : 11h–13h et 17h–19h en semaine ; le samedi l'affluence est plus forte **[À DÉFINIR : plages exactes du samedi]**.
- **Vendredi et samedi** : charge plus forte, il faut des bras en plus pour la vente assistée.
- → Besoins exprimés **par rayon, par jour et par tranche horaire** (minimum + cible), paramétrables.
  - **Minimum** : obligatoire, alerte si non tenu.
  - **Cible** : souhaitée, peut être atteinte avec des renforts (compétences secondaires).

### Effectifs de départ, lundi à jeudi (minimum / cible) — valeurs provisoires, à affiner

| Tranche | F&L | Marée | C/F | B. Trad | B. LS |
|---|---|---|---|---|---|
| Ouverture rayon → 8h30 | 2 / 3 | 1 / 1 | 1 / 2 | 1 / 2 | 2 / 2 |
| 8h30–11h | 1 / 2 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 2 |
| 11h–13h (affluence) | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 1 |
| 13h–17h | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 |
| 17h–19h (affluence) | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 1 |
| 19h–20h | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 | 0 / 1 |

Fraîche découpe : 1 / 1 pendant ses horaires d'ouverture.
Boucherie LS : besoin réel de l'après-midi (vente ou production seulement) **[À DÉFINIR]**.
Vendredi, samedi et dimanche : effectifs **[À DÉFINIR]** (plus de bras pour la vente assistée ven/sam).

Le générateur doit signaler quand une cible n'est tenable qu'avec des renforts (cas attendu en Marée : 3 titulaires seulement).
Fraîche découpe : 37 h de matinées par semaine pour sa titulaire (36h75) → les personnes ayant la compétence Fraîche découpe en secondaire complètent (jour de repos, congés).

## 3. Tâches et cadencier de production

| Tâche | Qui (compétence) | Quand | Durée |
|---|---|---|---|
| Rôtisserie — cuisson 1 | Bouchers | avant 8h30 | [À DÉFINIR] |
| Rôtisserie — cuisson 2 | Bouchers | vers 13h30 | [À DÉFINIR] |
| Rôtisserie — cuisson 3 | Bouchers | vers 18h30 | [À DÉFINIR] |
| Rôtisserie dimanche | Bouchers | 1 seule cuisson, vente 8h30–12h30 | [À DÉFINIR] |

Rôtisserie : **3 cuissons par jour en semaine, validé**. Durée de chaque cuisson à définir plus tard.
| Emballage charcuterie | personnes désignées dans l'app | lundi à jeudi (4 créneaux/sem.) | 2h par créneau |
| Emballage boucherie | personne désignée dans l'app | [À DÉFINIR] | [À DÉFINIR] |
| Emballage fromage | [À DÉFINIR] | [À DÉFINIR] | [À DÉFINIR] |
| Skin marée | Poissonniers (compétence Marée) | à façon selon arrivages → **réserve de temps quotidienne** | [À DÉFINIR] |
| Préparation traiteur & charcuterie | équipe Préparation traiteur | voir §4 | — |
| Réunion managers | Managers | lundi 13h–13h30 | 30 min |
| Réunion secteur trad | Au minimum les responsables (désignés dans l'app ; responsables Marée et C/F à désigner) | tous les jours 8h | 5 min |
| Remballe | par rayon | heure de début propre à chaque rayon/tâche **[À DÉFINIR]** | [À DÉFINIR] |

**Règle légale rôtisserie** : maintien au chaud **5 h maximum**. Le contrôle doit vérifier qu'aucun produit en vente n'a été cuit il y a plus de 5 h (d'où 3 cuissons en semaine). Nombre et heures de cuisson paramétrables.

Plus tard : liste détaillée des tâches de chaque rayon, pour caler logiquement les horaires.

## 4. Préparation traiteur & charcuterie (pas un rayon de vente)

- Lundi à vendredi : **matin uniquement**, début comme la boucherie (6h) ; fin à 12h ou 13h30 selon le jour **[À DÉFINIR : quels jours 12h, quels jours 13h30 — paramètre par jour]**.
- Samedi : **une personne**, rotation entre deux préparateurs désignés dans l'app. Ils se remplacent aussi pendant les vacances.
- Personne l'après-midi, ni le dimanche.
- Aucune obligation de présence en vente.

## 5. Collaborateurs

**La liste nominative n'est pas dans le dépôt** (dépôt public, RGPD) : elle est importée une seule fois dans l'application, à partir d'un fichier transmis à part, puis vit uniquement dans les données de l'app.

Pour chaque collaborateur, l'app enregistre :
- prénom + initiale du nom ;
- statut (employé, manager, apprenti, intérim, cadre au forfait) et tranche d'âge (majeur / mineur) ;
- contrat hebdomadaire (36h75, 39h…) — un cadre au forfait est hors calcul d'heures et compte seulement comme présence ;
- compétences **principales** (une ou plusieurs), **secondaires** (renfort) et **en dépannage uniquement** ;
- particularités : poste du matin, tâches désignées (emballage…), responsable (réunion trad), rotation du samedi en préparation traiteur, jours d'école pour les apprentis.

- Tous les bouchers (compétence Boucherie Trad ou LS) ont la compétence **Rôtisserie**.
- « Matin » = préférence/contrainte de poste du matin (paramétrable).
- Pour chaque apprenti : calendrier des **jours d'école** saisissable (jours non planifiables en magasin).

## 6. Priorité d'affectation

Pour chaque besoin, le générateur choisit dans cet ordre :
1. Personnes dont c'est la **compétence principale**
2. Personnes ayant la compétence en **secondaire** (renfort quand nécessaire : absences, congés, pics ven/sam)
3. Personnes en **dépannage**, seulement si personne d'autre, et pour une courte durée

Un renfort ne doit pas créer de trou dans le rayon principal de la personne.
Point sensible : la **Marée** n'a que 3 titulaires. En cas d'absence, renfort par les personnes ayant la compétence Marée en secondaire.

## 7. Règles internes (alertes)

- Pauses : **3 min par heure travaillée**, prises entre **8h30 et 11h** (matin) ou **15h et 17h30** (après-midi), jamais pendant les heures d'affluence.
- **3 h minimum** de présence par jour travaillé.
- **6 jours consécutifs maximum**.
- Respect des heures contrat sur la semaine (écart signalé).
- **Crédit d'heures** : certains salariés ont des heures à récupérer → compteur par personne, récupération planifiable, dans le respect des règles légales.
- Absences (maladie, congés, autres) saisies avant génération ; le générateur replanifie autour.

## 8. Règles légales (bloquantes)

### Tous les salariés majeurs
- **11 h** de repos minimum entre deux journées
- **35 h** de repos hebdomadaire consécutif (24 h + 11 h)
- **10 h** de travail effectif maximum par jour
- **48 h** maximum sur une semaine (et 44 h en moyenne sur 12 semaines)
- Pause d'au moins **20 min consécutives** dès 6 h de travail (si les pauses de 3 min/h ne forment pas un bloc de 20 min, le contrôle le signale)

### Mineurs
- Aucun travail entre **22h et 6h** (début à 6h possible, pas avant)
- **8 h** maximum par jour, **35 h** maximum par semaine
- **12 h** de repos minimum entre deux journées
- **2 jours de repos consécutifs** par semaine
- Pause de **30 min consécutives** dès 4 h 30 de travail
- **[À VÉRIFIER RH / convention collective]** : contrat de 36h75 supérieur au plafond de 35 h des mineurs ; travail du dimanche et des jours fériés pour les mineurs

Les seuils légaux sont des paramètres, pour pouvoir les ajuster si la convention collective est plus stricte.

## 9. Points encore ouverts

- Effectifs vendredi, samedi, dimanche + plages d'affluence du samedi
- Affinage de la grille lundi–jeudi (dont Boucherie LS l'après-midi)
- Durées des cuissons rôtisserie et de la réserve skin marée
- Emballage boucherie et emballage fromage (jours, durée, qui)
- Responsables Marée et Charcuterie/Fromage (réunion trad)
- Jours où la préparation traiteur finit à 12h vs 13h30
- Jours d'école des apprentis
- Remballe : heures de début et durées par rayon (à travailler ensemble)
- Situation contractuelle des mineurs (36h75 vs 35 h)
