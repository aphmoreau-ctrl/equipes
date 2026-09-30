# Moteur de besoin

**Lot 2 de la priorisation** (cahier des charges §7, §16.1).

Ce dossier accueillera le calcul du besoin : pour chaque rayon, chaque jour et
chaque tranche de 30 minutes, **combien de personnes** sont nécessaires et avec
**quelles compétences**.

Il sera composé de *blocs* indépendants et testés séparément : réception, mise
en place, réassort, comptoir, transformation, tâches fixes, plan de cuisson…
chacun avec ses paramètres et ses coefficients (qualité à la réception, météo,
saison, événements).

**Règle d'architecture** : code pur. Ce dossier ne doit jamais importer quoi que
ce soit de `src/ui/`. C'est ce qui permet de le tester intégralement.
