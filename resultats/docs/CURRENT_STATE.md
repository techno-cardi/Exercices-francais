# Current state

Last updated: **2026-10-06**

This is the first status file a future ChatGPT should read after the project instructions.

## Executive status

The production flow is stable and usable for:

- Formative question correction assisted by ChatGPT;
- guarded return of notes/comments to the exact Formative question;
- global Formative evaluation -> one Gestion des notes assignment/result;
- manual assignment creation and grade entry in Gestion des notes;
- student result viewing;
- Gestion des notes -> Mozaïk synchronization;
- assignment deletion from Gestion without silently deleting the external Formative/Mozaïk item;
- group-specific statistics and dynamic group handling.

Preferred evaluation flow:

`Formative -> ChatGPT-assisted question correction -> verified return to Formative -> global Formative result -> Gestion des notes -> Mozaïk`

Formative remains the source of truth for question-level correction. Gestion normally stores the final/global evaluation result rather than one assignment per question.

## Current stable extension

Current release: **Cardinal - Gestion des notes v1.0.2 STABLE**.

Distribution: manual unpacked extension.

Published release metadata lives in `resultats/mozaik/cardinal-extension-latest.json`.

SHA-256 for v1.0.2:

`91ca00c93181d6909db66f2ac9cb60a4b70d12ef2b62b02045c4fa34ff4448ef`

### Stable behaviors that must not regress

- `Préparer une correction` resumes automatically after a Formative reload, so one click is sufficient;
- Formative session headers are held in `chrome.storage.session`, not persisted as long-lived local secrets;
- the normal UI does not expose the diagnostic button;
- DraftJS/fill-in-the-blank question text is decoded into the real instruction;
- the ChatGPT result is bound to the active Formative question/session and stale-question publication is blocked;
- the Formative mutation response must contain every requested answer ID with the requested points;
- after writing notes, Cardinal re-reads the server state and verifies the points before reporting success;
- the Formative decoder supports structured QCM choices (`choices` -> `choiceLabels`) and ordered blanks;
- Mozaïk group discovery remains dynamic and validated rather than hardcoded;
- no MutationObserver may rewrite the observed Formative DOM. The old self-triggering approach previously froze Formative and must never return.

## Cardinal evaluation protocol

v1.0.2 ships **Protocole Cardinal d’évaluation v1.1** inside every correction prompt. This makes the correction method independent of ChatGPT account memory.

Core rules:

- current Formative points are reference-only and must not anchor the correction;
- criteria are established from the instruction, detected correction reference and sources actually supplied;
- do not invent text facts, line/page locations or unsupported evidence;
- if a required source is missing, do not guess a definitive grade;
- grade meaning rather than exact keywords unless exact language is what is being assessed;
- identical or semantically equivalent answers receive the same treatment;
- multi-part answers are evaluated element by element and duplicates are not counted twice;
- reasonable ambiguity in the question is not charged against students;
- perform a second silent consistency pass before returning the final table;
- a teacher-provided corrigé, rubric, expected answer or examples become the primary pedagogical reference, unless they clearly conflict with the instruction or a verifiable source, in which case the conflict must be surfaced rather than silently resolved.

Cardinal also performs local consistency checks before allowing publication, including detection of identical/equivalent responses receiving inconsistent grades and objective reference answers that are not awarded the expected full score.

## Gestion des notes frontend

Main page: `resultats/index.html`.

Direct load chain:

- `app.js`
- `app-patch-v04.js`
- `app-patch-v05.js`
- `app-patch-v06.js`

`app-patch-v05.js` then loads the active Formative client/safety layer and UI patches v08, v09, v10 and v11.

Important responsibilities:

- v04: grade rounding, roster merge, unified visibility, assignment opening;
- v05: routing persistence, Formative client loading, UI patch orchestration and immediate Mozaïk progress feedback;
- v06: work statistics/feedback bridge loading, post-sync refresh and safe assignment deletion;
- v08: dynamic groups, dashboard rebuild and Mozaïk discovery coordination;
- v09: copy-work settings and persistent Mozaïk mapping status;
- v10: new-work group UX;
- v11: compact new-work presentation and creation-mode layout.

Do not collapse these patches casually just to make the file count smaller. They wrap shared functions in a deliberate order; a large refactor needs regression testing of every workflow.

### Branding/icon cleanup

The active Gestion icon has one authoritative visible source:

`resultats/assets/cardinal-extension-icon-v1004.svg?v=1004`

`index.html` references it directly for the favicon and visible site logos. Do not reintroduce JavaScript that rewrites the favicon/logo after page load; that caused profile-specific cache confusion.

Older `.b64`/v1003 icon assets are retained for backward compatibility with cached historical code. They are not the visible source for the current page and should not be deleted until old cached clients are no longer relevant.

## Current live backend versions

