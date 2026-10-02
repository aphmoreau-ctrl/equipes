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

## Lot 10 — Heures et anticipation

### D-53 — Les jours fériés sont calculés, pas saisis
**Décision.** Les onze jours fériés français sont calculés pour n'importe
quelle année, y compris les fêtes mobiles (Pâques, Ascension, Pentecôte).
**Raison.** Les ressaisir chaque année serait une source d'erreur, et une
erreur sur un férié fausse la paie.
**Précision.** Seul le 1er mai est obligatoirement chômé par la loi. Pour les
autres, l'application **signale** qu'ils sont travaillés ; elle ne décide pas
s'ils devaient l'être.

### D-54 — Les heures supplémentaires se comptent par semaine
**Décision.** Le décompte se fait **semaine par semaine** : 25 % de 35 h à
43 h, 50 % au-delà. Pas de lissage sur le mois.
**Raison.** C'est la règle. Lisser sur le mois ferait disparaître des heures
majorées, au détriment du salarié.
**Réglable** : les deux taux et le seuil se modifient depuis l'écran Heures.

### D-55 — Le réalisé reprend le prévu par défaut
**Décision.** Tant que rien n'est saisi, les heures réalisées valent les heures
prévues. La saisie ne sert qu'à enregistrer les **écarts**.
**Raison.** Ressaisir chaque journée conforme au planning serait un travail
inutile et une source d'oubli.
**À venir** : l'import d'une badgeuse remplacera la saisie manuelle.

### D-56 — L'export CSV, pas le PDF, pour la paie
**Décision.** Les éléments variables s'exportent en CSV, avec point-virgule et
virgule décimale, précédé d'un marqueur d'encodage.
**Raison.** Le CSV s'ouvre dans un tableur et se transmet au cabinet comptable
sans ressaisie. Un PDF obligerait à tout retaper.
**Contenu** : prénom, initiale, heures et compteurs. Rien d'autre.

### D-57 — L'anticipation est sur l'écran Planning
**Décision.** Les douze semaines à venir s'affichent en bas du planning, pas
dans un module séparé.
**Raison.** C'est au moment de construire un planning qu'on veut savoir si le
mois prochain tiendra. Séparer les deux écrans, c'est garantir que personne ne
regarde le second.
**Méthode** : capacité = heures des contrats, diminuées à proportion des jours
d'absence connus, nulles avant l'entrée et après la fin de contrat.

## Lot 12 — Pilotage et rapports

### D-58 — Le tableau de bord est personnel, le rapport est public
**Décision.** Deux objets distincts, dans le même écran : un tableau de bord
détaillé **pour vous**, et un rapport PDF **pour le patron**, rendu par un
composant séparé.
**Raison.** C'est la règle absolue du projet. Les séparer dans le code, c'est
rendre impossible la fuite d'un indicateur interne dans un document remis.
**Vérifié par un test** : le rapport ne contient aucun statut, aucune remarque,
aucun historique, aucun réglage technique — même après saisie d'une remarque.

### D-59 — La productivité n'apparaît que si vous saisissez le chiffre d'affaires
**Décision.** Le champ « chiffre d'affaires de la semaine » est facultatif.
Sans lui, la ligne productivité n'existe pas.
**Raison.** Afficher « 0 € par heure » serait faux et inquiétant. Mieux vaut
ne rien dire que dire faux.

### D-60 — Le plan d'actions est déduit, jamais inventé
**Décision.** Chaque action proposée découle d'un indicateur franchi :
règle enfreinte, couverture sous 90 %, budget dépassé, poste fragile,
absentéisme au-dessus de 8 %, plus de 10 heures supplémentaires.
**Raison.** Un plan d'actions qui ne dit pas d'où il vient n'est pas défendable
devant un patron. Chaque ligne se justifie par un chiffre du même document.
**Réglable** : les seuils sont dans le code du moteur, à sortir en paramètres
si vous voulez les ajuster.

## Lot 13 — Communication, documents, recrutement, suivi individuel, sécurité

### D-61 — Recrutement, intégration, entretiens et sécurité sont des sections de l'écran Équipe
**Décision.** Ces quatre modules n'ont pas leur propre entrée de menu : ils
vivent au bas de l'écran Équipe.
**Raison.** Ils parlent tous des mêmes personnes, et y accéder depuis la fiche
est plus naturel que de chercher dans une liste de dix-sept entrées. Le menu en
compte douze, ce qui est déjà beaucoup.
**Alternative.** Des entrées séparées — à faire si l'écran Équipe devient trop
long à parcourir.

### D-62 — Les objectifs d'entretien, jamais les appréciations
**Décision.** La fiche d'entretien ne comporte qu'un champ « objectifs de
travail convenus », et l'écran rappelle la règle sous le champ.
**Raison.** Le cahier des charges interdit les appréciations personnelles. Un
champ nommé « appréciation » ou « bilan » appellerait exactement ce qu'il ne
faut pas écrire.

### D-63 — La sécurité enregistre des dates, jamais des contenus
**Décision.** Les visites médicales sont enregistrées par leur **date**
seulement. Aucun champ ne permet de noter ce qui s'y est dit.
**Raison.** L'état de santé d'un salarié ne regarde pas l'employeur. La date
suffit à prouver que l'obligation est tenue.

### D-64 — Les accidents du travail alertent sur le délai de déclaration
**Décision.** Enregistrer un accident déclenche une alerte urgente rappelant
que la déclaration est due sous 48 heures ouvrables.
**Raison.** C'est un délai court, à conséquences lourdes, facile à laisser
passer dans le feu de l'action.

### D-65 — Les documents sont du texte, pas des fichiers
**Décision.** L'écran Documents enregistre du texte. Pas de PDF, pas de photo.
**Raison.** Stocker des fichiers demande Firebase (lot 4). L'écran le dit
clairement plutôt que de laisser croire que c'est possible.
**À venir** : le stockage de fichiers une fois Firebase en place.

## Lot 14 — Alertes centralisées, recherche, sauvegarde

### D-66 — L'écran Alertes réunit vraiment tout
**Constat.** Jusqu'ici, l'écran Alertes ne montrait que les contrats, les
périodes d'essai, les habilitations et les postes fragiles. Les entretiens
obligatoires et les échéances de sécurité n'apparaissaient qu'au bas de
l'écran Équipe — l'inverse d'une liste « centralisée ».
**Décision.** Une seule fonction rassemble toutes les sources ; l'écran
Alertes et la pastille du menu l'utilisent toutes deux. Le préavis des
entretiens devient réglable depuis l'écran Alertes.

