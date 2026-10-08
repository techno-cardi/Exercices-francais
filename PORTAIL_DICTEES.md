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


## Éléonore 3e secondaire - état réel au 8 octobre 2026 (mise à jour)
- Travail unique dans Gestion des notes : id `97453ffa-8551-432f-88f1-fd708c80b3d9`, slug `dictee-eleonore-2026-10-08`; groupes 31 et 32, note /20, **non publié**, non transmis à Mozaïk. Groupe 31 : 29 notes inscrites. Groupe 32 : copies pas encore reçues.
- Relecture de la copie manuscrite de un élève du groupe 31 : note clairement **une note rectifiée**, et non 15/20; résultat corrigé dans Gestion des notes et PDF remplacé sur Drive, lien privé mis à jour, ancienne version erronée supprimée. N'enregistrer que la note du professeur.
- 29 PDF privés du groupe 31 et 29 partages lecteur individuels, sans accès au dossier commun. Les 29 liens de PDF et les 29 empreintes distinctes des codes secrets sont stockés exclusivement dans Supabase.
- Table privée `public.fr_dictee_feedback` déployée sous RLS, sans droits table aux rôles `anon` ni `authenticated`; migration archivée dans `supabase/migrations/20261008180000_fr_dictee_feedback.sql`.
- Edge Function `fr-dictee-feedback` ACTIVE : exige la clé publiable ET un jeton de session de l'élève (créé via le service existant `school-results/studentLogin`) pour toute consultation ou écriture. Les fonctions enseignant valident le jeton enseignant existant. Les choix de stratégies sont validés côté serveur, chaque erreur doit être confirmée, code secret vérifié par empreinte et limite d'essais.
- Page `index.html` : l'élève de 3e entre son courriel scolaire et sa fiche pour recevoir un jeton à durée limitée, sans enregistrer la fiche dans sa session persistée. Pour les élèves de 5e, préserver Marianne sans modification. Le gardien de `dictee-eleonore.html` a été adapté à l'authentification par jeton.
- `dictee-eleonore.html` charge `assets/eleonore-feedback.js` pour le parcours à 4 étapes. `controle-dictees.html` propose le suivi enseignant et les filtres travail/groupe. L'ancienne console `controle.html` de Marianne demeure disponible.
- **Aucune rétroaction individuelle publiée** : toutes les lignes ont `released=false`. L'absence de publication empêche le backend de rendre notes, erreurs, lien PDF et progression à l'élève. Le parcours est installé, mais pas encore validé en usage réel avec un compte élève.
- Relevés d'erreurs : 12 copies documentées individuellement, dont une élève sans erreur, 17 restent à vérifier intégralement. Ne pas déduire les erreurs à partir du pointage ni publier avant vérification complète. Corriger toute incohérence entre la note manuscrite, Gestion des notes et le bilan PDF.
- Tests locaux de scripts et logique passés. **Tests de bout en bout réels encore requis** sur le portail, la persistance, le partage PDF, la validation correcte/fausse et la console. Le niveau de préparation ne doit pas être présenté comme une publication aux élèves.


## 8 octobre 2026 - reprise groupes 31 et 32, aperçu enseignant
- Les deux groupes utilisent le même travail de dictée `97453ffa-8551-432f-88f1-fd708c80b3d9`, conservé non publié dans Gestion des notes. Groupe 31 : 29 notes et PDF. Groupe 32 : 30 notes et PDF, une copie absente.
- `fr_dictee_feedback` : 29 enregistrements privés du groupe 31, dont 28 erreurs personnalisées vérifiées; 30 du groupe 32, encore à documenter. **Aucun `released=true` pour le moment.**
- Fichiers dans Drive, sous-dossiers des groupes 31 et 32 : accès lecteurs individuels uniquement, 29+30 dossiers PDF à trois pages. Chaque PDF a un mot secret unique avec uniquement son empreinte serveur. Un dossier collectif ne doit jamais être partagé.
- La console `controle-dictees.html` autorise maintenant un clic sur le nom de chaque élève, affichant en fenêtre intégrée l'aperçu de la page Éléonore. Un jeton enseignant valide est exigé par l'action serveur `teacherPreview` de la Edge Function `fr-dictee-feedback` (version 2). Aucune progression élève n'est modifiée. Le JS de prévisualisation désactive les contrôles de saisie.
- L'enseignant se connecte à la console avec son courriel et le **mot de passe actuel de Gestion des notes**, via `school-results/teacherLogin`. Il n'existe pas de mot de passe statique en GitHub et il ne faut pas en créer un dans le HTML. La récupération/réinitialisation relève de l'identité enseignante déjà existante.
- **Tests réels restant nécessaires** : connexion de l'enseignant, aperçu, ouverture des 59 PDF selon les permissions, parcours élève, cases à trois choix, validation correcte/fausse du mot secret et persistance. Ne pas déclarer la console validée de bout en bout sans ces essais.
- Le groupe 31 conserve une fiche PPA à interprétation incertaine avant publication. Le groupe 32 n'a encore aucune analyse exhaustive des erreurs. Les résultats et les PDF sont prêts, mais les parcours interactifs personnels restent volontairement masqués.


