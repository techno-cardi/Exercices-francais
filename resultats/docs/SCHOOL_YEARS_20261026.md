# Années scolaires et vue d’ensemble — 26 octobre 2026

- Années explicites, groupes et inscriptions rattachés à une année; liste historique figée pour chaque travail. Consultation des archives, réouverture manuelle explicite, préparation CSV et activation atomique avec aperçu. Aucune activation automatique par calendrier.
- Réutilisation des paramètres sans notes, commentaires, identifiants ni liens externes. Ajout tardif d’élèves explicite; aucun retrait historique implicite.
- Vue d’ensemble par groupe: élèves en lignes, travaux en colonnes, toutes les étapes par défaut, filtres étape/recherche et points/pourcentages; échecs en rouge et notes absentes distinctes de zéro. Aucun calcul de moyenne générale pondérée inventé.
- Cohortes futures réutilisant un code isolées des anciennes; comptes existants et mots de passe conservés. Les nouveaux comptes préparés restent inactifs jusqu’à l’activation. Une désactivation volontaire n’est pas annulée par le changement d’année.
- Imports et synchronisation réservés à l’année active; archives protégées également côté SQL. Historique des inscriptions protégé contre modification, suppression et troncature. Requêtes de noms conservant leur année validée, mise à jour annuelle/profil atomique.

Validation: 205 tests Gestion passent, dont SQL réel exécuté dans PGlite avec réutilisation des codes, changement de groupe, commentaires seuls, dictée, activation reportée, archives, reprise idempotente et modification tardive de liste. Revue indépendante Astra high. Essais Chrome sur données synthétiques: vue groupe, points, seuil, préparation/activation simulée et champs désactivés dans une archive. Pas de test de concurrence PostgreSQL multi-session.

Déploiement serveur: school-teacher-api v7, school-roster v6, school-results v3, school-formative-feedback v2, school-formative-link v2, school-teacher-delete-assignment v2, fr-dictee-feedback v10, mozaik-sync v6. Le bootstrap conserve 2026–2027 ouverte. Comparaison serveur avant/après: les 581 résultats, les 59 parcours de dictée et les accès des 91 comptes sont inchangés (empreintes identiques); aucun commentaire Formative séparé n’existait. Les commentaires intégrés aux résultats sont inclus dans la comparaison intégrale.

Les essais d’activation ont utilisé des données fictives; aucune année réelle n’a été archivée pendant l’installation. Les anciens RPC eleonore_identify/eleonore_update_progress n’existent pas dans le projet déployé.
