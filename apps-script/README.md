# Mise en service

1. Crée un nouveau Google Sheets, puis ouvre **Extensions → Apps Script**.
2. Copie `Code.gs`, `Setup.gs` et `appsscript.json` dans le projet.
3. Exécute `configurerAtelier`, puis ajoute ton courriel dans l’onglet **Utilisateurs** avec le rôle `enseignant` et la valeur `TRUE` dans **actif**.
4. Dans le menu **Atelier de français**, choisis **Définir le mot de passe enseignant**.
5. Dans les propriétés du script, ajoute `ANSWER_BANK_FILE_ID` avec l’identifiant du fichier privé déjà téléversé, puis exécute `importerCorriges`.
6. Déploie le projet comme application Web, exécutée par toi et accessible à tous. Copie l’adresse du déploiement dans `config.js`.

Le fichier de corrigés et l’onglet **Corrigés** restent privés. Ils ne doivent jamais être ajoutés au dépôt GitHub.
