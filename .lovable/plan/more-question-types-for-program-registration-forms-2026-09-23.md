# More question types for program registration forms

## What changes
When adding a question, admins can pick from a full set of types:

- Short Text, Long Text (paragraph)
- Number, Email, Phone
- Date (calendar picker)
- Dropdown, Single Choice, Multiple Choice (checkbox)
- Multiple Answers (Add More)
- **Yes / No** — with optional follow-up: admin can type options that appear only when the applicant picks "Yes" (shown as checkboxes or single choice, admin chooses), and mark the follow-up as required.

Question list shows a readable type label (and a "Yes → follow-up" hint).

## Public form
- Date shows a date picker.
- Yes/No shows two large buttons; choosing Yes reveals the follow-up options, choosing No hides and clears them.
- Required checks respect the follow-up (only required when Yes is picked).

## Registrations view / export
- Yes/No answers display as "Yes — option A, option B" or "No".
- Dates shown in readable format; Excel export includes them the same way.

## Technical details
- Migration: replace `program_form_questions_question_type_check` to allow `text, textarea, number, email, phone, date, select, radio, checkbox, multi_text, yes_no, multiple_choice`.
- `yes_no` stores `options` as `{ followup_type: "checkbox"|"radio", followup_options: string[], followup_required: bool }`; answer saved as `{ value: "yes"|"no", followup: string[] }`.
- Update `FormBuilder.tsx` (types list + follow-up editor), `ProgramPublic.tsx` (yes_no render + validation), `RegistrationsTable.tsx`/export formatting. Edge function `admin-form-questions` already passes options through unchanged.