### D-67 — Une pastille rouge ne compte que l'urgent
**Décision.** La pastille du menu (et de l'icône de l'application, quand
l'appareil l'autorise) affiche le nombre d'alertes **« à traiter tout de
suite »**, pas le total.
**Raison.** Un chiffre qui ne descend jamais finit par ne plus être regardé.
**Limite levée (C-16).** Sur iPhone et iPad, la pastille sur l'icône de
l'écran d'accueil n'apparaît que si les notifications sont autorisées pour
l'application. L'autorisation se demande désormais depuis Paramètres →
« Pastille sur l'icône ». La pastille du menu, elle, est toujours là, sans
aucune autorisation.

### D-68 — La recherche est un écran, pas une barre permanente
**Décision.** « Rechercher » est une entrée du menu (sous « Plus » sur
iPhone), qui cherche dans les collaborateurs (nom, poste, rayons,
compétences, habilitations), les rayons, les notes, les documents, les
formations et les besoins de recrutement.
**Raison.** Une barre fixe en haut de chaque écran prendrait de la place sur
iPhone pour un usage occasionnel.
**Alternative.** Une loupe dans l'en-tête de chaque écran.
**Règle.** Majuscules et accents ignorés ; chaque mot tapé doit apparaître ;
les correspondances dans le titre passent en premier.