Supabase project: `ojyswaxuqwnqilrvtjll`

- `school-results`: v1
- `school-student-auth`: v1
- `school-teacher-api`: v4
- `school-roster`: v5
- `mozaik-sync`: v4
- `school-formative-link`: v1
- `school-teacher-delete-assignment`: v1
- `school-formative-feedback`: v1

The deployed Supabase source is authoritative. Fetch the live function before editing/deploying.

`verify_jwt=false` remains intentional for the relevant functions because the application uses its existing publishable-key + application-session-token validation. Do not flip this blindly.

## Mozaïk durability rules

- no active business-rule allow-list for groups 31/32/51;
- active groups come from the current roster/data;
- previous mapping is a navigation/ranking hint, not proof;
- changed mapping must pass backend roster validation before being saved;
- ambiguous candidates are rejected instead of guessed;
- the academic year is derived primarily from authenticated Mozaïk identifiers actually observed;
- for `reportCardEnabled=false`, preserve official portal behavior `parametresEvaluation.ponderation = null`.

The browser-local Mozaïk bearer must never be sent to GitHub, Supabase or ChatGPT.

## Repository hygiene note

`resultats/mozaik/extension/` contains older historical source files and its old manifest is not the release-version authority. Before using that directory as a build source, compare it against `cardinal-extension-latest.json` and the current installed/stable package. Do not accidentally rebuild a current release from a legacy 0.8.x manifest.

Historical files are being retained rather than aggressively deleted because several old cache paths and rollback references still exist. Prefer making active entry points explicit over deleting history during a stability pass.

## Dictée Marianne - groupe 51

The current student feedback page is the repository root `index.html`; teacher progress tracking is in `controle.html`.

On 2026-10-06, the metacognitive verification choices were corrected so the right strategy is no longer always the first option. The correct position is now deterministic from the student fiche and error key: it varies across errors/students but stays stable when the same student reopens the same error. The pedagogical category mapping and the three-choice format are unchanged.

## Regression checklist before any future stable release

1. Open Formative on a real results question and use `Préparer une correction` once, including the reload path.
2. Verify the prompt contains the real question text, structured answers and Cardinal evaluation protocol.
3. Return a valid `Élève | Note | Commentaire` table and verify the ChatGPT button names the correct question.
4. Preview and publish to Formative; require `relecture serveur confirmée` before considering the write successful.
5. Verify a stale Q2/Q3 mismatch is blocked.
6. Verify global Formative -> Gestion creates/updates one evaluation and preserves corrected-question selection.
7. Open an existing Gestion assignment, enter/edit grades and verify refresh/navigation persistence.
8. Verify first Mozaïk sync discovers/validates the current group/year and subsequent sync reuses the mapping when valid.
9. Verify an already linked activity updates instead of duplicating.
10. Verify non-bulletin activity behavior preserves `ponderation:null`.
11. Verify new-work UX, copy-settings, deletion and icon rendering in both a normal and private Chrome profile.

When a stable flow passes, avoid changing the core engine without a concrete bug or requirement.

## Éléonore 3e secondaire - état réel au 8 octobre 2026 (mise à jour)
- Travail unique dans Gestion des notes : id `97453ffa-8551-432f-88f1-fd708c80b3d9`, slug `dictee-eleonore-2026-10-08`; groupes 31 et 32, note /20, **non publié**, non transmis à Mozaïk. Groupe 31 : 29 notes inscrites. Groupe 32 : copies pas encore reçues.
- Relecture de la copie manuscrite de un élève : note clairement **une note rectifiée**, et non 15/20; résultat corrigé dans Gestion des notes et PDF remplacé sur Drive, lien privé mis à jour, ancienne version erronée supprimée. N'enregistrer que la note du professeur.
- 29 PDF privés du groupe 31 et 29 partages lecteur individuels, sans accès au dossier commun. Les 29 liens de PDF et les 29 empreintes distinctes des codes secrets sont stockés exclusivement dans Supabase.
- Table privée `public.fr_dictee_feedback` déployée sous RLS, sans droits table aux rôles `anon` ni `authenticated`; migration archivée dans `supabase/migrations/20261008180000_fr_dictee_feedback.sql`.
- Edge Function `fr-dictee-feedback` ACTIVE : exige la clé publiable ET un jeton de session de l'élève (créé via le service existant `school-results/studentLogin`) pour toute consultation ou écriture. Les fonctions enseignant valident le jeton enseignant existant. Les choix de stratégies sont validés côté serveur, chaque erreur doit être confirmée, code secret vérifié par empreinte et limite d'essais.
- Page `index.html` : l'élève de 3e entre son courriel scolaire et sa fiche pour recevoir un jeton à durée limitée, sans enregistrer la fiche dans sa session persistée. Pour les élèves de 5e, préserver Marianne sans modification. Le gardien de `dictee-eleonore.html` a été adapté à l'authentification par jeton.
- `dictee-eleonore.html` charge `assets/eleonore-feedback.js` pour le parcours à 4 étapes. `controle-dictees.html` propose le suivi enseignant et les filtres travail/groupe. L'ancienne console `controle.html` de Marianne demeure disponible.
- **Aucune rétroaction individuelle publiée** : toutes les lignes ont `released=false`. L'absence de publication empêche le backend de rendre notes, erreurs, lien PDF et progression à l'élève. Le parcours est installé, mais pas encore validé en usage réel avec un compte élève.
- Relevés d'erreurs : 12 copies documentées individuellement, dont une élève sans erreur, 17 restent à vérifier intégralement. Ne pas déduire les erreurs à partir du pointage ni publier avant vérification complète. Corriger toute incohérence entre la note manuscrite, Gestion des notes et le bilan PDF.
- Tests locaux de scripts et logique passés. **Tests de bout en bout réels encore requis** sur le portail, la persistance, le partage PDF, la validation correcte/fausse et la console. Le niveau de préparation ne doit pas être présenté comme une publication aux élèves.


