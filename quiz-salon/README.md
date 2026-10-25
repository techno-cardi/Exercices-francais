# Quiz de salon

Jeu multijoueur en français publié à :
https://techno-cardi.github.io/Exercices-francais/quiz-salon/

## Jouer sur la télé et les téléphones

1. Ouvrir le lien dans le navigateur de la télé ou sur un ordinateur affiché sur la télé.
2. Choisir « Créer une partie », le nombre de questions (1 à 210), les catégories, le niveau et le chrono, puis ouvrir le salon.
3. Chaque joueur scanne le QR de la télé et entre son prénom. Le téléphone passe automatiquement en mode joueur.
4. L'hôte lance la partie, puis avance entre les explications. Il peut aussi jouer depuis un autre appareil en scannant le QR.

Sur Fire TV Stick, ouvrir **Amazon Silk / Internet**, entrer l'adresse du jeu et l'ajouter aux favoris. Le navigateur se pilote avec le pavé directionnel et le bouton central. Le raccourci AFTVnews permet également d'ouvrir l'adresse avec Downloader. Il ouvre une page web : aucun APK n'est nécessaire.

## Contenu et règles

- 210 questions originales, quatre réponses et une explication accompagnée d'un lien de référence.
- Sept catégories : Québec et Saint-Émile (30 questions), Québec et Canada, histoire, arts et culture, sports et jeux, sciences et nature, mots et logique.
- Trois niveaux ou progression de difficulté. Chaque couple catégorie/niveau contient dix questions.
- Nombre personnalisé de 1 à 210, limité explicitement au nombre disponible pour les filtres choisis.
- 1 à 32 joueurs; parties indépendantes par code de six caractères.
- Bonne réponse : 1000 points. Avec chrono : bonus de vitesse de 0 à 500 points, calculé au serveur. Sans chrono : 1000 points fixes.
- Les scores de la question sont masqués jusqu'à la révélation. Égalités de points : même rang.
- Son original par synthèse Web Audio; activation après un geste utilisateur, bouton pour couper le son.
- Animations et confettis désactivés avec la préférence système de réduction des mouvements.
- Déconnexion temporaire : reconnexion avec le même accès et le même score. L'hôte peut retirer un joueur pendant la partie.
- Revanche sans rescanner; préférence pour des questions non utilisées quand la banque filtrée le permet.
- Les salles expirent après 24 h et sont nettoyées lors des créations suivantes.

## Architecture

Frontend statique sans build : `index.html`, `app.mjs`, `style.css`, `sound.mjs`, `session.mjs`, `vendor/qrcode.js`.
Serveur : nouvelle Supabase Edge Function `quiz-salon` dans le projet `ojyswaxuqwnqilrvtjll`.
Backend auditable : `backend/index.ts`, `backend/engine.mjs`, `backend/questions.mjs`, `backend/schema.sql`.

Les deux tables `quiz_salon_rooms` et `quiz_salon_limits` sont indépendantes des applications scolaires. RLS active, accès anonyme et authentifié révoqué. Les fonctions SQL sont SECURITY INVOKER et exécutables uniquement par service_role. La clé serveur reste dans les variables Supabase, jamais dans le frontend ni le dépôt.

Le QR ne contient que l'adresse publique et le code de salle. Les jetons aléatoires hôte/joueur sont séparés, hachés en base et conservés côté navigateur. Les réponses et commandes sont liées à l'identifiant de partie et au numéro de question. Le serveur possède le temps et les scores. Les écritures concurrentes utilisent une comparaison de révision avec nouvelles tentatives. Les créations et adhésions sont limitées par empreinte d'adresse IP (adresse brute non conservée).

La banque est visible dans ce dépôt public; ce jeu de salon n'est pas un outil d'évaluation sécurisé. Une connexion Internet est nécessaire au multijoueur. Le solo fonctionne localement une fois les fichiers chargés.

## Vérifier

Depuis ce dossier :

```
node --test tests/*.test.mjs
node tests/live.mjs
```

Le deuxième test utilise le vrai serveur et crée une salle jetable avec 16 joueurs, dix questions et 160 réponses simultanées par séries. La salle est fermée à la fin.

`tests/mobile.html` permet d'inspecter l'interface dans un cadre de 390 × 844 pixels. Ajouter `?code=CODE` pour essayer une vraie salle. Ce test de mise en page ne remplace pas un essai matériel sur Fire TV, iPhone ou Android.

## Déployer et maintenir

GitHub Pages publie la branche main du dépôt existant, sans changer la page d'accueil. Les sources du jeu sont entièrement contenues dans ce dossier. Pour modifier le serveur, inspecter la fonction déployée, puis déployer les trois fichiers de `backend/` avec `index.ts` comme point d'entrée et `verify_jwt=false` (authentification par capacités dans le corps). Une modification du fichier SQL doit passer par une migration. Ne pas réappliquer le schéma initial à des tables déjà présentes.
