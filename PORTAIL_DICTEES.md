# Portail des dictées de français - état au 8 octobre 2026

## But
Une seule porte d'entrée pour les élèves: `index.html` avec numéro de fiche sur 7 chiffres (préserver les zéros initiaux), puis tableau de bord du niveau autorisé par le serveur. Les travaux sont ouverts dans des pages distinctes, sans mélanger les niveaux. Les notes et les copies sont uniquement renvoyées par le backend après identification, jamais incluses dans le code public.

## Pages en place
- `index.html`: nouvelle connexion, accueil personnel et cartes des travaux. Registre `works` filtré selon `student.level`; 3e: Éléonore, 5e: Marianne. Sans validation du serveur, aucun tableau de bord.
- `dictee-marianne.html`: copie de l'ancienne page d'accueil « Marianne » avec son comportement de correction, ses API et son suivi inchangés. Un lien vers le portail et une reprise de la fiche transmise via `sessionStorage` de moins de 60 secondes ont été ajoutés.
- `dictee-eleonore.html`: texte de dictée reproduit à l'identique (79 mots), 22 annotations grammaticales accessibles, explication détaillée du PPA avec CD avant/après, autres accords, plus-que-parfait et passé simple, homophones, lexique, ponctuation. Quatre activités autonomes avec rétroaction formative. Vues texte expliqué et texte sans annotation fonctionnelles.
- `controle.html`: conserve le suivi existant de Marianne, sans modification.

## Ce qui fonctionne aujourd'hui
1. La dictée Marianne reste à sa nouvelle adresse et garde ses RPC existantes `marianne_identify`, `marianne_update_progress`, `marianne_confirm`.
2. Connexion de 5e avec la RPC existante `marianne_identify` en solution transitoire.
3. Accès à la page publique pédagogique d'Éléonore, navigation par annotations, modale, exercices et retour au portail.
4. Préparation des zones « Voir mes erreurs », « Ma copie » et progression pour Éléonore, non activées sans réponse individuelle provenant d'un backend.

## À relier lors de l'importation des données de 3e
- Le portail tente `fr_portal_identify({p_fiche})`; en cas de RPC manquante il tente l'identification existante de Marianne. Retour attendu pour la fonction de portail: `{ok:true,first,level:3|5,group,progress}`. Le backend doit déterminer le niveau, jamais la saisie du navigateur.
- Pour Éléonore, le portail transmet la fiche pendant moins de 60 s via `sessionStorage`, supprimée dès la lecture. La page prévoit `eleonore_identify({p_fiche})` avec `{ok,first,studentKey,note?,copyUrl?,errorKeys,errors,progress}`. Chaque erreur a une clé qui correspond à l'une des 22 annotations (`data-rule`) et éventuellement `written` et `comment`. La progression est prévue par `eleonore_update_progress({p_fiche,p_understood_keys})`.
- Aucune donnée individuelle de secondaire 3, aucune copie, aucun résultat, aucun numéro de fiche d'élève n'a été chargé dans GitHub. Les fonctions et tables correspondantes ne sont pas déployées par ce changement.
- Le portail devra à terme recevoir l'attribution précise des travaux côté serveur et l'appliquer également aux accès aux copies.
- Les liens vers les scans d'élèves doivent être à durée limitée et protégés; ne jamais publier des scans ou des URL publiques dans le dépôt. Une fiche seule n'est **pas** un secret robuste: avant de diffuser des données nominatives à grande échelle, installer une vérification d'accès renforcée ou une authentification institutionnelle, avec limitation des tentatives, autorisation par élève et RLS.

## Contrainte de conservation
**Ne jamais supprimer Marianne ni ses RPC en modifiant le portail.** Ne pas confondre le portail des dictées avec le sous-projet `resultats/` et l'ancien atelier `eleve.html`. Toujours relire les fichiers GitHub actuels et utiliser leur blob SHA pour chaque mise à jour.

## Vérification
- Scripts des trois pages compilés sans erreur de syntaxe dans un parseur JavaScript V8.
- Dictée d'Éléonore comparée caractère par caractère au texte source (avant ajouts de nouvelles annotations, qui ne modifient pas le texte visible).
- Clés des annotations liées aux règles, vérifiées.
- Pas de test de connexion secondaire 3 ni de copie individuelle: données et RPC requises encore à créer/configurer.

## Correctif du 8 octobre 2026 : contrôle de l'accès et lisibilité
- `index.html` conserve une session temporaire de vingt minutes dans `sessionStorage`, créée uniquement après identification via une RPC. Le retour à l'accueil dans le même onglet conserve le tableau de bord jusqu'à expiration ou déconnexion. La déconnexion efface session et tickets des travaux.
- `dictee-eleonore.html` et `dictee-marianne.html` possèdent maintenant un gardien en tête de page. Si aucune session correspondant au bon niveau n'est présente ou si elle est expirée, redirection immédiate vers l'accueil. Masquage du corps du document avant validation pour éviter l'affichage fugitif du travail.
- Marianne utilise sa RPC existante pour charger le retour individuel après navigation depuis l'accueil et récupération de la fiche côté session temporaire.
- Éléonore a maintenant 22 mini-leçons structurées (phrase ciblée, 2 ou 3 étapes, comparaison lorsque pertinente). Le cas « l'avait ouvert » montre le CD avant le verbe, l'antécédent masculin singulier et une comparaison avec « la porte qu'elle avait ouverte ». « Lui » est correctement étiqueté CI, tandis que « trois vœux » est CD.
- IMPORTANT : ce gardien côté navigateur est une contrainte de parcours, **pas** une mesure d'autorisation côté serveur. Les fichiers HTML restent techniquement publics sur GitHub Pages. Avant publication de notes/copies, leurs API, scans et accès aux données doivent être sécurisés côté serveur (identité, autorisation par élève, protections anti-tentatives multiples). Le numéro de fiche ne constitue pas à lui seul un secret solide.
- Les accès de secondaire 3 demeurent non opérationnels avant liaison de `fr_portal_identify` avec une liste réelle des élèves de troisième secondaire. Les autres pages de travail restent inaccessibles sans passer par la connexion au portail.
