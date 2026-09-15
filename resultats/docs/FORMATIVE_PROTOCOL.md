# Formative protocol

This file documents only facts that have been observed or implemented. Do not invent GraphQL fields or mutation names.

## Role of Formative

Formative is the source of truth for detailed question-by-question correction.

For an evaluation containing auto-corrected and teacher-corrected questions, keep all per-question scores in Formative. Gestion des notes should ultimately receive the global/final result, not one assignment per Formative question.

## Current stable integration

The last known-good extension is v0.8.2.

It can:

- capture the active Formative results page;
- read the assignment/class context, roster, questions, answer IDs and current numeric points;
- send selected Formative question totals into Gestion des notes;
- link an existing Gestion assignment to one Formative question without necessarily replacing Gestion grades;
- send grades from Gestion des notes back to a linked single Formative question.

The working service worker in the verified v0.8.2 package is `background-v081.js`, despite the filename.

Important auth behavior in v0.8.2:

- capture request headers such as `authorization`, `x-user-id`, `x-session-id`, `x-tab-id`, `x-app-version`, `x-anonymous-id`;
- require a captured Formative `authorization` header before API use;
- do not use `credentials: 'include'` for the cross-origin Formative GraphQL requests from the extension service worker;
- never send the captured Formative auth outside the local Chrome extension.

## Known grade mutation

Endpoint pattern:

`POST https://svc.goformative.com/graphql/mutation/ResultsSelectedItemSidebarGradeAnswers`

Operation name:

`ResultsSelectedItemSidebarGradeAnswers`

Observed mutation:

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

The stable connector groups answers that receive the same points/possiblePoints where useful and writes by exact `answerId`.

Decimal grades have been confirmed to work.

Do not assume `rubricLevels: []` is safe for a question that actively uses a structured rubric. Detect rubric-enabled questions and block automatic grade writes until the exact rubric-level behavior has been verified.

## Known teacher-feedback mutation

Add textual feedback:

Endpoint pattern:

`POST https://svc.goformative.com/graphql/mutation/AddFeedbackMessage`

Operation name:

`AddFeedbackMessage`

Mutation:

```graphql
mutation AddFeedbackMessage($input: AddFeedbackMessageInput!) {
  addFeedbackMessage(input: $input) {
    feedbackMessage {
      _id
      delayed
      __typename
    }
    __typename
  }
}
```

Input requires:

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

The `text` field is a JSON string containing a ProseMirror/Tiptap document. Plain text can be wrapped as:

```json
{
  "type": "doc",
  "attrs": { "dir": "auto" },
  "content": [
    {
      "type": "paragraph",
      "attrs": { "dir": "auto", "textAlign": null },
      "content": [
        { "type": "text", "text": "COMMENT HERE" }
      ]
    }
  ]
}
```

The mutation returns a `feedbackMessage._id`. Store that ID if the app needs idempotent retry or later removal.

## Known feedback removal mutation

Operation name:

`RemoveFeedbackMessage`

Mutation:

```graphql
mutation RemoveFeedbackMessage($input: RemoveFeedbackMessageInput!) {
  payload: removeFeedbackMessage(input: $input)
}
```

Variables:

```json
{
  "input": {
    "feedbackMessageId": "FEEDBACK_MESSAGE_ID"
  }
}
```

No separate edit mutation has been confirmed. The observed UI behavior for changing feedback was compatible with remove + add. Do not claim a formal edit mutation exists until it is captured.

## Question content facts already observed

In Formative item data, a long-answer question was observed with fields including:

- `_id`
- `questionNumber`
- `subtype: "longAnswer"`
- `details.points`
- `details.isRubricEnabled`
- `rubric`
- `text` as Tiptap/ProseMirror JSON string

For example, the observed Q2 test item had `details.points: 10` and `details.isRubricEnabled: null`.

When extracting question text for ChatGPT, parse the rich-text JSON safely instead of sending raw JSON if possible.

## Safety behavior for imports into Gestion des notes

The `school-teacher-api` Formative import currently treats selected questions as follows:

- only students matched to the intended group are imported;
- if any selected question for a student has no numeric points, that student is left untouched;
- an incomplete answer must never become zero automatically;
- when grades are imported into an already Mozaïk-linked assignment, the assignment/link should become dirty so the teacher knows Mozaïk is no longer current.

The frontend safety layer also supports linking an existing Gestion assignment to Formative without overwriting existing Gestion grades by default.

## Target ChatGPT-assisted correction UX

The desired direction is intentionally simple and uses the same Chrome extension, not a second ChatGPT connector.

Kevin should be able to:

1. Open/select a Formative question.
2. Click `Corriger avec ChatGPT` or `Copier les réponses pour ChatGPT`.
3. Paste into ChatGPT and discuss the correction normally. He may provide a rubric, examples, adjust grades, say the correction is too generous, ask for a complete regrade, or request comments only when useful.
4. Receive a human-readable table such as `Élève | Note | Commentaire` without having to request a special export format.
5. Use the same extension on the ChatGPT page to offer `Envoyer les résultats dans Formative`, or use a simple paste/import fallback.
6. Preview old -> new grades locally before any Formative write.
7. Publish notes and comments independently.

Do not require Kevin to manage visible answer codes, batch IDs, JSON, or an extra correction connector.

Robustness must still exist underneath the simple UI:

- no silent match when two students are ambiguous;
- reject a grade outside `0..possiblePoints`;
- leave missing students untouched;
- show unmatched/ambiguous rows before publication;
- verify the selected Formative and question before writing;
- preferably map to exact Formative answer IDs internally after local student matching;
- never publish on first click without a preview/confirmation.

## Global result flow

After the selected human-corrected questions are written back to Formative, Formative should contain the complete evaluation, including its own auto-corrected questions.

The intended next action is:

`Envoyer le résultat global dans Gestion des notes`

That operation should create or update one Gestion assignment for the whole evaluation, with the evaluation's actual overall maximum and each student's final Formative total. It should not create one Gestion assignment per question.

Then Gestion des notes sends that global assignment to Mozaïk.
