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

18 tests Node passent. Intégration réelle : 16 joueurs concurrents, 160 réponses, dix tours, absence de fuite de score, autorisations, reconnexion, égalités, revanche et fermeture. Revue indépendante : correction de la conservation des accès lors d’une panne transitoire, liaison des réponses à l’identifiant de partie et retrait des joueurs pendant la partie.

Direction finale demandée : thème bleu; nombre personnalisé 1 à 210; catégorie Québec et Saint-Émile, pour un total de 210 questions et sept catégories. Support clavier/pavé directionnel pour navigateur télé.
