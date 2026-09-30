# Cahier des charges – Application « Équipes »

Version 1.0 – septembre 2026. Document de référence du projet : toute évolution doit y être reportée.

---

## 1. Contexte et objectif

- Utilisateur : Arnaud, responsable des **rayons frais** d'un supermarché Intermarché indépendant (propriétaire adhérent : M. Eude). Prise de poste début novembre 2026.
- La **gestion des équipes** est le point prioritaire du patron : l'application doit permettre une gestion **complète, anticipée, conforme et mesurable** du personnel.
- Périmètre de départ : **service Frais** et ses rayons. L'application doit pouvoir s'étendre ensuite à d'autres services du magasin **sans refonte**.
- Elle remplacera à terme la partie « équipes » de l'application existante « Rayons frais » (prévoir un import de ces données, voir §15).

### Les trois questions auxquelles l'app répond en quelques secondes
1. **Qui est là** aujourd'hui, demain, cette semaine, et dans quel rayon ?
2. **Mes rayons sont-ils couverts** aux bons moments (ouverture, livraisons, pics) ?
3. **Qu'est-ce qui cloche ou va clocher** (trou de planning, fin de CDD, formation expirée, heures qui dérapent, règle non respectée) ?

### Principes
- **Anticiper** plutôt que subir : alertes avant le problème.
- **Sécurité juridique** : contrôles automatiques Code du travail + convention 2216.
- **Équité** entre salariés (samedis, dimanches, fermetures, fériés).
- **Résultats mesurables** pour le patron (indicateurs, rapports).
- **Humain** : intégration, formation, entretiens – uniquement des faits.
- Le planning automatique est une **proposition** : l'utilisateur valide et ajuste.

---

## 2. Technique