### D-69 — Sauvegarde sur fichier en attendant Firebase
**Décision.** Paramètres → « Télécharger une sauvegarde » produit un fichier
`equipes-sauvegarde-AAAA-MM-JJ.json`, restaurable sur n'importe quel appareil
après confirmation.
**Raison.** Sans Firebase, toutes les données ne vivent que sur l'iPad : un
appareil perdu, et tout est perdu. C'est aussi le seul moyen, d'ici là, de
passer ses données de l'iPad à l'iPhone.
**Précautions.** Le fichier n'est envoyé nulle part par l'application ; l'écran
rappelle de ne pas le transmettre par e-mail. Un fichier d'une version plus
récente, endommagé ou étranger est refusé avec une explication ; une ancienne
sauvegarde est complétée par les valeurs par défaut des modules apparus depuis.
**Attention.** Ce fichier n'est **pas chiffré** : il doit rester dans un
endroit protégé (Fichiers, iCloud de l'appareil).

## Lot 15 — Vivier de remplaçants et intérim (module 8)

### D-70 — Le vivier est séparé de l'équipe
**Décision.** Intérimaires, étudiants et anciens salariés rappelés ponctuellement
forment un **vivier** distinct des fiches collaborateurs, en section de
l'écran Équipe.
**Raison.** Ils ne sont pas salariés du magasin au sens du planning : ni
contrat hebdomadaire, ni compteurs d'équité, ni congés. Les mêler à l'équipe
fausserait la capacité, l'anticipation, les heures et la paie.
**Contenu (RGPD).** Prénom, initiale, origine, agence, rayons, compétences,
jours habituellement possibles, coût horaire, accord pour être recontacté.
**Aucun téléphone ni adresse** : le contact se fait hors application.

### D-71 — L'équipe d'abord, le vivier ensuite
**Décision.** Sur l'écran du jour, « Trouver un remplaçant » montre d'abord
les collaborateurs internes, puis le vivier extérieur.
**Classement du vivier** : compétences (critère principal), connaissance du
rayon (missions passées), coût (le moins cher à compétence égale), accord
pour être recontacté. Les **compétences critiques** restent sans aucune
tolérance (C-04). Le coût estimé de la vacation est affiché.

### D-72 — Appeler un renfort enregistre une mission
**Décision.** « Appeler » crée une mission datée, reliée à la vacation de
l'absent. La vacation disparaît des « Vacations à remplacer » et le renfort
**compte dans la couverture du jour**. « Annuler » retire la mission.
**Limite assumée.** Le renfort n'entre **pas** dans le contrôle des règles
légales : son employeur (l'agence) en est responsable.
**Limite levée (C-15).** Il figure maintenant aussi dans la grille du planning
de la semaine, en grisé, et sur les documents imprimables — plus seulement sur
l'écran du jour et dans l'historique des missions.

### D-73 — L'intérim entre au tableau de bord et au rapport
**Décision.** Le tableau de bord affiche les heures et le coût des renforts
extérieurs de la semaine ; le rapport au patron les reprend **seulement s'il
y en a eu** (une ligne à zéro n'apporte rien).
**Raison.** Le cahier des charges cite « heures sup et intérim » parmi les
indicateurs, et c'est un chiffre qu'un patron regarde.

### D-74 — Données réelles : jamais de personne fictive ajoutée en douce
**Décision.** Quand une nouvelle collection apparaît (ici le vivier), des
données **réelles** déjà enregistrées la reçoivent **vide** ; seules les
données de démonstration reçoivent les exemples fictifs.
**Raison.** Sans cette précaution, une mise à jour aurait glissé quatre
intérimaires imaginaires dans votre vraie équipe. Vérifié par un test.

## Lot 16 — Scénarios

### D-75 — Le planning en cours est toujours dans la comparaison
**Décision.** Le tableau des scénarios compare les versions enregistrées **et**
le planning en cours, sous le nom « En cours ». Il n'a pas besoin d'être
enregistré pour figurer au tableau.
**Raison.** On compare toujours à ce qu'on a sous la main. Obliger à
l'enregistrer d'abord ajouterait une étape sans intérêt.

### D-76 — Un scénario illégal ne peut jamais être « le mieux placé »
**Décision.** Le classement trie d'abord sur le nombre de règles enfreintes,
puis seulement sur la pénalité globale. Un scénario qui couvre mieux le besoin
mais viole le Code du travail passe derrière un scénario conforme.
**Raison.** La conformité n'est pas un indicateur parmi d'autres : c'est une
condition. Un classement qui mettrait un planning illégal en tête inviterait à
le choisir.

### D-77 — « Retenir » remplace sans filet
**Décision.** Retenir un scénario remplace le planning de la semaine. L'écran
prévient et rappelle d'enregistrer d'abord le planning en cours si l'on veut
pouvoir y revenir.
**Raison.** Un historique complet des plannings alourdirait beaucoup la
structure de données pour un besoin rare. L'enregistrement en scénario joue ce
rôle, explicitement.
**Alternative.** Une annulation générale, à envisager plus tard si cela manque.

## Corrections de finition (1er octobre 2026)

### C-11 — La pastille d'alertes était tronquée
**Ce qui n'allait pas.** « 25 » s'affichait « 2.. » sur la barre d'onglets : la
règle qui raccourcit les libellés pour tenir dans 75 points s'appliquait aussi
à la pastille.
**Corrigé.** La pastille est exclue du raccourcissement, et plafonnée à « 99+ »
au-delà de 99 — au-delà, elle deviendrait plus large que l'onglet.

### C-12 — « Entretien dépassé depuis 4 659 jours » ❗
**Ce qui n'allait pas.** Quand aucun entretien n'était enregistré, l'échéance
était calculée depuis la date d'entrée. Pour quelqu'un entré en 2012, cela
donnait « dépassé depuis 4 659 jours », en rouge, pour toute l'équipe
ancienne. C'était **faux** — l'application ne peut pas savoir ce qui s'est
passé avant qu'elle existe — et surtout, ce bruit aurait fait ignorer toutes
les alertes dès le premier jour.

**Corrigé.** Sans entretien enregistré, l'alerte dit ce qu'elle sait :
« Entretien professionnel à programmer — aucun n'est enregistré depuis l'entrée
du 9 janvier 2012. S'il a déjà eu lieu, enregistrez-le ; sinon, programmez-le. »
En **orange**, pas en rouge. Le compte à rebours en jours ne réapparaît
qu'une fois un premier entretien enregistré.

### C-13 — Les échéances se comptent en mois, pas en paquets de 30 jours
**Ce qui n'allait pas.** Vingt-quatre mois étaient calculés comme 24 × 30 jours,
soit 720 jours au lieu de 730 : une dérive de dix jours, qui s'aggrave sur le
bilan à six ans.
**Corrigé.** Calcul en calendrier réel, avec la règle habituelle : le 31 janvier
plus un mois donne le 28 février, et non le 3 mars.

### C-14 — Mémoire des courbes de besoin
**Ce qui n'allait pas.** L'écran Planning recalculait les 49 courbes de besoin
(7 rayons × 7 jours) à **chaque clic**. Sur le serveur de publication, un test
dépassait même le temps accordé, ce qui bloquait trois publications de suite.
**Corrigé.** Les courbes calculées sont gardées en mémoire, et cette mémoire
n'est vidée que si change une donnée dont le besoin dépend — jamais quand vous
posez une vacation. Le test est passé de 3,5 s à 1,4 s, et l'iPad en profite
autant.

### C-15 — Les renforts extérieurs apparaissent enfin sur le planning
**Ce qui n'allait pas.** On pouvait confier une mission à un remplaçant du
vivier ou à un intérimaire, mais le planning de la semaine ne le montrait pas :
la grille restait creuse, la couverture du besoin l'ignorait, et le document
remis au patron laissait croire à un trou d'effectif qui n'existait pas.
**Corrigé.** Les renforts en mission forment une section « Renforts extérieurs »
en bas de la grille, en grisé, avec leur origine (vivier ou agence). Ils
**comptent dans la couverture du besoin** et figurent sur les deux documents
imprimables.
**Choix volontaire.** Ils restent **en dehors du contrôle des règles légales** :
leur temps de travail, leurs repos et leurs plafonds relèvent de leur employeur
(l'agence), pas du vôtre — l'application ne connaît pas leurs heures ailleurs
et afficherait donc des contrôles faux. La grille le dit en clair sous le
tableau. *Alternative possible :* leur appliquer les mêmes règles qu'aux
salariés du magasin, au prix d'alertes mensongères.

### C-16 — La pastille sur l'icône : une autorisation qu'il faut demander
**Ce qui n'allait pas.** L'application posait le nombre d'alertes sur son icône
d'écran d'accueil sans jamais demander l'autorisation nécessaire sur iPhone et
iPad. Résultat : le chiffre n'apparaissait jamais, sans que rien ne l'explique.
**Corrigé.** Un réglage « Pastille sur l'icône » dans Paramètres, avec un
bouton pour accorder l'autorisation. Il dit noir sur blanc que l'application ne
vous enverra **aucune notification** : l'autorisation ne sert qu'à poser le
chiffre sur l'icône. Si vous avez déjà refusé, il indique le chemin dans les
Réglages de l'appareil (Notifications → Équipes), car un refus ne peut pas être
redemandé.
**Choix volontaire.** La demande ne part **que** d'un appui sur ce bouton,
jamais au lancement : une demande surgie à l'ouverture est refusée neuf fois
sur dix, et ce refus est définitif. La pastille rouge dans le menu de
l'application, elle, fonctionne partout sans aucune autorisation.

### C-17 — L'écran du jour ne crie plus au manque quand le planning reste à faire
**Ce qui n'allait pas.** Tant qu'aucune vacation n'était posée pour la semaine,
l'écran « Aujourd'hui » annonçait « Rayons en manque : 7 sur 7 » et affichait
sept lignes rouges couvrant toute la journée d'ouverture. C'est la première
chose que l'on voit en ouvrant l'application : elle avait l'air en panne, alors
qu'il n'y avait simplement rien d'enregistré.
**Corrigé.** Quand la semaine ne contient aucune vacation, l'écran dit
« Planning de la semaine : pas encore fait », et la couverture explique en une
phrase que le travail reste à faire dans l'écran Planning. Dès qu'une seule
vacation est posée, le décompte des rayons en manque revient. Rien n'est caché :
c'est la même information, dite correctement.

### C-18 — Les nombres s'écrivent à la française
**Ce qui n'allait pas.** Partout dans l'application, les nombres à virgule
s'affichaient à l'anglaise : « 794.5 h nécessaires », « 0.0 h prévues »,
« -10.0 » d'écart au contrat, « ×1.30 » de coefficient. Sur les documents
imprimés remis au patron et à l'équipe aussi.
**Corrigé.** Un seul fichier (`src/domaine/nombres.ts`) met en forme tous les
nombres affichés : « 794,5 h », « 0,0 h », « ×1,30 ». Les 55 affichages de
l'application y passent désormais, documents imprimés compris.
**Détails choisis.** Les écarts sont toujours signés et utilisent le vrai signe
moins (« −28,3 », plus lisible à l'impression que le trait d'union), et un écart
nul ne s'écrit jamais « −0,0 ». Les sommes portent une espace insécable
(« 1 234,50 € ») pour qu'un montant ne soit jamais coupé en fin de ligne.
L'export CSV, lui, garde la virgule décimale **sans** espace de milliers : c'est
ce qu'un tableur français sait relire.

### C-19 — Les dates aussi s'écrivent en français
**Ce qui n'allait pas.** Plusieurs messages affichaient la date telle qu'elle
est stockée : « Fruits et légumes, le 2026-09-28 : il manque encore 7,5 h »,
« 10 h 30 de travail effectif le 2026-11-02 ». Cela concernait les explications
des règles légales, les manques de couverture, les résultats de recherche et le
compte rendu de la proposition automatique.
**Corrigé.** Deux formes, selon ce que la phrase doit porter : à l'intérieur
d'une semaine de planning, la forme courte « samedi 3 octobre », puisque
l'année est déjà connue ; partout ailleurs (échéances, notes, demandes), la
forme complète « samedi 3 octobre 2026 ». Un test vérifie désormais qu'aucune
explication de règle ne laisse passer une date brute.

### C-20 — Le dossier patron donne enfin le total réel de chaque personne
**Ce qui n'allait pas.** Le document est organisé par rayon. Une personne qui
tient deux rayons y figurait donc deux fois, avec deux totaux partiels
(« 33,3 h » puis « 6,7 h ») : son total réel de la semaine n'apparaissait nulle
part, et personne ne pouvait le reconstituer de tête.
**Corrigé.** Un tableau « Total des heures par personne » en fin de dossier :
prénom et initiale, heures du contrat, heures prévues, écart signé. Il ne
figure que sur le dossier remis au patron, pas sur l'affichage équipe, et ne
contient aucune note ni aucun statut — la règle des documents sortants reste
entière.

### C-21 — Expliquer une couverture qui paraît fausse
**Ce qui n'allait pas.** Le tableau de couverture pouvait afficher
« Charcuterie-traiteur : 120,5 h nécessaires, 143,0 h prévues, 91 % ». Un
lecteur y voit une erreur de calcul.
**Corrigé.** Une phrase sous le tableau : la couverture se mesure demi-heure par
demi-heure, un rayon peut donc totaliser plus d'heures que nécessaire et rester
découvert à certains moments. Le chiffre était juste ; il manquait de quoi le
défendre devant le patron.

### C-22 — Un test instable bloquait les publications ❗ (cause non trouvée)
**Ce qui se passe.** Environ une exécution sur dix, le test du panneau
« Plus » de l'iPhone échoue : le panneau se referme à l'instant même où il
vient d'être ouvert, comme si un changement d'écran survenait en même temps
que l'appui. Cela a déjà fait échouer une publication, alors que l'application
elle-même fonctionne.
**Ce qui a été fait.** Deux causes probables ont été corrigées : le test
attendait « une barre de navigation », ce qui correspondait aussi au menu
latéral de l'iPad affiché un instant avant que la taille d'écran ne soit
mesurée ; et la remise à zéro de l'adresse entre deux tests déclenchait un
évènement différé qui arrivait pendant le test suivant. La fréquence a baissé,
sans disparaître.
**Décision assumée.** Un seul réessai automatique est autorisé, pour qu'un aléa
de cette nature ne bloque plus une publication. **Ce réessai masque le défaut,
il ne le corrige pas** : il est commenté comme tel dans la configuration et
devra être retiré dès que la cause sera identifiée. Toute sonde posée dans le
code déplace le problème, ce qui est le propre d'un défaut de synchronisation.
**Alternative écartée.** Supprimer ces quatre tests : ils protègent le menu de
l'iPhone, qui est la navigation principale sur téléphone.

### À FAIRE après le lot 2 — trouver la vraie cause de C-22
Le réessai automatique autorisé en C-22 est un contournement. Après le lot 2
(calcul de la charge et des besoins), reprendre le test instable du panneau
« Plus » de l'iPhone, trouver pourquoi le panneau se referme à l'instant où il
s'ouvre, corriger, puis **retirer `retry: 1` de `vitest.config.ts`**.
Demandé par Arnaud le 2 octobre 2026.

## Lot 0 — Fenêtre « Nouveau collaborateur » (2 octobre 2026)

### D-78 — Rien n'est créé tant que la fenêtre n'est pas enregistrée
**Ce qui changeait.** « Ajouter un collaborateur » créait aussitôt une fiche
« Nouveau X. » dans l'effectif, à corriger ensuite. On saisissait à l'aveugle,
et une fiche vide restait dans l'équipe si l'on changeait d'avis — elle comptait
dans les effectifs et dans les heures.
**Décision.** La fiche n'existe qu'au moment où vous touchez « Enregistrer ».
**Alternative possible :** garder la création immédiate avec une fiche
« brouillon » exclue des calculs — plus compliqué, pour le même résultat.

### D-79 — Un champ « initiale » que la spécification ne demandait pas
**Décision.** La fenêtre comporte un petit champ « Initiale du nom » à côté du
prénom.
**Raison.** Vous avez confirmé le RGPD « prénom + initiale » (« Camille D. »).
Sans ce champ, chaque nouvelle fiche s'appellerait « Noémie » tout court, et
deux Noémie seraient impossibles à distinguer sur un planning affiché.
Il reste **facultatif** : rien ne bloque si vous ne le remplissez pas.

### D-80 — Les dates apparaissent aussi pour l'apprentissage
**Décision.** Les dates de début et de fin s'affichent pour **CDD, Intérim et
Apprenti**, alors que la spécification ne citait que CDD et Intérim.
**Raison.** Un contrat d'apprentissage est à durée déterminée. Sans date de fin,
les alertes de fin de contrat et les contrôles légaux propres aux apprentis
seraient aveugles. **Alternative :** suivre la spécification à la lettre et
saisir la date ensuite dans la fiche.

### D-81 — Les jours de repos fixes sont des journées non disponibles
**Décision.** Les jours cochés L M M J V S D sont enregistrés comme des
disponibilités « non disponible » pour ces jours.
**Raison.** L'application possède déjà cette notion, utilisée par le générateur
de planning et par les contrôles. Créer un second réglage « repos fixe » aurait
fait deux sources de vérité qui peuvent se contredire.

### C-23 — Les boutons verts devenaient illisibles au survol de la souris ❗
**Ce qui n'allait pas.** Découvert en vérifiant la nouvelle fenêtre : au survol
à la souris, **tous** les boutons principaux de l'application (le vert foncé)
repassaient en gris clair tout en gardant leur texte blanc. Le libellé
disparaissait. Sur iPad cela ne se voit pas — au doigt, il n'y a pas de survol —
mais sur Mac, chaque bouton important devenait vide au passage de la souris.
**Cause.** En CSS, la règle de survol commune était plus forte que celle du
bouton principal et reprenait le dessus sur sa couleur de fond.
**Corrigé.** Le bouton principal redonne sa couleur au survol, et s'éclaircit
légèrement pour rester vivant.

## Lot 1b — à faire (demandé par Arnaud le 2 octobre 2026)

### Corrections de règles validées, à appliquer au lot 1b
1. **Travail de nuit des mineurs** : distinguer deux tranches d'âge —
   **moins de 16 ans, interdit de 20 h à 6 h** ; **16 et 17 ans, interdit de
   22 h à 6 h**. Aujourd'hui l'application ne connaît qu'un seul seuil (22 h –
   6 h) et un seul indicateur « mineur ». Il faudra donc distinguer les deux
   tranches sur la fiche, sans jamais enregistrer de date de naissance.
2. **Travail de nuit des adultes** : passer la plage par défaut de
   **21 h – 5 h à 21 h – 6 h** (définition légale), modifiable.
3. **Apprentis** : temps de formation au CFA = temps de travail, donc non
   planifiable (L6222-24). Un apprenti majeur suit les règles des adultes, avec
   cette seule protection en plus.
4. **À signaler « à vérifier » dans l'écran de réglage** : le contingent de
   180 h d'heures supplémentaires, les majorations (dimanche, férié, nuit) et
   le délai de prévenance de 7 jours ouvrés. Arnaud les confirmera avec le
   service paie ; ils restent les valeurs de départ en attendant.

## Lot 1a — Rayons, compétences, catalogue (2 octobre 2026)

### D-82 — Le catalogue existant est enrichi, pas remplacé
**Décision.** Les « blocs » de travail déjà en place deviennent le catalogue de
tâches, enrichis d'un niveau de compétence. Le modèle de volumes reste celui
qui existait : palettes pour une réception, colis pour une mise en rayon,
mètres de linéaire pour un facing, produits pour un laboratoire, unités pour
un drive.
**Raison.** Remplacer par un modèle uniforme « durée fixe ou par unité » aurait
réécrit le moteur de besoin, ses tests, et surtout **changé les courbes de
besoin des plannings déjà saisis**. Un test (`besoins-inchanges.test.ts`) fige
désormais la charge des sept rayons d'origine : si elle bouge, le test casse.
**Alternative possible :** le modèle uniforme, au prix de cette rupture.

### D-83 — Une compétence exigée porte son niveau, et son caractère critique
**Décision.** Une tâche n'exige plus « la boucherie » mais « la boucherie,
niveau 2 ». L'ancienne liste séparée des compétences critiques disparaît : le
caractère critique est maintenant porté par l'exigence elle-même.
**Raison.** Deux listes parallèles finissent par se contredire. Par défaut une
tâche demande le **niveau 2, autonome** ; le niveau 1 est réservé aux tâches
que l'on peut confier à quelqu'un en formation, accompagné.
**Pour information :** quand deux tâches demandent la même compétence à deux
niveaux différents sur la même tranche, c'est **le plus exigeant** qui compte.

### D-84 — Le nom de la compétence est son identifiant
**Décision.** Une compétence n'a pas de code technique : son nom est son
identité (« conseil vins »). Le catalogue est enregistré dans l'application et
modifiable.
**Raison.** Les compétences sont déjà écrites sous forme de noms dans les
tâches et dans les fiches. Introduire des codes aurait exigé de tout
renommer, pour aucun bénéfice visible. **Conséquence à connaître :** renommer
une compétence devra la renommer partout à la fois — ce sera le travail de
l'écran de réglage, au lot 1b.

### D-85 — Chaque fiche ne propose que les compétences de ses rayons
**Décision.** La fiche d'une personne des fruits et légumes ne propose plus les
compétences de boucherie. Elle propose celles de son rayon principal, celles de
ses rayons d'appui, les compétences communes (hygiène, nettoyage, réception…),
et **toutes celles qu'elle possède déjà**, même hors de ses rayons.
**Raison.** La liste était la même pour tout le monde et s'allongeait à chaque
ajout. Une compétence déjà notée ne disparaît jamais : changer quelqu'un de
rayon ne doit pas effacer ce qu'il sait faire.

### D-86 — Horaires propres à la cave et au drive
**Décision.** La cave ouvre à 9 h 30, le drive à 9 h : ni l'un ni l'autre ne
suit les horaires du frais. Le conseil en vins est tenu **l'après-midi**
(15 h – 19 h 30), pas toute la journée.
**Raison.** Une cave n'est pas un comptoir de découpe : personne n'achète de
vin à 8 h 30, et exiger une présence toute la journée aurait gonflé le besoin
sans raison. **À ajuster** avec vos horaires réels, depuis Paramètres.

### D-87 — Six collaborateurs fictifs de plus
**Décision.** La démonstration compte maintenant 26 personnes : un caviste, une
employée partagée cave/drive, un responsable drive, deux préparatrices et un
apprenti au drive.
**Raison.** Deux rayons sans personne auraient affiché 0 % de couverture et
rendu la démonstration illisible. Tous fictifs, prénom + initiale.

### C-24 — « 1 personnes en même temps »
Repéré en vérifiant la cave : la pointe de la journée s'écrivait toujours au
pluriel. Corrigé.

## Lot 1b — Réglages et règles (2 octobre 2026)

### D-88 — La tranche d'âge remplace le simple « mineur »
**Décision.** La fiche enregistre une **tranche d'âge** : 18 ans ou plus,
16-17 ans, moins de 16 ans. Elle remplace l'ancien oui/non « mineur ».
**Raison.** La loi distingue les deux tranches : avant 16 ans le travail
s'arrête à 20 h, de 16 à 17 ans à 22 h. Un seul indicateur ne pouvait pas les
séparer. **Toujours aucune date de naissance** : la tranche suffit à appliquer
la loi, et c'est la donnée minimale (RGPD). **À savoir :** elle se met à jour à
la main, à l'anniversaire — un rappel sera ajouté dans les alertes.

### D-89 — La nuit légale va jusqu'à 6 h, pas 5 h
**Décision.** La plage de nuit passe de 21 h – 5 h à **21 h – 6 h**, qui est la
définition légale (L3122-2).
**Conséquence à vérifier avec la paie.** Le **comptage** des heures de nuit
change : une vacation de 4 h à 11 h 20 compte désormais 2 h de nuit au lieu
d'une. Les **majorations**, elles, gardent leurs tranches de convention
(21 h – 22 h à 5 %, 22 h – 5 h à 20 %) : ce sont deux choses différentes, et
c'est volontaire. Les deux sont modifiables dans Paramètres.

### D-90 — Une règle de plus : la formation en centre
**Décision.** Quatorzième règle, **bloquante** : aucune vacation ne peut être
posée un jour où un apprenti est en formation au CFA (L6222-24). Les périodes
se saisissent sur sa fiche — des dates et un intitulé, rien d'autre.
**Raison.** Ce temps est du temps de travail : il est rémunéré, il compte dans
la durée du travail, et la personne n'est pas en magasin.

### D-91 — Les règles deviennent modifiables, deux ans avant prévu
**Décision.** L'écran Paramètres ne se contente plus d'afficher les règles : il
permet de les modifier, toutes. Il était écrit qu'elles le deviendraient « au
lot 5 » ; c'était une promesse en attente.
**Organisation retenue.** Trois cartes : *Règles légales* (ce que dit la loi),
*Moins de 18 ans* (les protections par tranche d'âge), *Convention collective*
— cette dernière portant la mention **« à vérifier »** sur le contingent de
180 h, le délai de prévenance de 7 jours et toutes les majorations, à
confirmer avec le service paie.

### D-92 — Renommer une compétence la renomme partout
**Décision.** Changer le nom d'une compétence dans Paramètres le change aussi
dans **toutes les tâches** qui l'exigent et dans **toutes les fiches** qui la
possèdent, avec leur niveau.
**Raison.** Le nom est l'identifiant (D-84). Sans cette propagation, un simple
renommage aurait silencieusement coupé le lien entre une tâche et les personnes
capables de la tenir — le pire défaut possible pour un planning.
**Alternative écartée :** interdire le renommage.

### D-93 — Désactiver plutôt que supprimer
**Décision.** Une compétence et une tâche peuvent être **désactivées** : elles
sortent des calculs et des listes sans rien effacer. La suppression définitive
reste possible pour les tâches, par un bouton distinct.
**Raison.** Pendant vos premières semaines d'ajustement, se tromper doit être
sans conséquence.

### D-94 — Une tâche ajoutée à la main dure un temps fixe
**Décision.** Le bouton « Ajouter » crée une tâche à **durée fixe** (minutes),
sur une fenêtre horaire et des jours choisis.
**Raison.** Les tâches qui dépendent d'un volume (palettes, colis, mètres,
commandes) ont chacune leur façon de se compter ; les créer de zéro depuis
l'écran aurait demandé un formulaire différent par type. Pour celles-là, le
plus simple est de partir d'une tâche existante du même genre et de la
modifier. **Alternative possible :** un formulaire par type de tâche, plus
complet et plus lourd.

## Lot 2 — La charge se calcule au quart d'heure (2 octobre 2026)

### D-95 — La tranche passe de 30 à 15 minutes
**Décision.** Le besoin, la couverture et le contrôle se calculent désormais par
tranches de **15 minutes** : 96 tranches par jour au lieu de 48.
**Raison.** La demi-heure lissait les détails qui comptent dans un service
frais : une fournée qui sort à 06 h 45, un comptoir qui ouvre à 08 h 30, une
remise de commande drive de dix minutes. Elle faisait apparaître du besoin là
où il n'y en avait pas, et en masquait ailleurs.
**Ce qui ne change pas.** Le **travail à faire** reste identique : le test
`besoins-inchanges.test.ts` passe sans modification, parce que le total des
minutes d'une tâche ne dépend pas de la finesse du découpage.
**Ce qui change.** La **présence nécessaire** peut légèrement baisser : moins
d'arrondi perdu. C'est le bénéfice recherché.
**Vos plannings enregistrés ne sont pas touchés** : une vacation reste une
heure de début et une heure de fin.

### D-96 — Un profil de fréquentation ancien est étalé, pas perdu
**Décision.** Le profil horaire enregistré avant ce changement compte 48
valeurs, une par demi-heure. Il est **étalé automatiquement** sur les 96
tranches : une demi-heure à 6 % devient deux quarts d'heure à 3 %.
**Raison.** Obliger à ressaisir 96 valeurs à la main aurait été absurde. Le
total est conservé à l'identique.
**Alternative possible :** une saisie au quart d'heure dans Paramètres, à
ajouter si la précision de la demi-heure ne suffit plus.

### D-97 — Les barres de la courbe s'affinent d'autant
**Décision.** La largeur d'une barre de la courbe de besoin suit la finesse du
calcul : deux fois plus de barres, deux fois plus fines.
**Raison.** Sans cela, la courbe devenait deux fois plus large et illisible sur
iPhone.

## Lot 3 — Vérificateur des règles dures (2 octobre 2026)

### D-98 — Trois règles de présence, toutes bloquantes
**Décision.** Trois règles s'ajoutent, toutes **bloquantes** :
- **repos fixe** : une vacation un jour déclaré non disponible sur la fiche ;
- **absence ou congé** : une vacation pendant une absence accordée ;
- **dates de contrat** : une vacation avant l'entrée ou après la fin du contrat.
**Raison.** Elles disent toutes « la personne n'est pas là », mais elles ne se
corrigent pas de la même façon : une absence se remplace, un repos se déplace,
une date de contrat ne se discute pas. Les séparer rend le message utile.
**RGPD :** le message d'absence nomme le **type** (« Maladie »), jamais le
motif — c'est déjà ce que la fiche enregistre, et rien de plus.

Le générateur applique aussi ces trois règles, plus la formation au CFA : il ne
proposera jamais quelqu'un qui n'est pas là.

### D-99 — Le binôme : un niveau 1 ne tient pas une tâche seul
**Décision.** Une compétence exigée au niveau 2 est considérée tenue si
quelqu'un a ce niveau, **ou** si une personne de niveau 1 (« en formation »)
est présente sur la même tranche avec une personne de **niveau 3** (« sait
former »). Sans cet accompagnant, la tranche signale un « binôme incomplet ».
**Raison.** C'est exactement ce que demande la spécification, et cela
correspond au terrain : on confie une tâche à quelqu'un en formation, mais
jamais sans quelqu'un pour le reprendre.
**Où c'est contrôlé.** Dans le calcul de couverture, pas dans les règles
légales : c'est la seule place qui connaît qui est présent sur quelle tranche,
et avec quel niveau exigé.
**Précision.** Un accompagnant de niveau 2 ne suffit pas à former — mais s'il
est là, il tient la tâche lui-même, donc rien n'est signalé.

## Lot 4 — Postes et affectation (2 octobre 2026)

### C-25 — Le générateur comptait encore en demi-heures ❗
**Ce qui n'allait pas.** Au passage au quart d'heure (lot 2), le générateur a
gardé son propre calcul de tranches, écrit en dur sur 30 minutes. Il croyait
donc couvrir des créneaux qu'il ne couvrait pas, et plaçait les pauses au
mauvais endroit. Aucun test ne l'a vu : chacun vérifiait son côté du mur.
**Corrigé.** Le générateur utilise la même maille que tout le reste. Et surtout,
un test croise désormais les deux chemins : le manque mesuré par le générateur
doit être **exactement** celui mesuré par le calcul de couverture, rayon par
rayon et jour par jour. Si l'un dérive, le test casse.

### D-100 — Des postes courts, taillés sur le besoin
**Décision.** En plus des horaires types du magasin (7 h), le générateur
propose des postes de **3, 4 et 5 heures**, calés sur le début et sur la fin du
besoin réel de chaque rayon.
**Raison.** La cave demande environ trois heures par jour. Avec seulement des
journées de sept heures, le générateur devait choisir entre ne personne y
mettre et y mettre quelqu'un pour le double du besoin. **Trois heures minimum**,
comme le demande la spécification : on ne déplace personne pour moins.
**Détail légal.** Un poste de moins de six heures n'ouvre droit à aucune pause
(L3121-33) : ces postes n'en portent donc pas. Un test vérifie l'inverse —
toute vacation de six heures ou plus en a une.
**Limite connue.** Au plus huit formes de postes courts sont retenues, pour que
le calcul reste sous les cinq secondes.

### D-101 — Le calcul se fait dans un fil séparé
**Décision.** La proposition de planning est calculée dans un **Web Worker** :
l'écran reste utilisable pendant le calcul, et le bouton affiche « Calcul en
cours… ».
**Raison.** Sur iPad, plusieurs secondes de calcul dans le fil principal
figent l'écran : plus de défilement, plus de réponse au doigt, et iOS finit par
croire que l'application a planté.
**Repli assumé.** Si le navigateur ne sait pas créer de fil, ou si sa création
échoue, le calcul se fait quand même dans le fil principal : mieux vaut un
écran figé quelques secondes qu'un bouton qui ne fait rien. Les deux chemins
sont testés.

### D-102 — Les cinq secondes sont vérifiées par un test
**Décision.** Un test échoue si la génération du planning complet (neuf rayons,
26 personnes, sept jours) ne **rend pas la main** en cinq secondes, ou si ce
qu'elle rend n'est pas utilisable (moins de cinq rayons servis, ou une règle
bloquante enfreinte).
**Raison.** C'est une exigence du cahier des charges, et une exigence de ce
genre ne tient que si une machine la vérifie à chaque publication.
**Correction du 2 octobre, après le lot 8.** La première version de ce test
laissait au moteur quinze secondes, puis exigeait qu'il en prenne moins de
cinq. C'était une mauvaise question : le moteur **n'a pas de fin**, il améliore
tant qu'il trouve mieux, et il consomme donc tout le temps qu'on lui donne.
Avec les décalages ajoutés au lot 6, il a commencé à utiliser ses quinze
secondes — et le test a échoué, à juste titre. Ce qui est garanti, et ce que le
test vérifie désormais, c'est qu'avec **le budget réel de l'écran** (cinq
secondes), il rend la main à l'heure et rend un planning utilisable.

## Lot 5 — Feuilles de route (2 octobre 2026)

### D-103 — La feuille de route se déduit, elle ne se saisit pas
**Décision.** La feuille de route de chacun est **calculée** à partir du
planning et du besoin : le besoin dit combien de minutes chaque tâche demande à
chaque quart d'heure, et ces minutes sont réparties entre les personnes
présentes. Aucune saisie.
**Raison.** Vous saisissez déjà le planning et le catalogue ; demander en plus
qui fait quoi, heure par heure, aurait doublé le travail pour une information
que l'application sait déduire.
**Alternative possible :** une répartition modifiable à la main, à ajouter si
la proposition ne tombe pas juste sur le terrain.

### D-104 — Une seule tâche à la fois, et seulement si on sait la faire
**Décision.** Sur un quart d'heure donné, une personne tient **une** tâche. Elle
ne reçoit que des tâches dont elle a le niveau — la règle du binôme s'applique
(un niveau 1 accompagné d'un niveau 3), **sauf pour les compétences critiques**,
qui n'admettent aucune exception.
**Raison.** Un boucher qualifié au comptoir ne se remplace pas par quelqu'un en
formation, même accompagné.
**Départage.** À capacité égale, la personne dont l'identifiant vient en premier
— arbitraire, mais stable : le même planning donne toujours la même feuille.

### D-105 — Ce qui n'a trouvé personne est dit, et pourquoi
**Décision.** Les tâches non affectées sont listées, totalisées en heures, avec
leur raison : **« personne de présent n'a la compétence requise »** ou
**« tout le monde était déjà occupé »**.
**Raison.** Les deux manques ne se corrigent pas pareil : le premier demande une
formation ou un prêt entre rayons, le second une personne de plus. Ils seront
repris dans l'écran Conflits, au lot 7.

### D-106 — Les feuilles s'impriment en portrait, deux par page
**Décision.** Le bouton « Imprimer les feuilles du jour » bascule l'écran en
mode impression : deux feuilles par page, aucune jamais coupée en deux, et
les boutons et menus disparaissent.
**Raison.** Ces feuilles se distribuent le matin. Elles ne portent ni statut de
suivi, ni note, ni commentaire — ce sont des documents sortants, soumis à la
même règle que les autres.

## Lot 6 — Verrouillage, relance, amélioration locale (2 octobre 2026)

### D-107 — Le verrou se pose sur une case, pas sur une vacation
**Décision.** Le cadenas se pose sur une **case** (une personne, un jour) et
non sur une vacation. La case verrouillée ne bouge plus : ni échangée, ni
décalée, ni supprimée, et la personne ne reçoit rien d'autre ce jour-là.
**Raison.** C'est ainsi qu'on raisonne devant un planning : « Camille, lundi,
c'est décidé ». Verrouiller la vacation aurait laissé la possibilité d'en
ajouter une seconde le même jour.
**Enregistré dans le planning**, donc conservé d'une séance à l'autre et repris
par la sauvegarde.

### D-108 — « Relancer » reprend le reste, il ne recommence pas
**Décision.** Le bouton « Relancer sans toucher aux cases verrouillées »
replace les cases verrouillées **en premier**, les compte dans la couverture et
dans les règles, puis recalcule tout le reste autour.
**Raison.** C'est ce qui rend l'outil utilisable : on fige ce qu'on a décidé —
un rendez-vous, une demande acceptée, une formation — et on laisse
l'application s'occuper du reste. Le nombre de cases verrouillées est affiché à
côté du bouton, pour qu'on sache toujours ce qui est figé.

### D-109 — Décalages de 15 et 30 minutes seulement
**Décision.** Après les échanges de personnes, le moteur essaie de décaler
chaque poste de **−30, −15, +15 ou +30 minutes**, et garde le décalage s'il
améliore la couverture sans enfreindre une règle.
**Raison.** Un poste calé sur un horaire type tombe rarement pile sur le
besoin : une fournée sort à 06 h 45, une livraison arrive à 05 h 15. Un quart
d'heure de décalage comble le trou sans rien coûter.
**Pourquoi s'arrêter à trente minutes.** Au-delà, ce n'est plus un ajustement
mais un autre poste : les gens organisent leur journée autour de leur horaire,
et déplacer quelqu'un d'une heure sans le lui demander n'est pas acceptable.

### D-110 — Une vacation posée à la main garde son horaire exact
**Décision.** Une vacation verrouillée posée à une heure qui ne correspond à
aucun horaire type reçoit son propre horaire, calculé sur ses heures réelles.
**Raison.** Sans cela, le moteur n'aurait pas su quelles tranches elle couvre,
et aurait cru le besoin découvert là où quelqu'un travaille.

## Lot 7 — Conflits et solutions classées (2 octobre 2026)

### D-111 — Cinq solutions, classées par ce qu'elles coûtent
**Décision.** Chaque conflit est accompagné de solutions, classées du moins
coûteux au plus coûteux :
1. **prêter** quelqu'un d'un autre rayon — gratuit, immédiat ;
2. **décaler** un poste existant de 15 ou 30 minutes — gratuit, demande un accord ;
3. **heures complémentaires** pour un temps partiel qui a de la marge ;
4. **renfort extérieur** — un coût réel ;
5. **former quelqu'un** — un coût différé, mais la seule qui règle le problème
   pour de bon.
**Raison.** Constater le manque ne sert à rien : la couverture le dit déjà.
Ce qui manquait, c'est quoi faire, et dans quel ordre essayer.

### D-112 — Seuls le prêt et le décalage s'appliquent d'un geste
**Décision.** Le bouton « Appliquer » n'apparaît que sur le prêt et le
décalage. Les heures complémentaires, les renforts et les formations sont
affichés mais ne modifient rien.
**Raison.** Les trois dernières engagent **quelqu'un d'autre** : on ne propose
pas des heures complémentaires ni on n'appelle une agence depuis un bouton de
planning. Elles se décident avec les personnes concernées, puis se saisissent
dans les écrans prévus.
**Alternative possible :** préparer la demande (un message, une mission) sans
l'envoyer — à ajouter si le besoin s'en fait sentir.

### D-113 — Les conflits se regroupent en plages, pas en quarts d'heure
**Décision.** Les quarts d'heure consécutifs touchés par le même problème sont
regroupés en une seule ligne : « Boucherie, 08:30–12:00 : personne pour
“boucherie” — poste intenable ».
**Raison.** Au quart d'heure, une matinée découverte produirait quatorze lignes
identiques. Regroupées, elles tiennent en une.

### D-114 — Un prêt dure au moins trois heures
**Décision.** Une solution de prêt propose toujours au moins trois heures, même
si le trou est plus court.
**Raison.** La même règle que pour les postes courts : on ne fait pas traverser
le magasin à quelqu'un pour trois quarts d'heure.

## Lot 8 — Vue tous rayons, prêts, budget (2 octobre 2026)

### D-115 — Un tableau d'une ligne par rayon, et un total
**Décision.** La vue « Tous les rayons » donne, pour chaque rayon : la
couverture en pourcentage (vert au-dessus de 95 %, rouge sous 80 %), les heures
nécessaires, les heures prévues, le budget et l'écart signé. Une ligne de total
ferme le tableau.
**Raison.** C'est la vue qu'on regarde en premier le lundi matin : qui est en
difficulté, et où passent les heures.

### D-116 — Les prêts sont nommés, pas comptés
**Décision.** Les prêts entre rayons sont listés par personne : « Camille D. —
6,7 h depuis Fruits et légumes vers Crèmerie ».
**Raison.** Un compte (« 3 prêts ») ne sert à rien. Ce qu'on cherche, c'est
**qui** on a déplacé et **d'où** on l'a pris — parce que le rayon d'origine s'en
trouve affaibli, et que c'est la première chose à vérifier quand il va mal.

## Lot 9 — Plusieurs semaines et équité sur quatre semaines (2 octobre 2026)

### C-26 — La jonction entre deux semaines n'était pas contrôlée ❗
**Ce qui n'allait pas.** Découvert en construisant plusieurs semaines d'affilée.
Chaque semaine était vérifiée **seule** : un dimanche fini à 20 h 30 suivi d'un
lundi commencé à 05 h 30 — neuf heures de repos au lieu de onze — passait donc
inaperçu. Le défaut existait déjà en construisant semaine après semaine à la
main, pas seulement en automatique.
**Corrigé.** Le contrôle légal inclut désormais les **journées voisines**, y
compris celles d'une autre semaine. Un test le vérifie : un dimanche tardif
empêche un lundi matinal.

### D-117 — L'équité se mesure sur quatre semaines, pas depuis toujours
**Décision.** Les samedis, dimanches, ouvertures et fermetures sont comptés sur
les **quatre dernières semaines**, et non sur les compteurs cumulés de la fiche.
**Raison.** Les compteurs de la fiche comptent depuis l'embauche : quelqu'un
arrivé il y a dix ans en aura mécaniquement plus que quelqu'un arrivé l'an
dernier, sans qu'aucune injustice récente n'ait eu lieu. Ce qui se discute dans
un service, c'est « ça fait trois samedis d'affilée ».
**Quatre semaines :** assez pour lisser un aléa, assez court pour qu'un
déséquilibre se corrige avant d'être vécu comme une habitude.
**Pondération choisie.** Un dimanche pèse 1,5 samedi, une fermeture 0,75, une
ouverture 0,5 — toutes les sujétions ne se valent pas. **Ces poids sont un
point de départ à relire** : ils ne viennent d'aucun texte.

### D-118 — Chaque semaine reçoit ce qui a été décidé pour les précédentes
**Décision.** Construire quatre semaines d'affilée, c'est les construire **dans
l'ordre**, chacune nourrie du résultat des précédentes.
**Raison.** Calculées indépendamment, les quatre semaines seraient identiques —
et la même personne prendrait quatre fois le samedi. Le report est ce qui fait
tourner les sujétions.

### D-119 — Le calcul de la série part entier dans le fil séparé
**Décision.** La séquence complète (jusqu'à quatre semaines) est envoyée d'un
bloc au fil séparé, besoins déjà calculés.
**Raison.** Un Web Worker ne peut pas recevoir de fonction : les besoins sont
donc préparés par l'écran et transmis comme données. Quatre semaines, c'est
quatre fois le calcul : c'est précisément là que figer l'écran serait le plus
pénible.
