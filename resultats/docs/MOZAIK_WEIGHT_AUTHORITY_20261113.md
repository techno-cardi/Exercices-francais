# Pondération Mozaïk : source explicite par nouveau lot (candidat du 13 novembre 2026)

## Motivation et preuves
Sur le travail de lecture « Le conte merveilleux (partie 2) », groupe 31, l'envoi 29/29 avait réussi. Pour le groupe 32, Cardinal 1.3.49 a tenté `PUT activities` HTTP 400 : `notePublique` était repris comme objet de lecture `{note:"<p>...</p>"}`, au lieu de la chaîne HTML attendue par le modèle d'écriture natif de Mozaïk. Le maximum était d'abord 100 et la pondération 45 % dans Mozaïk; l'enseignant les a changés manuellement à 70 et 39 %. L'ancien lot avait déjà figé 70 et 45 %, et une reprise a été bloquée pour divergence.

**Important :** ne pas déduire que 45 % est systématiquement erroné. La source de référence doit être un choix de l'enseignant pour **chaque groupe** et **chaque nouveau lot**.

## Flux proposé dans la branche non déployée
1. La destination Mozaïk est choisie pour le groupe courant et validée avec son identité exacte, son année, son école et sa matière.
2. Un dialogue affiche la pondération de Gestion et celle détectée à l'instant de la sélection dans Mozaïk, ainsi que les deux maximums. Aucune option n'est cochée par défaut. Une activité neuve ne permet pas l'option « conserver Mozaïk ».
3. Le professeur choisit `gestion` ou `mozaik`, puis confirme un aperçu des notes et des paramètres. L'option `mozaik` signifie conserver **la valeur réelle relue dans l'activité sélectionnée**; aucune donnée externe n'est copiée silencieusement vers Gestion.
4. L'Edge Function valide `weightSource` et le fige dans **le journal d'envoi du groupe**. Les clients anciens/anciens lots qui ne transmettent pas cette propriété conservent le mode `legacy`.
5. Cardinal lit l'activité réelle et construit le modèle cible :
   - `gestion` : pondération **et portée au bulletin** depuis Gestion.
   - `mozaik` : pondération **et portée au bulletin** depuis Mozaïk; si la valeur requise est absente/illisible, arrêt sans écriture.
   - `legacy` : calcul historique inchangé pour des lots figés antérieurs.
   - Travail non porté au bulletin : `ponderation:null` (jamais un faux 0).
   - Le **maximum reste celui de Gestion** dans ce correctif, avec différence signalée et éventuelle remise à l'échelle hors lot visible dans l'aperçu.
6. La comparaison de paramètres et la relecture des résultats restent obligatoires. Une activité modifiée après l'aperçu entraîne un arrêt, **pas une réconciliation aveugle**.

## Modèle PUT Mozaïk
La version de Cardinal **1.3.50** a corrigé la sérialisation des champs `notePublique` et `notePrivee` au moyen du modèle d'écriture autorisé et conservateur, sans supprimer les descriptions. Le ZIP candidat **1.3.51 BETA** ajoute la source de pondération explicite. Le code historique publié dans `resultats/mozaik/extension` n'est **pas** cette archive actuelle; ne pas le substituer.

## Lot interrompu et annulation
Le lot 32 identifié pendant le diagnostic reste `claimed`, `phase='planned'`, `reviewConfirmed=true`. La migration proposée `20261113220000_mozaik_cancel_reviewed_planned.sql` élargit l'annulation explicite uniquement aux activités **déjà liées**, identifiées par identifiant stable et dont le checkpoint est encore **`planned`**. Le protocole Cardinal doit enregistrer `parameters_verified` durablement **avant** d'essayer toute écriture de résultats. Le verrou transactionnel PostgreSQL empêche la course entre annulation et avancement du checkpoint. Si une écriture de notes a pu commencer, l'annulation reste refusée; les états création incertaine / changement de destination sont aussi exclus.

**La modification des paramètres de l'activité Mozaïk (par exemple maximum ou pondération) peut avoir déjà été appliquée avant une interruption**, même si aucune note n'est envoyée. L'annulation ne la restaure pas. Le professeur est averti de relire Mozaïk puis de préparer un nouveau lot avec un **nouvel aperçu**.

## Matrice de cas à vérifier
- Groupe 31 versus 32 : décision indépendante, jamais de valeur cachée réutilisée.
- Divergence `Gestion 39 / Mozaïk 45` dans les deux sens.
- Égalité des valeurs et `0 %` valide.
- Travail non porté au bulletin : valeur `null`, sans régression.
- Maximum différent : remise à l'échelle des notes hors lot, après aperçu.
- Description longue HTML, privée et publique : préservation et PUT natif conforme.
- Activité absente, ambiguë, mal liée ou d'un autre groupe : arrêt.
- Pondération manquante, chaîne invalide, `NaN`, négative ou >100 : arrêt.
- Modification concurrente activité/notes entre aperçu et PUT : arrêt.
- Ancien lot `legacy` : reprise de son snapshot gelé, jamais réinterprété.
- Lot `planned`, confirmation préalable, activité liée : annulation contrôlée possible **après migration**.
- Lot `parameters_verified` ou supérieur, création incertaine, destination changée : refus d'annulation; résolution séparée.
- Deux lots pendants pour le même groupe, ou navigation entre groupes : refus de sélection automatique.
- Permettre de revenir en arrière sans détruire ni notes Gestion, ni liens Formative, ni résultats Mozaïk.

## État de livraison
- **Branche et PR en préparation uniquement.** Aucun merge, changement Supabase live, ni modification de notes réelles.
- Vérification syntaxique des modules frontend; test modal avec faux DOM et tests locaux du moteur de pondération.
- **À faire avant production :** exécuter le test du dépôt `node --test resultats/tests/mozaik-weight-choice.test.cjs` sur la branche, appliquer la migration sur un environnement de préproduction, déployer la fonction compatible, installer l'extension bêta dans un profil de test et valider de bout en bout avec une activité fictive. Ne pas promouvoir en stable avant réussite.

## Revue supplémentaire — 13 novembre, correctifs de sûreté

- **Validation du backend lorsque Mozaïk fait autorité :** une ancienne pondération Gestion invalide (`NULL` ou valeur hors limites) ne doit pas empêcher le choix d'une pondération Mozaïk valide. À l'inverse, le choix Gestion conserve sa validation et `0 %` est une valeur explicite admissible. Le cas a été observé en échec avant la modification puis vérifié sur 9 scénarios du garde réel.
- **Portée au bulletin Mozaïk :** valeur `true` ou `false` requise; champ absent ou valeur de type inattendu entraîne un arrêt avant modification de l'activité. Les tests de la version Cardinal **1.3.52 BÊTA** couvrent ce refus, `0 %`, les activités hors bulletin, la description publique/privée HTML et le rejet des champs de lecture.
- **Migration d'annulation :** prévenir l'ambiguïté SQL `NULL` dans le calcul `reviewed_planned`. Une valeur absente donne toujours `FALSE` par `COALESCE(...,FALSE)`; un état confirmé sans protocole ou activité liée exacts est préservé (annulation refusée). Scénarios `missing_protocol`, `missing_link`, `wrong_activity`, `grade_started`, `valid_linked` et `not_reviewed` vérifiés via requête `SELECT` sans aucune mutation.
- Le backend, la migration et la page Gestion restent **en PR brouillon**, non déployés. Les notes élèves et journaux réels ne sont pas modifiés.
