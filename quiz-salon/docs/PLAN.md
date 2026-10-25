# Quiz de salon Implementation Plan

> Exécution directe dans cette session, selon la demande de livraison en une traite.

**Goal:** publier un jeu multijoueur opérationnel sur GitHub Pages.
**Architecture:** frontend statique + moteur serveur JavaScript pur + Supabase Edge + stockage atomique Postgres.
**Spec:** CONCEPTION.md

## Contraintes
FR, Android/iPhone, quatre choix, aucune installation, aucune modification des applications existantes. QR local sans service externe. Jetons hors URL. Scores et délais autoritaires serveur.

## Vérifications prioritaires
Réponses simultanées; réponses dupliquées/tardives; reconnexion; jeton invalide; double clic hôte; banque insuffisante pour un filtre; noms malveillants; source correcte pour chaque question.

## Étapes
- [x] Banque `backend/questions.mjs` : 180 entrées uniques, six catégories et trois niveaux, explications et sources. Test de structure et de couverture.
- [x] Moteur `backend/engine.mjs` : création, adhésion, réponse, progression, reprise, masque de données. Tests Node avant implémentation des transitions et des permissions.
- [x] Adaptateur `backend/index.ts` + `backend/schema.sql` : jetons, limites de création/adhésion, stockage CAS, expiration et CORS. Migration puis essais réels de concurrence et autorisations.
- [x] Interface `index.html`, `style.css`, `app.mjs`, `vendor/qrcode.js` : accueil, réglages, salon, question, révélation, podium, téléphone et découverte solo.
- [x] Vérification navigateur desktop/mobile, vraie partie à plusieurs clients, publication atomique dans le dépôt puis vérification HTTP de la page GitHub Pages.

## Validation et revue

23 tests Node passent. Intégration réelle : 16 joueurs concurrents, 160 réponses, dix tours, absence de fuite de score, autorisations, reconnexion, égalités, revanche et fermeture. Revue indépendante : correction de la conservation des accès lors d’une panne transitoire, liaison des réponses à l’identifiant de partie et retrait des joueurs pendant la partie.

Direction finale demandée : thème bleu; nombre personnalisé 1 à 210; catégorie Québec et Saint-Émile, pour un total de 210 questions et sept catégories. Support clavier/pavé directionnel pour navigateur télé.

Version TV native compilée avec succès. APK signé et vérifié par apksigner (v1/v2/v3). Téléchargement public HTTP 200, MIME APK et empreinte SHA-256 identique au fichier signé. WebSocket réel vérifié sur une salle de sept questions locales. Écrans publiés inspectés sur navigateur bureau et cadre mobile 390 × 844 : prénom/personnage, salon, QR, question, réponse et score. Pas de matériel Fire TV/iPhone/Android physique disponible.

Optimisation finale : réponses enregistrées par RPC transactionnel unique, capacité et identifiant de partie vérifiés dans la transaction. Test de 32 envois simultanés passé, durée totale du lot ramenée de 8153 à 3658 ms dans cet environnement (inclut les requêtes HTTP et la relecture finale, ne mesure pas le délai d'un téléphone réel). Nouvelle revue indépendante de ce chemin validée. Le moteur local conserve les mêmes règles et la projection des scores reste masquée jusqu'à la révélation.