## État actuel - octobre 2026, groupes 31 et 32
- Le groupe 31 a 29 dossiers avec 129 corrections personnalisées; le groupe 32 a 30 dossiers avec 106 corrections personnalisées. Tous les 59 dossiers correspondants ont `released=true` dans `fr_dictee_feedback`.
- Tous les 59 PDF de trois pages sont déposés dans des dossiers privés sur Drive et partagés avec un seul destinataire étudiant en lecture seule. Les liens sont conservés dans Supabase, pas dans GitHub.
- Un élève inscrit au groupe 32 n'a pas de copie identifiable dans le document transmis; aucun score ou dossier ne doit être créé sans copie.
- `school_assignments.published=false` est distinct du portail de dictées : le travail d'autocorrection est disponible, mais la publication académique de Gestion des notes reste inchangée.
- La méthode détaillée renvoie à La boîte à outils 2026-2027 p. 1 : relecture, noms communs pointés et accordés avec flèches, verbes surlignés reliés au sujet, remplacement du sujet GN par un pronom, système verbal, participes passés, homophones et Usito. Les omissions relèvent de l'écoute et de la fidélité aux mots dictés.
- Le portail `index.html`, la page `dictee-eleonore.html`, le script `assets/eleonore-feedback.js`, la console `controle-dictees.html` et la fonction serveur `fr-dictee-feedback` sont en place. Chaque élève se connecte par sa fiche et son courriel; le mot secret se valide côté serveur et le professeur peut voir une prévisualisation en lecture seule.
- Contrôles réalisés : intégrité des 59 codes et URL, validations de structure des 235 erreurs, permissions Drive individuelles, syntaxe JavaScript et diversité des trois positions de réponse. Un essai de bout en bout avec un véritable compte élève et la vérification du site GitHub Pages restent non réalisables dans cette session.
- Sécurité : ne placer aucun nom d'élève, note individuelle, courriel étudiant, fiche, mot secret ou URL de PDF dans ce dépôt public.


## Accès unifié au portail - 8 octobre 2026
- Tous les élèves des groupes 31, 32 et 51 entrent **courriel scolaire et numéro de fiche à sept chiffres** dans `index.html`. L'option d'accès par fiche seule a été supprimée du portail.
- Le service `school-results/studentLogin` vérifie la correspondance courriel/fiche pour les trois groupes et délivre une session éphémère. Le groupe détermine le niveau : 31/32 → 3e, 51 → 5e.
- `dictee-marianne.html` exige une session scolaire valable (courriel, jeton, groupe 51) et reprend automatiquement la fiche validée sur le portail. Le deuxième formulaire visible de saisie a été retiré. Le service RPC historique de Marianne est encore utilisé pour les corrections et la progression; toute migration future devra conserver le fonctionnement des élèves et la confidentialité.
- Ce changement ne modifie pas les notes, les partages de PDF, les codes secrets ou la publication des dictées.
- Vérification : les scripts JavaScript des pages `index.html`, `dictee-marianne.html` et `dictee-eleonore.html` ont été analysés sans erreur de syntaxe. Essai de bout en bout réel sur GitHub Pages encore nécessaire, le site public n'étant pas accessible à cet outil.
