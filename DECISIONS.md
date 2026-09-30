# Décisions prises sans validation préalable

Ce fichier recense les choix faits pendant la construction continue, quand le
cahier des charges ne tranchait pas. Chaque décision indique **ce qui a été
choisi**, **pourquoi**, et **l'alternative possible** si vous préférez revenir
dessus lors de la relecture finale.

Rien ici n'est définitif : tout est réversible tant que l'application n'est pas
en service.

---

## Socle technique

### D-01 — React pour l'interface
**Décision.** L'interface est construite avec React.
**Raison.** Le cahier des charges impose TypeScript + Vite mais ne dit rien de
l'outil d'affichage. React est le plus répandu, donc le mieux documenté, avec
des bibliothèques prêtes pour le tactile, le glisser-déposer et le PDF.
**Alternative.** Svelte (moins de code, écosystème plus restreint) ou aucun
outil (beaucoup plus de code à écrire et à maintenir).
**Validé par Arnaud le 30 septembre 2026.**

### D-02 — Routage par dièse (`#/planning`)
**Décision.** Les adresses internes utilisent un dièse.
**Raison.** GitHub Pages ne sait pas rediriger une adresse profonde vers
l'application : sans dièse, actualiser la page sur `/planning` donnerait une
erreur 404.
**Alternative.** Une page `404.html` qui redirige — plus fragile, et sans effet
hors ligne.

### D-03 — Publication conditionnée aux tests
**Décision.** GitHub Actions ne met le site à jour que si les types sont
corrects **et** si tous les tests passent.
**Raison.** Rendre impossible la mise en ligne d'une version cassée.
**Alternative.** Publier systématiquement et corriger après coup.
**Validé par Arnaud le 30 septembre 2026.**

---

## Navigation

### D-04 — Choix de la disposition sur la largeur *et* la hauteur
**Décision.** Le menu latéral apparaît à partir de 768 points de large **et**
600 points de haut ; en dessous, c'est la barre d'onglets.
**Raison.** Un iPhone couché fait plus de 768 points de large mais moins de 450
de haut : la seule largeur l'enverrait sur le menu latéral, inutilisable.
**Alternative.** Se fonder sur la largeur seule, ou détecter le type d'appareil
(peu fiable).

### D-05 — Quatre onglets sur iPhone
**Décision.** Aujourd'hui, Planning, Équipe, Besoin en onglets ; tous les autres
modules derrière le bouton « Plus ».
**Raison.** Demandé par Arnaud le 30 septembre 2026.
**Alternative.** Cinq onglets sans bouton « Plus » (impossible : douze modules).

### D-06 — Ajout des modules Communication et Documents à la navigation
**Décision.** Les modules 13 (Communication) et 15 (Documents) du cahier des
charges ont reçu leur entrée de menu, portant le total à douze.
**Raison.** Arnaud a cité « Documents » parmi les modules du bouton « Plus » ;
Communication n'avait, lui non plus, aucune place dans la navigation.
**Alternative.** Fondre Communication dans Pilotage, et Documents dans
Paramètres.

---

## Verrouillage

### D-07 — Face ID vérifié localement, sans serveur
**Décision.** L'application demande à l'appareil de reconnaître son
propriétaire, puis fait confiance à sa réponse.
**Raison.** Il n'y a pas encore de serveur pour vérifier la signature. C'est un
verrou d'écran, présenté comme tel partout dans l'application.
**Alternative.** Attendre Firebase (lot 4) pour proposer Face ID — mais Arnaud
l'a demandé tout de suite.
**À revoir au lot 4** : la vérification devra passer côté serveur.

### D-08 — Le code est toujours défini avant Face ID
**Décision.** Impossible d'activer Face ID sans avoir d'abord choisi un code.
**Raison.** Sans code, un échec de reconnaissance enfermerait dehors.
**Alternative.** Face ID seul, avec remise à zéro complète en cas d'échec.

---

## Lot 2 — Paramétrage et moteur de besoin

### D-09 — Les données vivent sur l'appareil jusqu'au lot 4
**Décision.** Réglages, saisies de qualité et météo sont enregistrés dans le
stockage du navigateur, sur chaque appareil séparément.
**Raison.** Firebase arrive au lot 4 et demande votre intervention (créer le
projet). Attendre aurait bloqué tous les lots intermédiaires.
**Conséquence.** Ce que vous réglez sur l'iPad n'apparaît pas encore sur
l'iPhone. La structure de données est déjà celle qui partira vers Firebase.
**Alternative.** Ne rien enregistrer avant le lot 4.