- **PWA** installable (manifest, service worker, icônes, fonctionnement hors ligne), hébergée sur **GitHub Pages** (`aphmoreau-ctrl/equipes`).
- Pile conseillée : **TypeScript + Vite**, déploiement automatique via GitHub Actions ; tests avec **Vitest**. Tout autre choix doit être justifié et validé.
- **Moteurs en code pur, séparés de l'interface** : `moteur-besoin`, `moteur-planning`, `regles` (légales/conventionnelles), `indicateurs`. Tous testés.
- **Données** : Firebase (projet dédié, à créer avec l'utilisateur, pas celui de « Mes Heures »). Authentification e-mail / mot de passe ; Firestore avec persistance hors ligne ; règles de sécurité : chaque utilisateur n'accède qu'à ses données (`users/{uid}/…`). Prévoir plus tard un **accès lecture seule** pour le patron.
- Synchronisation temps réel entre iPad, iPhone, Mac ; résolution de conflits « dernière modification gagne » par document, avec historique.
- **Verrouillage** : code à l'ouverture (et Face ID si réalisable via WebAuthn/passkey).
- **Sauvegarde** : export complet (JSON + fichiers) et restauration.
- **Historique des modifications** sur les données sensibles (planning publié, contrats, compteurs).
- Accessibilité et confort : iPad d'abord (tactile, gros boutons, glisser-déposer dans le planning), iPhone (écran du jour), Mac (clavier/souris). Mode sombre. Interface en français.

---

## 3. RGPD et confidentialité (obligatoire)

- Le patron a donné son accord pour cet outil. Les données restent **minimales** et **factuelles**.
- Identité : **prénom + initiale du nom**, photo facultative.
- **Interdits** : motif médical ou de santé, situation familiale, religion, opinions, appréciations personnelles, commentaires sur la vie privée.
- Absences : seulement le **type** (maladie, congé, absence autorisée…), jamais le détail médical.
- Contact d'un salarié : seulement s'il l'a accepté, pour les remplacements.
- Durées de conservation paramétrables ; **suppression/export** des données d'un salarié à sa demande ; anonymisation à la sortie après délai.
- Aucune donnée réelle dans le code, le dépôt ou les tests.

---

## 4. Structure des données (principe)

`Magasin → Services (Frais, puis d'autres) → Rayons → Postes / blocs de travail`

`Collaborateurs` rattachés à un service, un rayon principal, des rayons secondaires, avec compétences.

Tout paramètre a une **valeur par défaut modifiable**.

---

## 5. Module 1 – Paramétrage du magasin

- **Services** et **rayons** (activables, renommables, ordre). Rayons frais par défaut : fruits et légumes, boucherie, marée, crèmerie / libre-service frais, charcuterie-traiteur, fromage, boulangerie.
- **Horaires** : ouverture du magasin par jour ; horaires propres à chaque comptoir ; jours fériés ouverts ; horaires exceptionnels.
- **Fréquentation** : clients par jour de semaine + profil horaire (en %) ; modifiable ; plus tard importable.
- **Horaires types** des équipes (ex. 05:30–12:30, 07:00–14:00, 13:30–20:30), avec pause.
- **Calendrier des événements** : fêtes, catalogues promo, vacances scolaires, inventaires, météo exceptionnelle ; chacun avec dates, rayons concernés et **coefficient** de volume.
- **Règles** (voir §8) : toutes paramétrables.
- **Budgets** : heures par rayon et par semaine ; ratios cibles (chiffre d'affaires par heure, masse salariale / CA) si connus.

---

## 6. Module 2 – Équipe (fiche collaborateur)

- Prénom + initiale ; photo facultative.
- Service, rayon principal, rayons secondaires.
- Poste ; statut (employé, agent de maîtrise, cadre) ; niveau de classification 2216.
- Contrat : CDI, CDD, intérim, apprenti, étudiant ; durée hebdomadaire ; temps plein / partiel ; modulation éventuelle.
- Dates clés **avec alertes** : entrée, fin de période d'essai, fin de CDD, renouvellements, ancienneté.
- **Disponibilités déclarées** (ex. « pas le samedi », « matins uniquement », contraintes d'études).
- Compétences (lien module 10).
- Compteurs d'**équité** : samedis, dimanches, fermetures, fériés travaillés.
- Contact (si accord) pour les remplacements.

---

## 7. Module 3 – Calcul du besoin (moteur de besoin)

### 7.1 Principe
Pour chaque rayon, chaque jour, chaque **tranche de 30 min** : nombre de personnes nécessaires **et compétences requises**.

`Besoin(personnes) = max( présence minimum , arrondi_supérieur( minutes_de_travail / 30 − tolérance ) )`

Chaque rayon est un **assemblage de blocs** ; chaque bloc a ses formules, paramètres, plages horaires et compétences. **Les rayons n'ont pas les mêmes blocs ni les mêmes paramètres** : on doit pouvoir ajouter un bloc sur mesure à un rayon.

### 7.2 Blocs disponibles
- **Taille du rayon** (paramètres) : mètres linéaires, étals, meubles froids, nombre de références. Utilisée par : facing (min/m), contrôle des dates (min/référence), nettoyage (min/meuble ou étal).
- **Réception** : jours/heures de livraison ; palettes et colis par jour ; contrôle (min/palette) ; **qualité à réception** (voir 7.3).
- **Mise en place / libre-service** : colis ÷ cadence (colis/h) × coefficient qualité ; séparément **vrac/étals** et **libre-service (LS)** ; à terminer avant une heure donnée.
- **Réassort** en journée : proportionnel à la fréquentation (minutes pour 100 clients).
- **Tri / retrait** des produits abîmés : min par mètre, × coefficient saison.
- **Comptoir / service** : clients × % passant au rayon × minutes par client, pendant les horaires du comptoir ; présence minimum.
- **Transformation / laboratoire** : liste de produits (quantité prévue × temps unitaire en min/kg ou min/unité) + mise en route + nettoyage ; plage horaire ; capacité (nombre de postes) ; compétences ; hygiène.
- **Balances** au rayon : contrôle, étiquettes, nettoyage (min/jour).
- **Tâches fixes** : nom, durée, heure, jours (relevés de température, commandes, nettoyage, mise en place promo…).
- **Plan de cuisson** (boulangerie) : fournées × durée, selon le mode de fabrication (surgelé, précuit, maison).
- **Format de livraison** (boucherie : carcasse / quartiers / prêt à découper ; marée : entier / à préparer / filets) avec temps associés.

### 7.3 Qualité à la réception
- Grille par rayon, **coefficients par produit** : A sans tri ×1,0 ; B tri léger ×1,3 ; C tri important ×1,8 ; refus (valeurs par défaut modifiables).
- Saisie **d'un geste sur iPhone** à la réception (« Fraises, 1 palette, qualité C ») → besoin du jour **recalculé immédiatement**, alerte s'il faut renforcer.
- Historique par produit et fournisseur → utilisé pour l'anticipation (ex. début de saison).

### 7.4 Modèles de rayons (valeurs de départ, toutes modifiables)
- **Fruits et légumes** (rayon pilote, le plus détaillé) : étals vrac **et** libre-service ; **balances au rayon** ; **transformation** (fruits découpés, salades, jus) ; qualité A/B/C très variable ; forte influence **météo** et **saison** ; réassort continu ; tri.
- **Boucherie** : comptoir (au moins 1 boucher qualifié quand ouvert) ; format de livraison ; laboratoire (hachés, brochettes, barquettes LS) ; LS ; traçabilité ; nettoyage.
- **Marée** : étal avec horaires propres ; mise en glace matin et démontage/nettoyage soir (blocs fixes lourds) ; écaillage/filetage à la demande ; arrivages.
- **Crèmerie / LS frais** : colis ÷ cadence avant l'affluence ; contrôle des dates (références × minutes) ; remplissage mi-journée ; casse.
- **Charcuterie-traiteur / fromage** : comptoir avec pics midi et 17h–19h ; tranchage ; plats préparés par lots.
- **Boulangerie** : plan de cuisson ; vente aux pics.

### 7.5 Coefficients
Événements (calendrier), saison (par mois, par rayon), météo (saisie manuelle du jour : normal / chaud / froid / pluie…), promotion sur le rayon.

### 7.6 Mode chrono (mesure du réel)
Sur iPhone : démarrer/arrêter une tâche (« mise en place F&L, 2 palettes, qualité B ») → durée réelle enregistrée → calcul des **cadences réelles** du magasin.

### 7.7 Apprentissage
Chaque semaine : comparaison prévu / réalisé (volumes, heures, durées chrono) → recalage progressif des paramètres (lissage, ex. 80 % ancien + 20 % observé), avec validation possible par l'utilisateur.

### 7.8 Affichage
Courbe de besoin par rayon et par jour (tranches de 30 min), **décomposée par bloc** (couleurs), avec le besoin arrondi en personnes ; totaux d'heures ; vue semaine ; comparaison au budget.

---

## 8. Règles légales et conventionnelles (module `regles`)

Toutes **paramétrables**, avec les valeurs par défaut suivantes (à vérifier et ajuster selon le contrat et les accords du magasin) :

- Durée maximale **10 h / jour** (dérogation 12 h exceptionnelle : inventaires, etc.).
- **Repos quotidien 11 h** consécutives ; **repos hebdomadaire 35 h** consécutives (24 h + 11 h).
- **48 h / semaine** maximum ; 44 h en moyenne sur 12 semaines.
- **Pause 20 min** dès 6 h de travail.
- **Temps partiel** : nombre et durée des coupures limités ; heures complémentaires plafonnées ; **délai de prévenance** des changements de planning (par défaut 7 jours ouvrés) ; durée minimale paramétrable.
- **Dimanches** et **jours fériés** : suivi, majorations (convention 2216 : dimanche habituel 20 % ou 30 % selon surface, exceptionnel 100 % ; férié travaillé 100 % ou repos équivalent).
- **Nuit** (convention 2216) : 21 h–22 h +5 %, 22 h–5 h +20 % ; statut de travailleur de nuit (seuils paramétrables).
- **Contingent** d'heures supplémentaires : 180 h/an par défaut (2216).
- Jeunes de moins de 18 ans : règles spécifiques (repos 12 h, pas de nuit…).
- Chaque règle est soit **bloquante** (jamais violée par le générateur), soit **avertissement**, au choix de l'utilisateur.

---

## 9. Module 4 – Planning (moteur de planning)

### 9.1 Entrées
Besoins par rayon/tranche/compétence ; collaborateurs (contrats, disponibilités, compétences, congés, absences, formations) ; règles ; horaires types ; historique d'équité ; planning de la semaine précédente (repos, continuité).

### 9.2 Contraintes
- **Dures** (jamais violées) : disponibilités, congés/absences, compétences requises, toutes les règles légales bloquantes.
- **Souples** (pénalités pondérées, poids réglables) : écart aux heures du contrat, équité (week-ends, fermetures, fériés), préférences, régularité des horaires, sureffectif, déplacements entre rayons, changements par rapport au planning précédent.

### 9.3 Algorithme
1. Générer les **vacations candidates** à partir des horaires types (avec pause).
2. Placer d'abord les **postes clés** (ouvertures, fermetures, comptoirs, laboratoire) en commençant par les **créneaux les plus difficiles** (compétence rare, besoin élevé).
3. Pour chaque poste : choisir la personne avec le **meilleur score** (couverture apportée − pénalités) parmi celles qui respectent toutes les contraintes dures.
4. Compléter chacun jusqu'à ses heures de contrat sur les créneaux les plus en manque.
5. **Amélioration par recherche locale** (échanges de personnes/jours, déplacements de vacations) tant que le score global s'améliore ; durée de calcul limitée et affichée.
6. Gestion des **polyvalents** entre rayons (un seul moteur pour tous les rayons).
7. Résultat **déterministe** à données égales (graine fixe), pour pouvoir comparer.

### 9.4 Sorties
- Planning par personne et par rayon (vue semaine, vue jour, vue rayon).
- **Indicateurs** : couverture % (Σ min(présents, besoin) / Σ besoin), sureffectif, conformité (0 infraction), équité (écarts entre personnes), heures prévues vs contrats vs budget.
- **Explication de chaque trou** (« Crèmerie mardi 8h–10h : manque 1 personne ; personne de disponible avec la compétence réception »).
- Ajustement manuel (glisser-déposer sur iPad) avec **recontrôle immédiat**.
- **Scénarios** : comparer deux plannings.
- **Publication** : versions datées, respect du délai de prévenance, PDF d'affichage par rayon et par personne, historique des modifications après publication.
- **Semaine type** réutilisable.

### 9.5 Anticipation
- Horizon détaillé : 4 semaines. Horizon prévisionnel : **12 semaines** par rayon : capacité (heures contrats − congés − absences connues − formations) vs besoin → **alertes** (« semaine 51 : manque ~60 h → intérim / CDD / décaler des congés / former »).
- Prise en compte des fins de CDD, périodes d'essai, congés d'été, fêtes.

---

## 10. Module 5 – Aujourd'hui (écran du jour, iPhone et iPad)

- Présents / absents par rayon et par tranche ; **trous en rouge** ; arrivées/départs à venir.
- Consignes du jour, livraisons attendues, qualité des arrivages saisie.
- **Absence imprévue** : un bouton → liste des **remplaçants possibles** classés (compétence, disponibilité, heures restantes au contrat, repos légal respecté, équité) → mise à jour du planning et trace.
- Alertes du jour (échéances, règles, dépassements).

## 11. Module 6 – Heures

Heures prévues / réalisées (saisie ou import d'une badgeuse plus tard) ; heures supplémentaires et complémentaires ; majorations (nuit, dimanche, fériés) ; compteurs par personne ; **export mensuel des éléments variables de paie** (CSV/PDF).

## 12. Module 7 – Congés et absences

Demandes, validation, règles (période légale, ordre des départs, fractionnement), planning des congés d'été, soldes (recalables sur bulletin), absences par type sans motif médical, impact automatique sur la capacité et le planning.

## 13. Modules 8 à 12

- **8 – Remplacements et intérim** : vivier (internes polyvalents, intérimaires, étudiants) avec disponibilités, compétences, coûts ; historique.
- **9 – Recrutement et intégration** : besoins anticipés (issus du module anticipation), fiches de poste, suivi minimal des candidatures (RGPD), **parcours d'intégration** (check-list), suivi de période d'essai.
- **10 – Compétences et formations** : **grille de polyvalence** (niveaux 0 à 3 par poste), plan de formation, **habilitations** (hygiène, transpalette électrique, découpe…) avec échéances et alertes ; indicateur de dépendance (« une seule personne sait faire X »).
- **11 – Suivi individuel** : entretien annuel, **entretien professionnel obligatoire tous les 2 ans**, bilan à 6 ans, objectifs ; faits datés uniquement ; alertes d'échéance.
- **12 – Sécurité et conformité** : actions de prévention, équipements de protection, accidents du travail (délais de déclaration), affichages obligatoires, dates des visites médicales (sans contenu).

## 14. Modules 13 à 15

- **13 – Communication** : consignes, briefs, réunions et comptes rendus, notes datées (avec niveau d'importance par couleur).
- **14 – Pilotage et rapports pour le patron** : tableau de bord (productivité CA/heure si CA saisi, heures vs budget, couverture, heures sup et intérim, absentéisme, turnover, polyvalence, formations et entretiens à jour, conformité) ; **rapport d'une page par semaine** et **bilan mensuel** en PDF, avec plan d'actions.
- **15 – Documents** : modèles, procédures, affichages (stockage chiffré par morceaux dans Firestore si nécessaire, pas de Cloud Storage payant).

## 15. Transverse

- **Alertes et rappels** centralisés (écran d'accueil + badge).
- **Recherche** globale.
- **Import** des données de l'app « Rayons frais » (équipes, plannings) – format à étudier avec l'utilisateur.
- **Extension** à d'autres services du magasin par paramétrage.
- **Données de démonstration** fictives complètes (rayons, 15 à 25 collaborateurs, 4 semaines d'historique) activables/désactivables.

---

## 16. Feuille de route

Chaque étape : validation préalable → développement → tests → démo fictive → publication → validation par l'utilisateur.

- **Étape 0 – Socle** : PWA installable (manifest, service worker, icônes), structure du projet, Vite + TypeScript + Vitest, déploiement automatique, navigation, thème, verrouillage, données de démo. *Critère : installable sur iPad, fonctionne hors ligne.*
- **Étape 1 – Paramétrage** (module 1) + **modèle fruits et légumes complet** + **courbe de besoin** du jour/semaine. *Critère : besoin F&L calculé et affiché par tranche, décomposé par bloc, tests du moteur.*
- **Étape 2 – Équipe** (module 2) + modèles des autres rayons.
- **Étape 3 – Moteur de planning** + règles + vue planning + ajustement manuel + indicateurs + explications. *Critère : batterie de tests (repos, durées, temps partiels, compétences, équité, cas impossibles) ; zéro infraction sur les jeux de test.*
- **Étape 4 – Firebase** (compte, synchro iPad/iPhone/Mac, hors ligne, règles de sécurité) + sauvegarde/restauration.
- **Étape 5 – Aujourd'hui + absences imprévues / remplacements + congés et absences.**
- **Étape 6 – Heures + export paie + anticipation 12 semaines + mode chrono + qualité réception.**
- **Étape 7 – Compétences, formations, suivi individuel, recrutement, intégration, sécurité.**
- **Étape 8 – Pilotage, rapports patron, communication, documents, import Rayons frais.**

Objectif : étapes 0 à 5 opérationnelles avant la prise de poste (début novembre 2026).
