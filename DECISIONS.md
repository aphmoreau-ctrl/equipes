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