### D-10 — Répartition uniforme du travail dans une plage horaire
**Décision.** Les minutes d'un bloc sont réparties à parts égales sur sa plage.
Exemple : 2 h de mise en place sur 05:30–08:30 donnent 20 min par tranche.
**Raison.** Le cahier des charges ne décrit aucune courbe à l'intérieur d'une
plage. La répartition uniforme est la plus simple à régler : il suffit de
resserrer la plage pour concentrer le travail.
**Alternative.** Une courbe de charge par bloc (début intense puis décroissant),
plus réaliste mais avec beaucoup plus de réglages à saisir.

### D-11 — Le coefficient de qualité est une moyenne pondérée du jour
**Décision.** Les qualités saisies à la réception sont moyennées en pondérant
par les quantités. Sans aucune saisie, la qualité A est supposée.
**Raison.** Le cahier prévoit un coefficient par produit ; les blocs, eux,
travaillent sur le rayon entier. La moyenne pondérée est la traduction fidèle.
**Alternative.** Un coefficient par produit et par bloc — beaucoup plus précis,
mais il faudrait rattacher chaque produit à un bloc.

### D-12 — Chaque bloc déclare les coefficients qu'il subit
**Décision.** Un bloc porte la liste des coefficients qui l'affectent (saison,
météo, événement, promotion, qualité). Le nettoyage du soir ne dépend pas de la
météo ; la mise en place dépend de la qualité des arrivages.
**Raison.** Appliquer tous les coefficients à tous les blocs fausserait le
calcul. C'est réglable bloc par bloc depuis l'écran Paramètres.
**Alternative.** Un coefficient global pour tout le rayon.

### D-13 — La capacité du laboratoire alerte mais ne limite pas
**Décision.** Quand un bloc de transformation demande plus de postes qu'il n'en
existe, l'application le signale mais ne réduit pas le travail.
**Raison.** Réduire silencieusement le travail cacherait le problème. Vous devez
voir que la plage est trop courte ou qu'il manque un poste.
**Alternative.** Étaler automatiquement le travail au-delà de la plage.
**À revoir** si cela devient gênant à l'usage.

### D-14 — Coefficients de démonstration pour les fruits et légumes
**Décision.** Qualité A 1,0 / B 1,3 / C 1,8 (valeurs du cahier des charges).
Météo : très chaud ×1,30, pluie ×0,85. Saison : ×1,30 en juillet-août, ×0,85 en
janvier-février. Promotion ×1,25.
**Raison.** Le cahier ne donne que les coefficients de qualité. Les autres sont
des ordres de grandeur plausibles, à recaler avec le mode chrono.
**Alternative.** Partir de 1,0 partout et tout mesurer — mais la démonstration
n'aurait rien montré.
**À relire en priorité** : ces chiffres vous appartiennent.

### D-15 — Saisie de la qualité placée sur l'écran Besoin
**Décision.** La saisie « produit, quantité, qualité » est dans l'écran Besoin,
juste au-dessus de la courbe.
**Raison.** On voit l'effet immédiatement : c'est ce que demande le cahier
(« besoin du jour recalculé immédiatement »).
**Alternative.** Un écran dédié, atteignable en un geste depuis l'accueil de
l'iPhone — à faire au lot 6 avec le mode chrono.

### D-16 — Les six autres rayons attendent le lot 3
**Décision.** Seul le rayon fruits et légumes a un modèle complet.
**Raison.** C'est le rayon pilote désigné par le cahier des charges, et le plus
détaillé. Les blocs comptoir, plan de cuisson et format de livraison, propres
aux autres rayons, arrivent au lot 3.
**Alternative.** Modéliser sommairement les sept rayons d'emblée.

---

## Lot 3 — Équipe et modèles des autres rayons

### D-17 — Trois nouveaux types de blocs
**Décision.** Ajout des blocs **comptoir** (clients × part du rayon × temps par
client), **plan de cuisson** (fournées × durée) et **format de livraison**
(quantité reçue × temps unitaire).
**Raison.** Ce sont les trois formules que le cahier des charges décrit pour la
boucherie, la marée et la boulangerie, absentes du modèle fruits et légumes.
**Alternative.** Les représenter avec des tâches fixes — beaucoup moins précis.

### D-18 — Présence minimum portée par le bloc, pas seulement par le rayon
**Décision.** Un bloc peut exiger sa propre présence minimum. Le comptoir
boucherie exige un boucher dès qu'il est ouvert, même sans client.
**Raison.** Le cahier l'exige explicitement (« au moins 1 boucher qualifié
quand le comptoir est ouvert »). Une présence minimum au niveau du rayon seul
ne saurait pas l'exprimer.
**Alternative.** Une présence minimum unique par rayon.

