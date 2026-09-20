# Synchronisation Mozaïk v14 / extension 1.1.6

## Diagnostic confirmé le 20 septembre 2026

Le diagnostic `23-47-04` montrait que Mozaïk était chargé et authentifié, mais qu'aucune requête Cardinal de synchronisation ne partait pendant la période observée. Aucun `PUT` de résultat et aucun appel `/membres` n'étaient présents. Aucun nouveau `school_mozaik_sync_jobs` n'était créé au même moment.

La panne se situait donc avant `mozaik-sync.prepare`, dans Gestion des notes.

## Cause principale

Les anciens flux de synchronisation exécutaient encore des opérations non bornées avant `prepare`, notamment `saveAssignmentSettings({quiet:true})`. Cette fonction sauvegarde le travail, le recharge, rerend l'interface puis attend `refreshSyncState()`. `refreshSyncState()` effectue lui-même un appel réseau sans timeout.

`commitGrade()` possède le même angle mort: après avoir sauvegardé la note et retiré la classe visuelle `saving`, il attend encore `refreshSyncState()`.

Ces appels de statut sont utiles pour l'affichage, mais ils ne doivent jamais bloquer la synchronisation Mozaïk.

## Architecture v14

`app-patch-v14.js` devient l'unique propriétaire du bouton `#syncMozaikBtn`.

Chemin normal:

1. Vérification locale et attente bornée des notes réellement en cours d'enregistrement.
2. `mozaik-sync.prepare` directement avec les paramètres Mozaïk du formulaire.
3. `claim` du code exact retourné par `prepare`.
4. Envoi du payload à l'extension.
5. Vérification du nombre de notes et de l'identifiant d'activité.
6. `complete` du lot exact.
7. Rafraîchissement de statut seulement après succès, en arrière-plan de l'interface et sans bloquer le résultat.

## Délais maximums

- Détection de l'extension: 1,8 s
- Sauvegarde d'une note active: 7 s
- `prepare`: 10 s
- `claim`: 10 s
- Extension / Mozaïk: 35 s
- `complete`: 10 s
- Fermeture d'un lot en erreur: 5 s

Une étape qui dépasse sa limite produit une erreur explicite. Elle ne reste plus indéfiniment sur « Préparation de la synchronisation ».

## Mapping absent

Le chemin normal ne lance plus automatiquement la découverte de groupe de 150 s. Si `prepare` indique que le mapping est absent, la synchronisation s'arrête immédiatement avec un message clair. La découverte doit être traitée séparément.

## Empilement des anciens handlers

`app-patch-v05.js` ne charge plus `app-patch-v12.js` ni `app-patch-v13.js`. Il charge v08 à v11 pour leurs fonctions non remplacées, puis v14 pour la synchronisation. v14 réaffirme temporairement la propriété du bouton afin d'empêcher un ancien wrapper chargé plus tard de reprendre le contrôle.

## Extension 1.1.6

La 1.1.6 est basée directement sur la 1.1.5. Les fichiers Formative et ChatGPT sont inchangés.

Changements Mozaïk:

- `mozaik.js` est injecté à `document_start` et possède un garde de version 1.1.6.
- Le panneau peut être injecté et affiché dès le premier clic sans attendre que l'onglet Mozaïk soit complètement chargé.
- Gestion des notes transmet ses étapes détaillées au panneau Mozaïk.
- Le chemin `handleSync` n'attend plus jusqu'à 20 s avant d'afficher le panneau.
- La capture rapide du bearer introduite en 1.1.5 est conservée.

## Invariants de sécurité et de fiabilité

- Le lot exact est réclamé avec son `code`, pas avec `claimLatest`.
- Le nombre de notes préparées doit correspondre au nombre attendu.
- Un succès sans `activityId` est refusé.
- Le nombre de notes confirmé par l'extension doit correspondre au lot.
- La confirmation backend n'est faite qu'après les vérifications de succès.
- Formative, ChatGPT et le popup ne sont pas modifiés par la 1.1.6.
