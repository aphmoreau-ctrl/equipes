# Cahier des charges – Application « Équipes »

Version 1.2 – septembre 2026. Document de référence du projet : toute évolution doit y être reportée.

> **Révision 1.1 (30 septembre 2026)** — l'application est un **outil strictement personnel** : toute mention d'un accès du patron à l'application est supprimée. Ajout du **circuit de suivi** (§9.6) et de la **règle générale sur les documents sortants / PDF** (§15).
>
> **Révision 1.2 (30 septembre 2026)** — **priorisation retenue** pour la prise de poste (§16.1) : socle opérationnel d'abord, planning automatique ensuite. Distinction des **deux familles de PDF** et de leurs conditions d'impression (§15).

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
- **Résultats mesurables** à présenter au patron, sous forme de **documents** (indicateurs, rapports PDF).
- **Humain** : intégration, formation, entretiens – uniquement des faits.
- Le planning automatique est une **proposition** : l'utilisateur valide et ajuste.
- **Outil strictement personnel** : l'application est utilisée par Arnaud **seul**. Le patron n'y a **jamais accès**, pas même en lecture. Il reçoit uniquement des **documents PDF**, remis **hors de l'application** (voir §15, « Documents sortants »).
- **La validation finale est externe à l'application** : Arnaud **prépare** et **soumet**, le patron **valide en dehors de l'app**. L'application ne décide rien et ne transmet rien : elle **garde la trace** de ce circuit, renseigné à la main par Arnaud (voir §9.6).

---

## 2. Technique