### D-19 — Budgets d'heures calés sur les modèles
**Décision.** Les budgets de démonstration ont été recalculés d'après le besoin
que produisent les modèles, avec environ 10 % de marge.
**Raison.** Des budgets inventés au hasard affichaient des dépassements partout
et rendaient la démonstration illisible.
**Alternative.** Garder des budgets arbitraires.
**À relire en priorité** : ce sont vos vrais budgets qui comptent.

### D-20 — Les comptoirs sont comptés séparément ⚠️ *corrigée, voir C-05*
**Décision.** Chaque comptoir (boucherie, marée, charcuterie, fromage,
boulangerie) exige sa propre présence minimum toute la journée d'ouverture.
**Conséquence.** Le besoin calculé pour le fromage et la charcuterie est élevé
(plus de 100 h par semaine chacun), car l'application suppose deux comptoirs
tenus en permanence.
**En pratique**, ces deux comptoirs partagent souvent la même personne. Le
moteur de planning saura l'exprimer (polyvalence entre rayons), mais le besoin
calculé rayon par rayon, lui, ne le peut pas.
**Alternative.** Regrouper charcuterie et fromage en un seul rayon.
**À relire** : c'est le point le plus discutable de la modélisation.

### D-21 — Alertes calculées, jamais stockées
**Décision.** Les alertes sont recalculées à chaque affichage à partir des
fiches, au lieu d'être enregistrées.
**Raison.** Impossible d'avoir une alerte périmée ou oubliée : ce qui est
affiché reflète toujours l'état réel des fiches.
**Alternative.** Une liste d'alertes enregistrée, qu'on pourrait marquer comme
lue — utile plus tard, mais source d'incohérences.

### D-22 — Préavis par défaut des alertes
**Décision.** Période d'essai 21 jours, fin de contrat 45 jours, habilitation
60 jours, seuil d'urgence 7 jours. Tous réglables depuis l'écran Alertes.
**Raison.** Le cahier des charges demande des alertes anticipées sans fixer de
délai. Ces valeurs laissent le temps d'agir.
**Alternative.** D'autres délais — c'est un simple réglage.

### D-23 — Vingt collaborateurs fictifs
**Décision.** L'équipe de démonstration compte 20 personnes réparties sur les
sept rayons, avec des contrats variés (CDI, CDD, apprenti, étudiants,
temps partiels) et des indisponibilités déclarées.
**Raison.** Le cahier demande 15 à 25 collaborateurs fictifs. La variété permet
de tester le moteur de planning sur des cas réalistes.
**RGPD.** Prénoms courants et initiales tirées au hasard : ils ne désignent
personne. Aucune donnée réelle.

---

## Lot 5 — Contrôle légal du planning

### D-24 — Un contexte unique pour toutes les règles
**Décision.** Les règles reçoivent désormais un objet unique contenant les
vacations, les paramètres, les collaborateurs, l'historique, la date de
publication et les heures supplémentaires déjà consommées — au lieu des deux
arguments de départ.
**Raison.** La moitié des règles du §8 ont besoin du contrat (temps partiel,
jeunes travailleurs) ou de l'historique (moyenne sur douze semaines). Sans ce
contexte, il aurait fallu une signature différente par règle.
**Conséquence.** C'est une réécriture de l'ossature du moteur de règles,
signalée ici comme le demandent les consignes permanentes. Les 12 règles et
leurs 62 tests fonctionnent sur ce modèle.
**Alternative.** Des signatures multiples, plus difficiles à faire évoluer.

### D-25 — « Moins de 18 ans » plutôt que la date de naissance
**Décision.** La fiche porte un simple oui/non, pas de date de naissance.
**Raison.** C'est la donnée minimale suffisante pour appliquer les règles
protectrices (repos de 12 h, 8 h par jour, pas de nuit). Le RGPD impose de ne
collecter que le nécessaire.
**Conséquence.** Il faudra décocher la case le jour des 18 ans. Une alerte
pourra le rappeler plus tard.
**Alternative.** Enregistrer la date de naissance et calculer — plus pratique,
mais c'est une donnée personnelle de plus dans un dépôt public.

