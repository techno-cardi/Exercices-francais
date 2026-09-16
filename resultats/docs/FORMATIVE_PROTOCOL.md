# Formative protocol

This document records the current Formative correction contract. Do not invent GraphQL fields, mutation names or text evidence.

## Role of Formative

Formative is the source of truth for detailed question-by-question correction.

For an evaluation containing auto-corrected and teacher-corrected questions, keep all per-question scores in Formative. Gestion des notes should ultimately receive the global/final result, not one assignment per Formative question.

## Current stable integration

Current stable extension: **Cardinal - Gestion des notes v1.0.2**.

The correction flow is:

1. Open/select a Formative results question.
2. Use the extension popup to prepare the correction.
3. Cardinal extracts the exact Formative context, question definition, student answers and current points.
4. Cardinal builds a ChatGPT prompt containing the evaluation protocol and opens/copies it for ChatGPT.
5. ChatGPT returns a complete Markdown table `Élève | Note | Commentaire`.
6. The ChatGPT bridge verifies that the table belongs to the active Formative question/session.
7. Cardinal previews changes before publication.
8. Cardinal writes notes/comments to Formative.
9. Cardinal re-reads the server state and verifies the written points before reporting success.

## Authentication/session behavior

- capture the Formative request headers needed for GraphQL access;
- keep the active Formative session in `chrome.storage.session` so a service-worker restart/reload can recover without writing the session as a long-lived local secret;
- never send captured Formative authorization outside the local Chrome extension;
- if `Préparer une correction` needs a Formative reload, the pending action resumes automatically after reload so the teacher does not have to click twice.

## Question decoding

Cardinal must prefer the real Formative question definition over visible DOM heuristics.

Observed useful fields include:

- `_id`
- `questionNumber`
- `subtype`
- `details.points`
- `details.isRubricEnabled`
- `details.choices`
- `details.choiceLabels`
- `details.correctAnswers`
- `details.blanks`
- `rubric`
- rich `text`/DraftJS or Tiptap content

Confirmed QCM decoding rule:

`stored answer token -> index in details.choices -> label at the same index in details.choiceLabels`

For fill-in-the-blank questions, preserve the blank order from the question definition and evaluate each returned field separately.

When rich text contains DraftJS blocks, extract the actual block text so ChatGPT receives the full instruction rather than a generic `Question N` label.

## Cardinal evaluation protocol v1.1

Every prepared correction prompt includes the protocol text so the method does not depend on account memory or conversation history.

The protocol requires ChatGPT to:

1. correct independently of current Formative scores;
2. establish success criteria from the instruction, detected correction reference and supplied sources before grading students;
3. never invent text facts, line/page locations, quotations or unsupported evidence;
4. stop short of definitive grading when a required source is missing;
5. evaluate meaning rather than exact keyword matching unless exact language is what is being assessed;
6. treat identical or semantically equivalent answers consistently;
7. evaluate multi-part answers element by element and never count a duplicate twice;
8. avoid penalizing students for a reasonable ambiguity in the question itself;
9. perform a second silent consistency pass before returning the final table;
10. ensure every final score can be justified from the instruction and available evidence;
11. when the teacher supplies a corrigé, rubric, expected answer or correction examples, use that material as the primary pedagogical reference. Accept semantically equivalent answers unless exact wording is required. If the teacher reference clearly conflicts with the instruction or a verifiable source, surface the conflict instead of silently choosing one.

## Local consistency guard before publication

Cardinal performs deterministic checks on the returned table before allowing publication.

Examples of conditions that can block publication:

- two identical/equivalent structured responses receive different proposed scores;
- an objective answer explicitly matching the detected correct reference is not given the expected full score;
- the table contains a score outside `0..possiblePoints`;
- the active Formative question/session no longer matches the table context;
- a student answer changed after the correction was prepared.

The local guard complements, but does not replace, the ChatGPT reasoning pass.

## Known grade mutation

Endpoint pattern:

`POST https://svc.goformative.com/graphql/mutation/ResultsSelectedItemSidebarGradeAnswers`

Operation name:

`ResultsSelectedItemSidebarGradeAnswers`

Observed mutation shape:

```graphql
mutation ResultsSelectedItemSidebarGradeAnswers(
  $answerIds: [ID!]!,
  $points: Float!,
  $scoreFactor: Float,
  $rubricLevels: [AnswerRubricLevelInput!]!
) {
  teacherGradeAnswers(
    answerIds: $answerIds,
    points: $points,
    scoreFactor: $scoreFactor,
    rubricLevels: $rubricLevels
  ) {
    _id
    autograded
    gradedAt
    points
    possiblePoints
    rubricLevels { criterionId levelId }
    scoreFactor
    updatedAt
  }
}
```

Decimal grades are supported.

A write is not considered successful merely because the mutation returned. Cardinal requires `teacherGradeAnswers` to contain all requested answer IDs with the requested points, then performs a separate answer-details re-read and compares server points to the desired points. A short retry is allowed for propagation; a persistent mismatch is an error.

Do not assume `rubricLevels: []` is safe for a question that actively uses a structured rubric. Detect rubric-enabled questions and block automatic grade writes until exact rubric-level behavior has been verified.

## Known textual feedback mutation

Operation name:

`AddFeedbackMessage`

Input includes:

```json
{
  "input": {
    "delayed": null,
    "answerId": "ANSWER_ID",
    "formativeItemId": "QUESTION_ID",
    "studentId": "STUDENT_ID",
    "text": "TIPTAP_JSON_AS_A_STRING"
  }
}
```

The `text` field is a JSON string containing a ProseMirror/Tiptap document.

Known removal operation:

`RemoveFeedbackMessage`

No separate edit mutation has been confirmed. Do not claim one exists without a captured request.

## Publication safety rules

- do not turn unanswered/incomplete responses into zero automatically;
- leave missing students untouched;
- reject grades outside the question maximum;
- preserve exact answer IDs and student matching internally;
- show unmatched/ambiguous rows before publication;
- verify assignment/section/question/session before writing;
- preserve the pending-batch recovery path;
- comments and numeric grades remain independently controllable;
- never publish on first click without a local preview/confirmation;
- never report success before server verification;
- do not use a MutationObserver that rewrites the same Formative DOM it observes.

## Global result flow

Once Formative contains the complete evaluation, including its own auto-corrected questions and any teacher/ChatGPT-reviewed questions, use:

`Envoyer le résultat global dans Gestion des notes`

That operation creates or updates **one** Gestion assignment for the whole evaluation, using the evaluation's actual total maximum and each student's final Formative total. It must not create one Gestion assignment per question.

The selection UI should default to questions that currently have a corrected numeric pointage, while still allowing `Sélectionner tout` and `Sélectionner les questions corrigées`.

Gestion des notes then sends the global assignment to Mozaïk.

## Historical failure that must not return

An experimental v0.9.3 implementation used a MutationObserver that rewrote the DOM it was observing and could self-trigger until Formative froze. Current stable code deliberately avoids that pattern. Any future DOM observer must be read-only with respect to its observed subtree, or preferably avoided entirely.