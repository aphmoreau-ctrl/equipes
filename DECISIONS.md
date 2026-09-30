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