### D-26 — Repos hebdomadaire : les 24 heures visibles suffisent ❌ *ANNULÉE, voir C-01*
**Décision.** Un repos qui commence dans la semaine et se poursuit après le
dimanche soir compte comme suffisant dès lors qu'il atteint déjà 24 h avant la
fin de la semaine.
**Raison.** Sans cette nuance, une semaine finie le samedi à 13 h avec un
dimanche de repos serait signalée à tort (34 h 40 visibles au lieu de 35 h),
alors que le repos réel dépasse 40 h. À l'inverse, sept jours travaillés
d'affilée restent bien signalés : aucun repos de 24 h n'y apparaît.
**Alternative.** Une fenêtre glissante de sept jours, plus exacte mais qui
exige de connaître les semaines voisines.

### D-27 — Une règle ne se déclenche que sur un manquement constaté ⚠️ *corrigée, voir C-02*
**Décision.** Quand l'application ignore ce qui précède une semaine, elle ne
suppose pas le pire : elle ne signale rien.
**Raison.** Un contrôle qui crie au loup sur des données incomplètes finit par
être ignoré. Mieux vaut manquer un cas limite que discréditer tous les autres.
**Alternative.** Signaler par précaution — beaucoup de fausses alertes.

### D-28 — Durée minimale du temps partiel : un contrôle de contrat
**Décision.** Les 24 h hebdomadaires minimales sont vérifiées sur le contrat,
séparément du planning, et sortent en **avertissement**, pas en blocage.
**Raison.** C'est une caractéristique du contrat, pas du planning. Et les
dérogations sont fréquentes et légales (demande écrite du salarié, cumul
d'emplois, études).
**Alternative.** Une règle bloquante — elle empêcherait de planifier des
personnes parfaitement en règle.

### D-29 — Le travail de nuit est signalé, pas interdit
**Décision.** Le franchissement du seuil de 270 h de nuit par an produit un
avertissement expliquant que le statut de travailleur de nuit s'applique.
**Raison.** Travailler la nuit n'est pas illégal. Ce qui compte, c'est que le
statut, ses majorations et son suivi médical ne soient pas oubliés.
**Alternative.** Ne rien signaler — le statut passerait inaperçu.

### D-30 — Un planning par semaine, pour tout le service
**Décision.** Le planning est l'objet « semaine », commun aux sept rayons.
Chaque vacation porte son rayon.
**Raison.** C'est ce que vous soumettez à votre patron : « le planning de la
semaine 45 », pas sept documents séparés. Le circuit de suivi porte donc sur la
semaine entière.
**Alternative.** Un planning par rayon et par semaine — sept circuits de suivi
à tenir en parallèle.

### D-31 — Construction au toucher, pas au glisser-déposer
**Décision.** On touche une case de la grille, puis on choisit un horaire type
(ou « Repos » pour vider la case).
**Raison.** Le glisser-déposer est agréable mais fragile au doigt, et
inutilisable au clavier. Le toucher fonctionne partout, iPad comme Mac.
**Alternative.** Le glisser-déposer prévu au cahier des charges — à ajouter
plus tard, en plus du toucher, pas à la place.

### D-32 — La couverture compte la présence, pas le travail effectif ⚠️ *corrigée, voir C-03*
**Décision.** Une personne présente couvre la tranche entière ; sa pause est
déduite de son temps de travail, pas de sa présence.
**Raison.** L'application ne place pas les pauses à la minute près. Compter la
pause comme une absence creuserait des trous fictifs.
**Alternative.** Positionner chaque pause — beaucoup de saisie pour peu de gain.

### D-33 — Les règles légales sont enregistrées avec vos données
**Décision.** Les paramètres des règles font partie de l'état de
l'application, au même titre que les rayons ou les collaborateurs.
**Raison.** Le cahier des charges exige qu'ils soient modifiables. Les garder
dans le code les aurait figés.
**Conséquence.** Ils partiront vers Firebase avec le reste, et l'écran qui
permet de les modifier arrive avec le lot suivant.

### D-34 — Les PDF passent par l'impression du navigateur
**Décision.** Les documents sont produits par la fenêtre d'impression de
Safari (« Imprimer » → « PDF »), et non par une bibliothèque PDF embarquée.
**Raison.** Trois avantages : l'aperçu à l'écran **est** le document final,
comme l'exige le cahier des charges ; aucune bibliothèque lourde à charger, ce
qui préserve le fonctionnement hors ligne ; et sur iPad, l'enregistrement en
PDF et l'envoi par courriel sont déjà intégrés au système.
**Conséquence.** La mise en page dépend un peu du navigateur. Le format est
fixé en A4 paysage.
**Alternative.** Une bibliothèque PDF (jsPDF, pdfmake) : contrôle au millimètre,
mais plusieurs centaines de kilooctets à charger et un aperçu qui peut différer
du résultat.

### D-35 — Trois tests garantissent l'étanchéité des documents
**Décision.** Des tests automatiques vérifient qu'aucun statut de suivi,
aucune remarque du patron, aucun historique et aucun réglage technique ne
figure sur un document imprimé — y compris quand une remarque a été saisie
juste avant.
**Raison.** C'est une règle absolue du projet. Une règle qui n'est pas testée
finit toujours par être enfreinte par accident.

---

## Lot 6 — Écran du jour et remplacements

### D-36 — Les absences n'enregistrent que le type et les dates
**Décision.** Aucun champ de commentaire sur une absence. Sept types : congé
payé, RTT, maladie, absence autorisée, formation, accident du travail, autre.
**Raison.** RGPD. « Maladie » suffit à organiser le travail ; la nature de la
maladie ne regarde pas l'employeur. Un champ libre finirait tôt ou tard par
contenir ce qu'il ne devrait pas. L'écran le rappelle au moment de la saisie.
**Alternative.** Un commentaire libre — pratique, mais c'est exactement le
genre de champ qui fait basculer un fichier du côté interdit.

### D-37 — Un remplaçant n'a pas à savoir tout faire ⚠️ *corrigée, voir C-04*
**Décision.** Une personne n'est écartée que si elle n'est autonome sur
**aucune** des compétences manquantes du créneau. Ce qu'elle ne couvre pas
apparaît en réserve, et le classement favorise qui en couvre le plus.
**Raison.** Exiger d'une seule personne toutes les compétences du rayon
écartait dix-neuf collaborateurs sur vingt : la liste de remplaçants était
toujours vide. Un remplacement se fait rarement à l'identique.
**Alternative.** Exiger toutes les compétences — inutilisable en pratique.

### D-38 — Le classement des remplaçants explique toujours ses choix
**Décision.** Chaque proposition affiche ses atouts et ses réserves ; chaque
personne écartée affiche le motif exact.
**Raison.** Le cahier des charges veut une proposition, pas une décision. Sans
explication, il serait impossible de contester le classement — donc impossible
de lui faire confiance.

### D-39 — Une absence rend la personne invisible, sans effacer sa vacation
**Décision.** Déclarer une absence retire la personne des présents et découvre
le rayon, mais sa vacation reste au planning jusqu'à ce qu'un remplaçant soit
choisi.
**Raison.** C'est ce qui permet de lister « les vacations à remplacer ». Effacer
la vacation ferait disparaître le problème au lieu de le montrer.

---

## Lot 7 — Mode chrono

### D-40 — Le chrono ramène les mesures à une qualité normale
**Décision.** Une mesure prise sur de la marchandise de qualité B ou C est
divisée par le coefficient de qualité avant d'entrer dans la moyenne.
**Raison.** Sans cela, chronométrer une semaine de mauvaise marchandise
dégraderait durablement la cadence de référence, et le modèle surestimerait le
besoin toute l'année.
**Alternative.** Ne chronométrer que les jours normaux — peu réaliste au rayon.

### D-41 — Recalage progressif, jamais brutal
**Décision.** Le paramètre proposé vaut 80 % de l'ancien plus 20 % de la
mesure, et rien n'est proposé avant **trois mesures** ni pour un écart
inférieur à **5 %**. Rien n'est appliqué sans votre validation.
**Raison.** C'est exactement le lissage prévu au §7.7 du cahier des charges.
Une journée exceptionnelle ne doit pas bouleverser le modèle.
**Alternative.** Appliquer la mesure telle quelle — le modèle deviendrait
instable et perdrait votre confiance.

### D-42 — Tous les blocs ne se chronomètrent pas
**Décision.** Le recalage ne s'applique qu'aux blocs mesurables à l'unité :
mise en place, réception, tri, facing, contrôle des dates, nettoyage, plan de
cuisson, format de livraison, tâches fixes. Le réassort, le comptoir, les
balances et la transformation en sont exclus.
**Raison.** Leur durée ne dépend pas d'une quantité unique mais du nombre de
clients présents ou d'une liste de produits. Les chronométrer donnerait un
chiffre sans signification.
**Alternative.** Tout chronométrer — des recalages faux.

### D-43 — Le mode chrono est placé sur l'écran Besoin
**Décision.** Le chrono est en bas de l'écran Besoin, sous la courbe.
**Raison.** C'est ce qu'il alimente : on mesure, et l'on voit immédiatement
l'effet sur le besoin. Sur iPhone, l'écran est atteignable en deux touches.
**Alternative.** Un écran dédié, atteignable en une seule touche depuis
l'accueil — à envisager si l'usage au rayon le demande.


---

# Corrections demandées après relecture (30 septembre 2026)

## C-01 — Repos hebdomadaire : 35 heures, sans aucune tolérance ❗
**Ce qui n'allait pas.** J'avais accepté qu'un repos débordant sur la semaine
suivante compte dès 24 h visibles, en supposant que les 11 h de repos quotidien
suivraient. **C'était un assouplissement d'une règle légale, et il est annulé.**

**Ce qui s'applique désormais.** Le repos hebdomadaire est mesuré **réellement**,
d'une vacation à la suivante, en utilisant les semaines voisines. 33 h restent
33 h, même si elles couvrent un dimanche entier.

Un repos est rattaché à la **semaine où il commence** : le repos qui précède le
premier jour travaillé appartient à la semaine d'avant. Sans cette précision,
l'incertitude sur la semaine précédente masquait de vraies infractions.

**Cas de test ajouté** — celui que vous avez donné : fin samedi 20 h 30, reprise
lundi 5 h 30 = **33 h** → infraction bloquante.

**Deux autres contrôles ajoutés dans la foulée :**
- **Six jours maximum par semaine civile** (L3132-1). Travailler sept jours est
  interdit en soi, indépendamment de la durée des repos. Cinq jours pour les
  moins de 18 ans.
- **48 h consécutives** de repos hebdomadaire pour les moins de 18 ans (L3164-2),
  au lieu de 35 h.

## C-02 — Données incomplètes : « à confirmer », ni alerte ni validation
**Ce qui s'applique.** Une troisième mention existe désormais, à côté de
« bloquante » et « avertissement » : **« à confirmer »**, affichée en gris et en
pointillés, sans couleur d'alarme et sans compter comme une infraction.

Elle apparaît quand l'application ne peut **pas** se prononcer — typiquement un
repos hebdomadaire dont on ignore quand le travail reprend, parce que la semaine
suivante n'est pas encore construite. Elle disparaît d'elle-même dès que la
semaine voisine est renseignée.

**Le principe est donc inversé** par rapport à D-27 : on ne valide plus
silencieusement ce qu'on ne peut pas vérifier.

## C-03 — La pause est positionnée, et creuse la couverture
**Ce qui s'applique.** Chaque horaire type porte désormais une **heure de début
de pause** (par défaut 09 h 00 le matin, 10 h 30 en journée, 17 h 00
l'après-midi), réglable dans Paramètres. Une personne **en pause ne couvre plus
son rayon**.

**Seuil retenu :** une tranche de 30 minutes est comptée non couverte dès que la
pause en occupe la moitié ou plus. Sans ce seuil, une pause de 20 minutes à
cheval sur deux tranches en aurait fait perdre soixante.

Une vacation dont la pause n'est pas positionnée continue de voir sa pause
déduite du temps de travail, sans creuser la couverture : on ne sait pas quand
elle tombe.

## C-04 — Compétences critiques : aucune tolérance
**Ce qui s'applique.** Un bloc peut déclarer des **compétences critiques** :
sans elles, le poste ne peut pas être tenu. C'est le cas du comptoir boucherie
(`boucherie`), de l'étal marée (`marée`), et des comptoirs charcuterie et
fromage.

**Un remplaçant qui n'a pas une compétence critique est écarté, sans
discussion**, quels que soient ses autres atouts. Le motif l'indique :
« n'est pas autonome en boucherie, indispensable pour tenir ce poste ».

Pour les compétences non critiques, la souplesse de D-37 est conservée, mais
**deux listes séparées** apparaissent désormais :
- **« Remplaçants possibles »** — ils couvrent tout le poste ;
- **« Renforts possibles — ils ne couvrent qu'une partie du poste »**, avec le
  bouton « Choisir quand même » et la liste de ce qu'ils ne couvrent pas.

Les compétences critiques se règlent bloc par bloc dans Paramètres.

## C-05 — Comptoir partagé entre deux rayons
**Ce qui s'applique.** Un comptoir peut déclarer qu'il est **tenu avec celui
d'un autre rayon**. Il apporte alors sa charge de travail, mais **n'exige
personne de plus** : la présence minimum est assurée dans l'autre rayon.

C'est réglé ainsi dans la démonstration : le **comptoir fromage est tenu avec
celui de la charcuterie**. Le besoin du fromage passe de 105 h à **95,5 h** par
semaine, ce qui correspond à la réalité d'une personne pour deux vitrines.

Pour les séparer, il suffit de retirer le partage dans le modèle du rayon.

---

# Audit complet des règles légales (30 septembre 2026)

Vous m'avez demandé de vérifier qu'aucune autre règle n'avait été assouplie.
J'en ai trouvé **quatre**, toutes corrigées.

## C-06 — La pause se compte sur la JOURNÉE, pas sur chaque vacation ❗
**Ce qui n'allait pas.** Je vérifiais la pause vacation par vacation. Deux
vacations de 3 h 30 dans la même journée font **7 h de travail** et ouvrent
droit à la pause — mais aucune ne dépassait six heures prise isolément, donc
**rien n'était signalé**. C'était un trou réel.

**Ce qui s'applique.** Le contrôle porte sur le **temps de travail quotidien**
(c'est le texte même de L3121-16), et additionne les pauses déclarées de la
journée.

**Interprétation retenue, la plus protectrice :** une **coupure** entre deux
vacations **n'est pas comptée comme une pause**. La pause doit être accordée
pendant le temps de travail et figurer comme telle au planning.

**Ajouté :** 30 minutes dès 4 h 30 pour les moins de 18 ans (L3162-3).

## C-07 — Moyenne sur douze semaines CIVILES consécutives ❗
**Ce qui n'allait pas.** Je prenais « les douze dernières semaines contenant du
travail ». Les semaines de congés, absentes des données, étaient **sautées** :
douze semaines pouvaient en couvrir vingt, et la moyenne était faussée.

**Ce qui s'applique.** Le calendrier est parcouru semaine après semaine, en
comptant **zéro** pour celles où rien n'est prévu. Douze semaines civiles
consécutives, comme l'exige L3121-22.

## C-08 — Les heures complémentaires ne peuvent atteindre la durée légale
**Ce qui manquait.** Je contrôlais le plafond de 10 % au-dessus du contrat, mais
pas l'interdiction absolue de L3123-9 : les heures complémentaires ne peuvent
**jamais** porter un temps partiel au niveau de la durée légale (35 h). Au-delà,
le contrat devrait être requalifié en temps plein.

**Ce qui s'applique.** Un temps partiel planifié à 35 h ou plus est désormais
signalé, indépendamment du plafond de 10 %.

## C-09 — Plus aucune dispense silencieuse pour les étudiants
**Ce qui n'allait pas.** Les contrats étudiants et apprentis sous 24 h par
semaine étaient **écartés du contrôle sans rien afficher**.

**Ce qui s'applique.** Le constat est affiché pour tout le monde. Pour les
étudiants et les apprentis, l'explication rappelle qu'une dérogation existe
**mais qu'elle doit figurer par écrit**. Signaler vaut mieux que supposer.

## Règles vérifiées et déjà strictes

| Règle | Vérification | Verdict |
|---|---|---|
| **10 h par jour** | Travail effectif, dépassement signalé dès la minute | ✅ strict |
| **48 h par semaine** | Semaine civile, travail effectif | ✅ strict |
| **Repos quotidien 11 h** | Mesuré entre la fin d'un jour et le début du suivant ; les coupures d'une même journée relèvent du temps partiel, pas du repos quotidien | ✅ strict |
| **Coupures des temps partiels** | Nombre et durée, paramétrables | ✅ strict |
| **Délai de prévenance** | Jours ouvrés, dimanche exclu | ✅ strict |
| **Travail de nuit** | Signalé, jamais interdit — travailler la nuit est légal | ✅ correct |
| **Moins de 18 ans** | 8 h/jour, 35 h/semaine, repos 12 h, 2 jours consécutifs, pas de nuit, pause à 4 h 30 | ✅ complété |

**Le moteur applique désormais 13 règles** (contre 12), couvertes par
**74 tests**.

## C-10 — Principe général retenu
Quand un texte se prête à plusieurs lectures, **l'interprétation la plus
protectrice pour le salarié l'emporte**, et elle est notée ici. Quand les
données ne permettent pas de trancher, l'application affiche « à confirmer »
plutôt que de valider par défaut.

---

# Priorité 2

## Lot 8 — Moteur de planning automatique

### D-44 — Le générateur ne peut pas produire un planning illégal
**Décision.** Chaque affectation envisagée est repassée au crible des treize
règles avant d'être retenue. Une affectation qui produirait une infraction
bloquante est rejetée, quel que soit son intérêt par ailleurs.
**Raison.** C'est la garantie centrale demandée par le cahier des charges :
« zéro infraction sur les jeux de test ». Elle est tenue **par construction**,
pas par vérification après coup, et testée sur les sept rayons.
**Conséquence.** Le générateur préfère laisser un trou plutôt que de violer une
règle — et il explique alors pourquoi.

### D-45 — Une seule vacation par personne et par jour
**Décision.** La proposition ne crée jamais de journée coupée.
**Raison.** Une coupure se décide, elle ne se subit pas : c'est une contrainte
lourde pour le salarié, qui relève d'un accord et non d'un calcul.
**Alternative.** Autoriser les coupures pour mieux coller aux pics de midi —
à activer plus tard si vous le souhaitez, jamais par défaut.

### D-46 — Contrôle légal uniquement sur les meilleurs candidats
**Décision.** Tous les candidats sont d'abord classés par intérêt avec des
calculs bon marché ; le contrôle légal, coûteux, n'est lancé que sur les
meilleurs, jusqu'à en trouver un qui passe.
**Raison.** La première version contrôlait tout le monde : **45 secondes** pour
une semaine. La version actuelle met **0,3 seconde** pour les sept rayons, avec
exactement le même résultat.
**Alternative.** Contrôler tout le monde — correct mais inutilisable.

### D-47 — Ce que le générateur ne couvre pas est expliqué, pas masqué
**Décision.** Chaque créneau resté découvert produit une phrase en français,
distinguant « il manque X heures » et « une compétence indispensable reste sans
titulaire ».
**Raison.** Un générateur qui rend un planning incomplet sans rien dire laisse
croire que tout va bien. Sur les données de démonstration, il couvre 64 % du
besoin — non par faiblesse de l'algorithme, mais parce que **l'équipe fictive
de 20 personnes est trop petite pour le besoin modélisé**. C'est exactement le
genre de constat que l'application doit rendre visible.

### D-48 — Poids des contraintes souples
**Décision.** Manque de personnel 20, compétence critique découverte 15, écart
au contrat 6 par heure, sureffectif 4, rayon secondaire 2, équité 1,5,
irrégularité 1, changement par rapport à la semaine précédente 1.
**Raison.** Couvrir le besoin passe avant tout le reste ; l'écart au contrat
pèse ensuite, parce qu'il a des conséquences en paie. Le reste ajuste.
**Alternative.** D'autres équilibres — ce sont des réglages, pas des vérités.
**À relire** : si les plannings proposés ne vous ressemblent pas, c'est ici
qu'il faut regarder.

## Lot 9 — Congés

### D-49 — Le circuit de suivi est devenu un module à part
**Décision.** Le circuit Brouillon → Soumis → Validé / À corriger → Publié vit
désormais dans son propre fichier et sert **à la fois** aux plannings et aux
congés. Les recrutements l'utiliseront aussi.
**Raison.** C'est ce que promettait le cahier des charges : « mécanisme
générique, développé une seule fois ». Le dupliquer aurait garanti que les deux
copies divergent.
**Conséquence.** C'est une réécriture interne, signalée ici comme le demandent
les consignes. L'écran du planning n'a pas changé, et ses tests non plus.

### D-50 — L'ordre des départs ignore la situation de famille
**Décision.** Le classement proposé repose sur l'**ancienneté** puis sur la
**date de la demande**. Le critère légal de la situation de famille est
volontairement absent, et l'écran le dit.
**Raison.** La situation familiale est une donnée **interdite** dans cette
application (§3). La collecter pour classer les départs contredirait la règle
la plus fondamentale du projet.
**Conséquence.** Le classement est **indicatif**. Vous restez libre d'en tenir
compte vous-même, hors de l'application.
**Alternative.** Enregistrer la situation de famille — exclu.

### D-51 — Un congé ne bloque rien tant qu'il n'est pas validé
**Décision.** Seuls les congés au statut **Validé** ou **Publié** sortent la
personne du planning et de la proposition automatique.
**Raison.** Une demande en brouillon est une intention, pas une décision. La
traiter comme acquise ferait disparaître des gens du planning avant que votre
patron n'ait dit oui.

### D-52 — Décompte en jours ouvrables, dimanche exclu
**Décision.** Les congés se comptent en jours ouvrables : le samedi compte, le
dimanche non.
**Raison.** C'est le décompte le plus courant, et celui qui correspond aux
30 jours ouvrables annuels.
**Alternative.** Le décompte en jours ouvrés (samedi exclu, 25 jours par an).
**À vérifier** : regardez sur un bulletin de paie lequel des deux votre magasin
applique. C'est un réglage à ajouter si besoin.
