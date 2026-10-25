# Rythme automatique et difficulté adulte

Objectif : une soirée sans télécommande entre les questions, avec les réussites individuelles visibles et un niveau facile adapté aux adultes.

- [ ] Moteur : mémoriser la correction et une échéance commune de 8 secondes, avancer une seule fois au prochain état, terminer automatiquement la dernière question. Préserver les commandes obsolètes et les réponses tardives.
- [ ] RPC SQL : inscrire la même échéance lorsque la dernière réponse ou le chrono déclenche la correction. Ne jamais modifier les questions d'une partie déjà commencée.
- [ ] Affichage : compte à rebours, noms/personnages/points des bonnes réponses, indicateurs dans le classement; progression automatique en solo aussi.
- [ ] Questions : remplacer les 60 questions faciles générales trop élémentaires, conserver les 10 locales déjà exigeantes et les 210 identifiants.
- [ ] Vérification : tests moteur, SQL et vraie partie multijoueur automatique, vérification visuelle, publication GitHub Pages et Edge Function. Aucune nouvelle installation APK nécessaire.

L'avancement est calculé côté serveur, jamais par une commande privilégiée d'un téléphone. Le premier état demandé après l'échéance commence la question suivante avec son temps complet; aucune question n'est sautée après une reconnexion.
