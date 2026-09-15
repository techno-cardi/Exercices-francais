# Cardinal - distribution et mises à jour Chrome

## Objectif

Le canal durable visé est le Chrome Web Store en visibilité **Non répertoriée**.

Pourquoi : sur Windows et macOS, Chrome ne permet pas à une extension chargée manuellement en mode non empaqueté de se remplacer automatiquement depuis GitHub. Le Chrome Web Store fournit l'installation unique et les mises à jour automatiques.

GitHub reste la source du projet et l'historique des versions. Une fois l'extension créée dans le Chrome Web Store, les versions suivantes pourront être téléversées et publiées avec l'API Chrome Web Store.

## Première publication, une seule fois

1. Utiliser le compte Google propriétaire de l'extension.
2. Activer la validation en deux étapes.
3. Créer l'élément dans le Chrome Web Store Developer Dashboard.
4. Téléverser le ZIP Cardinal courant.
5. Compléter les sections Fiche et Confidentialité.
6. Choisir la visibilité **Non répertoriée**.
7. Soumettre l'extension à l'examen.
8. Après publication, conserver l'ID d'extension et le Publisher ID dans la documentation du projet, mais ne jamais committer de jetons OAuth ou de secrets.

## Après la première publication

Les mises à jour doivent :

- augmenter `version` dans `manifest.json`;
- produire un ZIP propre avec les fichiers réellement utilisés seulement;
- être téléversées vers le même item Chrome Web Store;
- être publiées après validation;
- ne jamais changer d'ID d'extension.

Chrome distribuera ensuite automatiquement la version plus récente aux installations existantes.

## Automatisation future

L'API Chrome Web Store v2 permet de téléverser et publier une nouvelle version. L'automatisation GitHub Actions nécessitera des secrets GitHub pour les identifiants OAuth ou un compte de service autorisé. Aucun secret ne doit être stocké dans le dépôt.

## Structure de release visée

Le ZIP installé ne doit pas contenir les anciennes couches de développement `v081`, `v091`, `v092`, etc. Le build courant consolide ces couches en quelques fichiers fonctionnels :

- `service-worker.js`
- `gestion-bridge.js`
- `formative.js`
- `formative-stealth.js`
- `chatgpt.js`
- `mozaik.js`
- `popup.html`
- `popup.js`
- `manifest.json`
- `icons/`

Les anciennes versions peuvent rester dans Git pour l'historique, mais ne doivent pas être embarquées dans le package distribué.
