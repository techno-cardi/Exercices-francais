# Cardinal 1.3.24 — Gestion par groupe

La création multigroupe produit des travaux indépendants. Le sélecteur de Travaux change le contexte du groupe, la liste et la route ensemble.

Les imports Formative comparent les notes avant confirmation, vers un nouveau travail ou un travail existant, sur le maximum d’origine ou sur 100. Les références non arrondies permettent de remettre à l’échelle les notes conservées sans conversions cumulées. Les questions parents ne sont pas additionnées à leurs sous-parties.

L’import inverse Mozaïk copie uniquement les métadonnées et conserve l’identité exacte de l’activité, son année, son école et sa matière. Les valeurs manquantes restent incomplètes. L’envoi suivant montre les paramètres et toutes les notes affectées, y compris les notes hors lot. Un journal initial/cible accompagne chaque phase et sa reprise; la récupération d’un ancien lot ne déclare pas synchronisées des modifications plus récentes.

Les anciens travaux partagés se séparent après aperçu et attribution explicite des groupes historiques inconnus. Les notes, rétroactions Formative, documents et associations sont conservés dans des copies indépendantes. L’ancien identifiant devient une référence protégée vers le choix de groupe.

## Validation

150 tests ciblés passent, dont quatre suites SQL sur PostgreSQL WASM. Les scénarios couvrent la création indépendante/idempotente, les révisions périmées, les références canoniques, les notes nulles et nullités de métadonnées, les sous-parties, les listes incomplètes, les reprises après écriture des paramètres, les notes hors lot, les états spéciaux et les paramètres natifs.

Après rechargement de Cardinal, l’essai Chrome réel a confirmé la création de deux travaux 31/32 distincts, puis le changement du maximum du seul groupe 31. La navigation du groupe et la lecture native Mozaïk ont fonctionné; deux travaux planifiés absents ont été proposés et un titre similaire est resté à vérifier. L’aperçu Formative vers un travail existant a proposé 26 notes sur 100 et conservé cinq résultats incomplets. Les deux aperçus ont été annulés, sans publication de notes. Trois régressions supplémentaires protègent les libellés du bouton global, les destinations historiques partagées et le compteur de modifications; la liste des questions défile dans une zone limitée.

La navigation a également été contrôlée dans Chrome avec des données synthétiques et un transport réseau neutralisé. Après application du schéma réel, un essai transactionnel de création 31/32, modification/suppression indépendante et séparation a réussi puis a été intégralement annulé. Aucun travail d’essai ni résultat réel n’a été conservé par cet essai.

Les 83 fichiers JavaScript de l’extension et les ressources de son manifeste ont été vérifiés. Le paquet porte un nom de version court : `1.3.24`.

Le contrôle global `tools/check-data.mjs` attend `private/answer-bank.json`, absent du miroir. Deux tests préexistants de quiz salon sont signalés dans l’état initial du dépôt; ils ne concernent pas les flux Gestion.

## Activation coordonnée

Ordre : les quatre migrations du 26 octobre 2026, puis `school-teacher-api`, `mozaik-sync`, `school-results`, puis le frontend et Cardinal 1.3.24. Les fonctions conservent leur authentification propre, leur contrôle de clé publique et leur configuration antérieure `verify_jwt=false`. Les procédures d’écriture sont réservées au rôle de service.

Le frontend refuse d’envoyer un lot d’aperçu à une ancienne extension qui pourrait l’interpréter comme un envoi réel. Les anciens appels d’écriture de notes sont refusés avec une demande d’actualisation. Après remplacement des fichiers d’extension, recharger Cardinal puis actualiser Gestion/Formative une fois.

## Limites et retour arrière

Le contrat conditionnel de PUT Mozaïk n’a pas été vérifié. Les relectures juste avant écriture et la vérification finale détectent les conflits observables, sans supprimer la dernière fenêtre de concurrence entre GET et PUT. Un identifiant de création perdu reste à résoudre explicitement; aucune seconde création automatique n’est tentée.

Un retour arrière doit conserver les nouvelles colonnes, journaux et copies indépendantes. Ne pas restaurer un ancien client capable d’écrire directement des notes ni fusionner des copies qui ont divergé. Les versions antérieures des fonctions ont été sauvegardées avant activation; si nécessaire, désactiver les nouvelles écritures et conserver les fonctions de consultation pendant la réparation.
