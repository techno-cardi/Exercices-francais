# Correctif de synchronisation Mozaïk V12

Date : 2026-09-20

## Problème observé

Avec Cardinal 1.1.3, une synchronisation pouvait rester plusieurs minutes sur « Détection automatique du groupe ... et de la liste officielle des élèves » / « Préparation de la synchronisation » avant que les vraies requêtes Mozaïk commencent.

Le diagnostic du 20 septembre 2026 a montré que la première vraie requête vers l’API Mozaïk partait environ 177 secondes après le début du test. Une fois cette étape atteinte, les appels Mozaïk répondaient en quelques dizaines ou centaines de millisecondes.

Le mapping du groupe 31 était déjà valide en base. La redétection complète n’avait donc aucune raison d’être exécutée pour cette synchronisation.

## Cause principale

Le site pouvait encore exécuter une ancienne copie mise en cache de `app-patch-v08.js` malgré le correctif de réutilisation des mappings existants.

Autres risques repérés :

- le bouton n’était pas verrouillé avant le premier `await` de la couche de découverte;
- `prepare` était suivi de `claimLatest`, donc un autre lot préparé presque simultanément pouvait théoriquement être réclamé;
- une note tout juste modifiée pouvait encore être en cours d’enregistrement au moment de préparer le lot;
- l’interface Mozaïk masquait son panneau de progression au premier clic hors du panneau;
- le bouton « Fermer » du panneau fermait l’onglet Mozaïk au lieu de seulement masquer le panneau;
- le client considérait un `success:true` suffisant sans vérifier que le nombre de notes retourné correspondait au lot attendu.

## Correctif web V12

`resultats/app-patch-v12.js` ajoute :

1. verrou anti double-clic dès l’entrée du gestionnaire;
2. validation rapide du mapping enregistré via `school-roster/discoveryConfig`;
3. synchronisation directe quand le mapping courant est valide;
4. repli vers la découverte complète seulement si aucun mapping courant n’existe réellement;
5. délai maximal court pour la validation rapide afin d’éviter de retomber dans une attente de plusieurs minutes sur une panne secondaire;
6. attente de la fin des enregistrements de notes avant de préparer le lot;
7. comparaison du nombre de notes de l’interface avec `prepare.resultCount`;
8. réclamation du lot exact avec `claim(code)` au lieu de `claimLatest`;
9. comparaison de `result.syncedCount` avec le nombre attendu avant de déclarer la synchronisation réussie;
10. refus d’un succès sans identifiant d’activité Mozaïk.

## Cache busting

Les versions de chargement suivantes forcent Chrome à récupérer les fichiers corrigés :

- `index.html` charge `app-patch-v05.js?v=13`;
- `app-patch-v05.js` charge `app-patch-v08.js?v=5`;
- `app-patch-v05.js` charge `app-patch-v12.js?v=2`.

Ne pas réutiliser ces mêmes numéros de query string après une nouvelle modification du contenu.

## Interface Mozaïk

La source `resultats/mozaik/extension/mozaik-ui.js` a aussi été corrigée :

- un clic normal dans la page ne masque plus la progression;
- le panneau ne se ferme que par une action explicite;
- « Fermer » masque le panneau et ne ferme plus l’onglet Mozaïk.

Cette modification nécessite une future reconstruction de l’extension pour être présente dans une installation existante de Cardinal. Le correctif web V12, lui, fonctionne avec l’extension déjà installée.

## Vérification des résultats : limite restante

Le diagnostic a montré un premier `PUT` des notes en HTTP 400, puis le repli décimal alternatif en HTTP 200 avec trois éléments retournés. Le code actuel possède donc une confirmation d’écriture HTTP et vérifie maintenant le nombre de notes retourné.

Ce n’est toutefois pas encore une véritable lecture après écriture. Le projet ne doit pas inventer un endpoint GET non documenté. Pour ajouter une vérification de persistance stricte, capturer le GET réellement utilisé par l’interface officielle Mozaïk lorsqu’un enseignant ouvre l’activité et ses résultats, puis reproduire cette lecture exacte.

Tant que cette requête officielle n’a pas été observée, ne pas annoncer qu’une vérification de persistance complète est implémentée.

## Source d’extension

Le `manifest.json` présent actuellement dans le dépôt correspond encore à une ancienne base 0.8.1. Il ne faut pas reconstruire une prétendue 1.1.4 à partir de cette base en supposant qu’elle correspond exactement au paquet 1.1.3 installé. Cela risquerait de régresser Formative ou des correctifs Mozaïk déjà présents dans le paquet 1.1.3.
