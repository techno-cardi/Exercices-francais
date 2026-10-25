# Rythme automatique et difficulté adulte

Objectif : une soirée sans télécommande entre les questions, avec les réussites individuelles visibles et un niveau facile adapté aux adultes.

- [x] Moteur : mémoriser la correction et une échéance commune de 8 secondes, avancer une seule fois au prochain état, terminer automatiquement la dernière question. Préserver les commandes obsolètes et les réponses tardives.
- [x] RPC SQL : inscrire la même échéance lorsque la dernière réponse ou le chrono déclenche la correction. Ne jamais modifier les questions d'une partie déjà commencée.
- [x] Affichage : compte à rebours, noms/personnages/points des bonnes réponses, indicateurs dans le classement; progression automatique en solo aussi.
- [x] Questions : remplacer les 60 questions faciles générales trop élémentaires, conserver les 10 locales déjà exigeantes et les 210 identifiants.
- [x] Vérification : tests moteur, SQL et vraie partie multijoueur automatique, vérification visuelle, publication GitHub Pages et Edge Function. Aucune nouvelle installation APK nécessaire.

L'avancement est calculé côté serveur, jamais par une commande privilégiée d'un téléphone. Le premier état demandé après l'échéance commence la question suivante avec son temps complet; aucune question n'est sautée après une reconnexion.

Résultat : Edge Function v9 déployée. 29 tests Node réussis; tests SQL annulés après vérification. Vraie partie de 3 joueurs et 2 questions, avec réponses exactes et erronées, noms masqués avant correction, échéance commune, requêtes simultanées à la transition et classement final automatique : réussie. Navigateur HTTPS publié : deux questions faciles, réussites avec personnage/points, compte à rebours, passage à la deuxième question sans clic.

Relecture indépendante : correction des doublons culturels et de la liste de gagnants inaccessible à la télécommande. Pagination automatique en huit noms; les 32 noms passent pendant la correction.