- **PWA** installable (manifest, service worker, icônes, fonctionnement hors ligne), hébergée sur **GitHub Pages** (`aphmoreau-ctrl/equipes`).
- Pile conseillée : **TypeScript + Vite**, déploiement automatique via GitHub Actions ; tests avec **Vitest**. Tout autre choix doit être justifié et validé.
- **Moteurs en code pur, séparés de l'interface** : `moteur-besoin`, `moteur-planning`, `regles` (légales/conventionnelles), `indicateurs`. Tous testés.
- **Données** : Firebase (projet dédié, à créer avec l'utilisateur, pas celui de « Mes Heures »). Authentification e-mail / mot de passe ; Firestore avec persistance hors ligne ; règles de sécurité : chaque utilisateur n'accède qu'à ses données (`users/{uid}/…`). **Aucun accès tiers, ni maintenant ni plus tard** : pas de compte pour le patron, pas de partage en lecture seule, pas de lien public de consultation (voir §1, « Outil strictement personnel »).
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
- **Publication** : versions datées, respect du délai de prévenance, PDF d'affichage par rayon et par personne (conforme à §15, « Documents sortants »), historique des modifications après publication. La publication à l'équipe est la **dernière étape du circuit de suivi** (§9.6). Le **PDF d'affichage équipe** n'est produit qu'au statut « Publié à l'équipe » ; le **dossier à présenter au patron** est produit à tout moment, y compris en brouillon (§15).
- **Semaine type** réutilisable.

### 9.5 Anticipation
- Horizon détaillé : 4 semaines. Horizon prévisionnel : **12 semaines** par rayon : capacité (heures contrats − congés − absences connues − formations) vs besoin → **alertes** (« semaine 51 : manque ~60 h → intérim / CDD / décaler des congés / former »).
- Prise en compte des fins de CDD, périodes d'essai, congés d'été, fêtes.

### 9.6 Circuit de suivi (préparation → soumission → validation externe)

Arnaud n'est **pas le validateur final** : il prépare, puis soumet à son patron, qui valide **en dehors de l'application**. L'application ne soumet rien, ne notifie personne et ne valide rien : elle **garde la trace** d'un circuit qu'Arnaud renseigne **lui-même**, à la main. Ce suivi est **visible uniquement dans l'application**.

États successifs :

| État | Signification | Renseigné par Arnaud |
|---|---|---|
| **Brouillon** | en préparation, modifiable librement | état initial |
| **Soumis** | remis au patron pour validation | **date de soumission** |
| **Validé** | accord du patron | **date de validation** |
| **À corriger** | le patron demande des modifications | **date** + **remarques du patron**, notées par Arnaud |
| **Publié à l'équipe** | affiché / diffusé aux salariés | **date de publication** |

- Le cycle n'est pas linéaire : « À corriger » ramène au travail, puis à une **nouvelle soumission**, autant de fois que nécessaire.
- **Historique complet et horodaté** : chaque changement d'état est conservé avec sa date, ses remarques et un lien vers la **version** concernée. Rien n'est écrasé ni supprimé.
- L'état ne **bloque** jamais le travail : Arnaud peut modifier un document déjà soumis ou validé ; l'application le signale et l'historique en garde la trace.
- **Indicateurs de suivi** : en attente de soumission, soumis depuis plus de N jours sans réponse, « à corriger » non repris.
- Les **remarques du patron** sont des **notes de travail internes** : elles restent dans l'application et ne figurent sur **aucun PDF** (§15).
- **Impression** : le *dossier à présenter au patron* est imprimable **à tout état** — c'est précisément le document soumis ; le *PDF d'affichage équipe* n'est imprimable qu'au statut **« Publié à l'équipe »** (§15). Aucun des deux ne porte de mention de statut.
- **RGPD** (§3) : ces remarques portent sur l'organisation du travail, jamais sur une appréciation personnelle d'un salarié.

**Mécanisme générique, développé une seule fois** puis réutilisé : d'abord les **plannings** (§9), ensuite les **congés** (§12), enfin les **recrutements** (§13, module 9).

---

## 10. Module 5 – Aujourd'hui (écran du jour, iPhone et iPad)

- Présents / absents par rayon et par tranche ; **trous en rouge** ; arrivées/départs à venir.
- Consignes du jour, livraisons attendues, qualité des arrivages saisie.
- **Absence imprévue** : un bouton → liste des **remplaçants possibles** classés (compétence, disponibilité, heures restantes au contrat, repos légal respecté, équité) → mise à jour du planning et trace.
- Alertes du jour (échéances, règles, dépassements).

## 11. Module 6 – Heures

Heures prévues / réalisées (saisie ou import d'une badgeuse plus tard) ; heures supplémentaires et complémentaires ; majorations (nuit, dimanche, fériés) ; compteurs par personne ; **export mensuel des éléments variables de paie** (CSV/PDF).

## 12. Module 7 – Congés et absences

Demandes, règles (période légale, ordre des départs, fractionnement), planning des congés d'été, soldes (recalables sur bulletin), absences par type sans motif médical, impact automatique sur la capacité et le planning.

Le **circuit de suivi** (§9.6) s'applique aux congés : Brouillon → Soumis → Validé / À corriger → Publié. La validation reste celle du patron, **hors application**.

## 13. Modules 8 à 12

- **8 – Remplacements et intérim** : vivier (internes polyvalents, intérimaires, étudiants) avec disponibilités, compétences, coûts ; historique.
- **9 – Recrutement et intégration** : besoins anticipés (issus du module anticipation), fiches de poste, suivi minimal des candidatures (RGPD), **parcours d'intégration** (check-list), suivi de période d'essai. Le **circuit de suivi** (§9.6) s'applique aux **demandes de recrutement** soumises au patron.
- **10 – Compétences et formations** : **grille de polyvalence** (niveaux 0 à 3 par poste), plan de formation, **habilitations** (hygiène, transpalette électrique, découpe…) avec échéances et alertes ; indicateur de dépendance (« une seule personne sait faire X »).
- **11 – Suivi individuel** : entretien annuel, **entretien professionnel obligatoire tous les 2 ans**, bilan à 6 ans, objectifs ; faits datés uniquement ; alertes d'échéance.
- **12 – Sécurité et conformité** : actions de prévention, équipements de protection, accidents du travail (délais de déclaration), affichages obligatoires, dates des visites médicales (sans contenu).

## 14. Modules 13 à 15

- **13 – Communication** : consignes, briefs, réunions et comptes rendus, notes datées (avec niveau d'importance par couleur).
- **14 – Pilotage, et rapports à remettre au patron** : tableau de bord **personnel, interne à l'application** (productivité CA/heure si CA saisi, heures vs budget, couverture, heures sup et intérim, absentéisme, turnover, polyvalence, formations et entretiens à jour, conformité) ; à partir de ce tableau de bord, production d'un **rapport d'une page par semaine** et d'un **bilan mensuel** **en PDF**, avec plan d'actions — documents **remis au patron hors application** et strictement conformes à §15, « Documents sortants ». Le patron **n'accède pas** au tableau de bord.
- **15 – Documents** : modèles, procédures, affichages (stockage chiffré par morceaux dans Firestore si nécessaire, pas de Cloud Storage payant).

## 15. Transverse

- **Alertes et rappels** centralisés (écran d'accueil + badge).
- **Recherche** globale.
- **Import** des données de l'app « Rayons frais » (équipes, plannings) – format à étudier avec l'utilisateur.
- **Extension** à d'autres services du magasin par paramétrage.
- **Circuit de suivi** générique (§9.6), réutilisé par les plannings, les congés et les recrutements.
- **Données de démonstration** fictives complètes (rayons, 15 à 25 collaborateurs, 4 semaines d'historique) activables/désactivables.

### Documents sortants (PDF) – règle générale

Tout PDF produit par l'application est destiné à **quitter** l'application : il est remis au patron ou affiché à l'équipe. Il doit être **propre, sobre et professionnel**.

**Ce qui figure dans un PDF** — uniquement ce qui est utile à son destinataire :
- planning (par rayon, par personne, par semaine, par jour), horaires, pauses ;
- effectifs et couverture ;
- **indicateurs utiles seulement**, choisis en fonction du document et immédiatement compréhensibles ;
- en-tête neutre : titre, rayon ou service, période, date d'édition, numéro de version.

**Ce qui n'y figure jamais** :
- notes personnelles et notes de travail d'Arnaud ;
- commentaires internes, **y compris les remarques du patron** saisies dans le circuit de suivi ;
- **statut de suivi** (Brouillon, Soumis, À corriger, Validé…) et **historique** des modifications ou des états ;
- avertissements techniques, messages de mise au point, réglages, paramètres de calcul, détail des pénalités du moteur de planning ;
- toute donnée interdite par le RGPD (§3) : motif d'absence détaillé, situation personnelle, appréciation.

**Deux familles de documents distinctes — jamais un export brut des écrans** :

| Document | Destinataire | Condition de production | Contenu |
|---|---|---|---|
| **Dossier à présenter** | le patron | **imprimable à tout moment**, y compris en brouillon : c'est précisément le document soumis pour validation | planning, horaires, effectifs, couverture, indicateurs utiles ; **aucun statut, aucun commentaire** |
| **Affichage équipe** | les salariés | **uniquement si le planning est au statut « Publié à l'équipe »** (§9.6) ; sinon l'impression est **indisponible**, avec l'explication affichée à l'écran | planning et horaires, par rayon et par personne |

**Autres conséquences pratiques** :
- l'**aperçu à l'écran est identique au PDF final** : ce qu'Arnaud voit avant impression est exactement ce que le destinataire recevra ;
- **aucune mention de statut ni filigrane** sur l'un ou l'autre document : le statut se lit **dans l'application**, jamais sur le papier ;
- le verrouillage de l'affichage équipe est la **seule** protection contre la diffusion d'un planning non validé : il est donc **bloquant**, et non un simple avertissement.

---

## 16. Feuille de route

Chaque étape : validation préalable → développement → tests → démo fictive → publication → validation par l'utilisateur.

### 16.1 Priorisation retenue (décidée le 30 septembre 2026)

Le temps disponible avant la prise de poste est court (environ cinq semaines). La priorité n'est donc **pas** de tout construire dans l'ordre du document, mais de disposer d'un outil **réellement utilisable chaque jour** dès le premier jour — quitte à ce que le planning reste construit **à la main** au départ.

**Priorité 1 – à terminer avant la prise de poste (début novembre 2026)**

| Ordre | Lot | Contenu | Origine |
|---|---|---|---|
| 1 | **Socle** | PWA installable, structure du projet, Vite + TypeScript + Vitest, déploiement automatique, navigation, thème, verrouillage | Étape 0 |
| 2 | **Paramétrage et besoin** | magasin, services, rayons, horaires, horaires types, fréquentation, événements ; modèle **fruits et légumes** complet ; **courbe de besoin** par tranche de 30 min décomposée par bloc ; **qualité à la réception** | Étape 1 + §7.3 |
| 3 | **Équipe** | fiches collaborateurs, contrats, disponibilités, compétences, dates clés et alertes ; modèles des autres rayons | Étape 2 |
| 4 | **Firebase** | projet dédié, authentification, synchronisation iPad / iPhone / Mac, hors ligne, règles de sécurité, sauvegarde et restauration | Étape 4, avancée |
| 5 | **Planning manuel contrôlé** | saisie et glisser-déposer ; **règles légales et conventionnelles** (§8) en contrôle immédiat ; **courbe de besoin et couverture affichées en regard du planning** ; explication des trous ; **circuit de suivi** (§9.6) ; **dossier patron** et **affichage équipe** en PDF (§15) | Étape 3, sans le générateur |
| 6 | **Aujourd'hui** | écran du jour iPhone et iPad : présents, absents, trous en rouge, arrivées et départs, alertes | Étape 5, partie |
| 7 | **Mode chrono** | démarrage / arrêt d'une tâche sur iPhone, durées réelles enregistrées, cadences réelles du magasin | §7.6, avancé |

**Pourquoi le mode chrono et la qualité à la réception sont avancés** : ce sont les deux sources de **mesure du réel**. Plus elles démarrent tôt, plus le magasin aura accumulé d'observations quand le planning automatique arrivera — ses paramètres seront alors calés sur les **cadences réellement constatées** et non sur des valeurs par défaut.

**Priorité 2 – après la prise de poste**

- **Moteur de planning automatique** (§9.3) : vacations candidates, postes clés, scores, recherche locale, polyvalence entre rayons, déterminisme ; scénarios et comparaison ; batterie de tests légaux complète.
- Congés et absences (§12) avec le circuit de suivi ; remplacements et intérim (module 8).
- Heures, majorations, export des éléments variables de paie (§11) ; anticipation 12 semaines (§9.5) ; apprentissage et recalage des paramètres (§7.7).
- Modules 9 à 15 : recrutement et intégration, compétences et formations, suivi individuel, sécurité, communication, pilotage et rapports, documents, import « Rayons frais ».

**Ce que cette priorisation implique d'accepter** : de la prise de poste jusqu'à la livraison du générateur, les plannings sont **construits à la main**. L'application ne les propose pas, mais elle les **vérifie** (règles légales, couverture du besoin, équité), **explique les trous** et **trace leur circuit de validation**. C'est le compromis assumé de cette priorisation.

### 16.2 Décomposition en étapes (référence du contenu)

La liste ci-dessous est la décomposition d'origine du projet. Elle reste la **référence du contenu** de chaque module ; c'est la **priorisation 16.1 qui fixe l'ordre de réalisation**.

- **Étape 0 – Socle** : PWA installable (manifest, service worker, icônes), structure du projet, Vite + TypeScript + Vitest, déploiement automatique, navigation, thème, verrouillage, données de démo. *Critère : installable sur iPad, fonctionne hors ligne.*
- **Étape 1 – Paramétrage** (module 1) + **modèle fruits et légumes complet** + **courbe de besoin** du jour/semaine. *Critère : besoin F&L calculé et affiché par tranche, décomposé par bloc, tests du moteur.*
- **Étape 2 – Équipe** (module 2) + modèles des autres rayons.
- **Étape 3 – Moteur de planning** + règles + vue planning + ajustement manuel + indicateurs + explications + **circuit de suivi des plannings** (§9.6) + **PDF d'affichage équipe** conforme à §15. *Critère : batterie de tests (repos, durées, temps partiels, compétences, équité, cas impossibles) ; zéro infraction sur les jeux de test ; aucune information interne dans le PDF.*
- **Étape 4 – Firebase** (compte, synchro iPad/iPhone/Mac, hors ligne, règles de sécurité) + sauvegarde/restauration.
- **Étape 5 – Aujourd'hui + absences imprévues / remplacements + congés et absences**, avec le **circuit de suivi appliqué aux congés** (§9.6).
- **Étape 6 – Heures + export paie + anticipation 12 semaines + mode chrono + qualité réception.**
- **Étape 7 – Compétences, formations, suivi individuel, recrutement, intégration, sécurité**, avec le **circuit de suivi appliqué aux recrutements** (§9.6).
- **Étape 8 – Pilotage, rapports PDF à remettre au patron, communication, documents, import Rayons frais.**

Objectif : la **priorité 1 de §16.1** opérationnelle avant la prise de poste (début novembre 2026) ; la priorité 2 ensuite, sans date imposée.
