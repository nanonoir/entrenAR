# Admin Form Actions Specification

## Purpose

Defines consistent placement, behavior, and responsive layout for submit, cancel, and destructive actions in EntrenAR admin forms.

## Requirements

### Requirement: Admin Form Action Placement

Admin form submit actions MUST live at the end of the form's natural content flow. Page headers MUST NOT duplicate Save, Create, Submit, Cancel, or Delete actions that belong to the form body.

#### Scenario: Header does not duplicate form submit

- GIVEN an admin create or edit form is rendered
- WHEN the page header is displayed
- THEN no form submit action is available in the header
- AND the submit action is available only in the form action area

#### Scenario: Actions appear after form content

- GIVEN an admin form has editable fields
- WHEN the admin reaches the end of the form
- THEN Save, Cancel, and form-scoped Delete actions are available after the final editable section

### Requirement: Submission State Feedback

Admin form primary actions MUST show submission feedback and prevent duplicate submissions while a submit operation is pending.

#### Scenario: Submit enters loading state

- GIVEN an admin form submit is valid
- WHEN the admin submits the form
- THEN the primary submit button shows a loading state
- AND duplicate submit attempts are blocked until submission completes

#### Scenario: Validation failure does not enter pending submit

- GIVEN required admin form fields are invalid
- WHEN the admin submits the form
- THEN validation feedback is shown
- AND the form is not submitted

### Requirement: Responsive Action Layout

Admin form actions MUST fit mobile, tablet, and desktop viewports without sticky bottom bars, page-level horizontal overflow, or controls hidden outside the viewport.

#### Scenario: Mobile actions remain in scroll flow

- GIVEN an admin form is viewed on a mobile viewport
- WHEN the admin scrolls to the form actions
- THEN actions are full-width or otherwise viewport-safe
- AND no sticky bottom action bar overlaps content or browser navigation

#### Scenario: Desktop actions remain visually consistent

- GIVEN an admin form is viewed on a desktop viewport
- WHEN the admin reaches the action area
- THEN actions are grouped consistently and remain reachable by keyboard and pointer

### Requirement: Responsive Action Layout (Duplicated requirement name in source spec, but keeping same requirements for correctness)

### Requirement: Public Form Scope Exclusion

This standardization MUST NOT alter public shop or auth form behavior.

#### Scenario: Public shop and auth forms remain unaffected

- GIVEN a form under public shop or auth routes exists
- WHEN admin form actions are standardized
- THEN its action placement, validation, and submit behavior remain unchanged