## Reprise après interruption de connexion, 8 octobre 2026
- État Supabase relu : 29 lignes privées, **23 vérifications complètes** (`errors_verified=true`), **6 en attente**, 91 erreurs personnalisées; **0 ligne `released`**. Aucun élève n'a été publié dans le parcours interactif.
- Six dossiers validés depuis la reconnexion : un élève, un élève, un élève, un élève, un élève, un élève; puis un élève. Les notes manuscrites demeurent inchangées.
- Six dossiers difficiles non publiables : un élève, un élève, un élève, un élève, un élève, un élève. Détails privés de relecture dans le dossier Drive enseignant; ne pas inférer des erreurs à partir du score, ne pas modifier `released` sans revue.
- Audit des PDF : 29 PDF à trois pages, 29 mots secrets uniques, les 29 empreintes SHA-256 des codes imprimés concordent avec l'import privé. Le doublon local du PDF rectifié de un élève a été archivé; les trois pages de ses deux variantes étaient identiques en rendu.
- Contrôle local passé : `tests/check_choices.py`, `tests/check_integration.py`, `tests/check_backend.cjs`; le test d'intégration vérifie les 29 scans et les scripts. Cela **ne constitue pas un test complet en situation réelle** avec des comptes élèves.
- Tableaux privés de suivi déposés dans le dossier Drive de la dictée, version 23/29, et tableau détaillé des 6 copies à relire. Sans accès au dossier, élèves autorisés uniquement à leurs PDF personnels.
- Les quatre fichiers publics et la Edge Function restent installés; aucun test réel intercomptes (un autre élève) n'a été conduit; garder les données non publiées. Groupe 32 : aucune copie reçue.


## État actuel - dictée Éléonore - 8 octobre 2026 (référence prioritaire)
- Groupe 31 : 29/29 dossiers vérifiés et accessibles individuellement; 129 rétroactions, 29 PDF définitifs privés en lecture seule, et 29 lignes `released=true` dans `fr_dictee_feedback`.
- Groupe 32 : 30/30 dossiers transmis vérifiés et accessibles individuellement; 106 rétroactions, 30 PDF définitifs privés en lecture seule, et 30 lignes `released=true`. Un élève inscrit ne figure pas dans les 60 pages transmises; ne pas créer de note ou de dossier sans copie identifiable.
- 59 codes secrets distincts, empreintes SHA-256 correspondantes et 59 URL de copies mises à jour en base privée. Les 59 PDF sont constitués de trois pages et contiennent le bilan personnalisé, la copie corrigée et la feuille de vérification.
- La méthode pédagogique affichée renvoie à La boîte à outils (2026-2027), p. 1 : relecture, noms pointés avec genre/nombre et flèches, verbes surlignés et sujets reliés, remplacement par un pronom, accords des participes passés, homophones et Usito. Les omissions de mots font travailler l’écoute et non Usito.
- Console : `controle-dictees.html`, connexion via `school-teacher-api`, aperçu individuel authentifié en lecture seule. Élèves : portail `index.html`, authentification `school-results/studentLogin`, puis `dictee-eleonore.html`. Le module `assets/eleonore-feedback.js` et la fonction `fr-dictee-feedback` gèrent progression, stratégies à trois choix et mot secret côté serveur.
- L'assignation académique `school_assignments.published=false` reste séparée de l'activation pédagogique de `fr_dictee_feedback.released=true`. Ne pas modifier la publication de Gestion des notes sans demande explicite.
- Les contrôles de schéma, correspondances PDF/codes et JavaScript ont été vérifiés. L'ouverture réelle par un élève avec son compte, la vérification du secret en situation de classe et les performances du site GitHub Pages n'ont pas été testées depuis cette session. Un test de bout en bout réel demeure requis.
- **Confidentialité** : ne mettre aucun nom, numéro de fiche, note nominative, secret ou URL de copie privée dans le dépôt public. Conserver ces données exclusivement dans Supabase et Drive avec accès individuel.


## Accès unifié au portail - 8 octobre 2026
- Tous les élèves des groupes 31, 32 et 51 entrent **courriel scolaire et numéro de fiche à sept chiffres** dans `index.html`. L'option d'accès par fiche seule a été supprimée du portail.
- Le service `school-results/studentLogin` vérifie la correspondance courriel/fiche pour les trois groupes et délivre une session éphémère. Le groupe détermine le niveau : 31/32 → 3e, 51 → 5e.
- `dictee-marianne.html` exige une session scolaire valable (courriel, jeton, groupe 51) et reprend automatiquement la fiche validée sur le portail. Le deuxième formulaire visible de saisie a été retiré. Le service RPC historique de Marianne est encore utilisé pour les corrections et la progression; toute migration future devra conserver le fonctionnement des élèves et la confidentialité.
- Ce changement ne modifie pas les notes, les partages de PDF, les codes secrets ou la publication des dictées.
- Vérification : les scripts JavaScript des pages `index.html`, `dictee-marianne.html` et `dictee-eleonore.html` ont été analysés sans erreur de syntaxe. Essai de bout en bout réel sur GitHub Pages encore nécessaire, le site public n'étant pas accessible à cet outil.


## 9 octobre 2026 - affichage personnel de la dictée
- Le texte corrigé, avec son titre, apparaît immédiatement après l’introduction et avant la stratégie complète.
- Après chargement sécurisé, le mode par défaut souligne en rouge les passages correspondant aux erreurs individuelles. Les boutons basculent réellement entre erreurs personnelles, difficultés expliquées en bleu et texte sans soulignement.
- Les repères utilisent les formes corrigées et les positions dans le texte, sans attribuer une notion générale à un élève sur la seule base de sa catégorie. Les clés de révision, omissions, ponctuation, titre et occurrences répétées sont prises en charge; les corrections ambiguës nécessitent une occurrence explicite dans les données privées.
- Les fenêtres personnelles affichent la forme écrite, la correction et l’explication individuelles. La validation des stratégies, la progression et le mot secret restent gérés par le module et le serveur existants. Aucun résultat académique modifié.
- Vérifications: scripts analysés sans erreur; exécution dans un DOM de test sur les 59 dossiers privés, leurs 249 corrections, trois modes et fenêtres personnelles. Les données nominatives et fixtures restent hors dépôt. Deux positions de mots répétés confirmées visuellement sur les scans, puis précisées dans Supabase sans changer les clés ni la progression.
- Limite: ces tests de DOM ne constituent pas une connexion réelle avec un compte élève. Le lancement du navigateur local est bloqué par l’environnement; la vue publique du portail est accessible au navigateur distant, mais sans session élève disponible.


## 9 octobre 2026 - note en haut et audit pédagogique (référence la plus récente)
- 59 dossiers privés et 249 corrections, tous vérifiés et accessibles. La note /20 apparaît sous le titre après chargement authentifié; 0 est une note valide, une note absente est indiquée à confirmer.
- Les 59 pages manuscrites corrigées ont été relues. Les localisations titre/corps et une deuxième occurrence ont été précisées. Une erreur attribuée à tort à un titre incomplet a été remplacée par le passage effectivement entouré; la première page du PDF correspondant a été remplacée dans le même fichier Drive. Note, mot secret et pages manuscrites conservés.
- Les 249 questions ont une règle ciblée, trois réponses distinctes et une explication après chaque choix. Les lettres incertaines ne sont pas inventées. Les formes lexicales, homophones, participes, sujets, ponctuation et omissions suivent la difficulté signalée.
- Les élèves ayant terminé disposent d’un entraînement libre sans nouvelle écriture de progression. Les requêtes du parcours sont sérialisées pour éviter des écritures simultanées dans un même onglet. L’aperçu enseignant reste en lecture seule, y compris le lien PDF.
- Relecture après écriture Supabase : 59 dossiers conformes aux changements attendus; notes, copies, progression et dates de fin identiques. Les données nominatives et les fixtures de test restent hors dépôt public.
- Vérifications locales : syntaxe, localisation de 249 corrections dans le DOM, modes et fenêtres personnelles; 177 scénarios élève/terminé/enseignant et 498 essais de réponses justes/fausses, cas sans erreur, notes 0/absentes et blocage de la validation avant compréhension. Le PDF remplacé a été téléchargé et comparé octet par octet.
- Limite : aucun test avec une session réelle d’élève ou d’enseignant. Ces contrôles locaux avec API simulée ne valident pas à eux seuls une connexion réelle ni tous les droits de partage. Aucun changement de publication académique ni de note.
