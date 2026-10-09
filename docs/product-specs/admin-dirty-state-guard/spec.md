# Admin Dirty State Guard Specification

## Purpose

Defines how EntrenAR admin forms warn about unsaved changes during controlled exits and browser-level refresh or close actions.

## Requirements

### Requirement: Dirty Controlled Exit Warning

Admin forms with unsaved changes MUST warn before controlled exits such as form Cancel actions, header back links, and equivalent in-app return controls.

#### Scenario: Dirty cancel asks for confirmation

- GIVEN an admin form has unsaved changes
- WHEN the admin activates Cancel or a controlled return action
- THEN a discard-confirmation warning is shown
- AND navigation does not proceed until discard is confirmed

#### Scenario: Confirmed discard exits form

- GIVEN a discard-confirmation warning is shown
- WHEN the admin confirms discarding changes
- THEN the controlled exit proceeds

#### Scenario: Dismissed discard keeps editing

- GIVEN a discard-confirmation warning is shown
- WHEN the admin dismisses the warning
- THEN the admin remains on the form with current field values preserved

### Requirement: Dirty Browser Exit Warning

Admin forms with unsaved changes MUST rely on the browser-native warning for refresh, close, or other uncontrolled document exits.

#### Scenario: Dirty refresh or close warns

- GIVEN an admin form has unsaved changes
- WHEN the admin refreshes or closes the tab
- THEN the browser-native unsaved-changes warning is requested

### Requirement: Clean Exit Without Warning

Admin forms without unsaved changes MUST allow controlled exits and browser-level exits without custom discard prompts.

#### Scenario: Clean controlled exit proceeds

- GIVEN an admin form has no unsaved changes
- WHEN the admin activates Cancel or a controlled return action
- THEN navigation proceeds without a discard warning

#### Scenario: Clean refresh or close is not blocked

- GIVEN an admin form has no unsaved changes
- WHEN the admin refreshes or closes the tab
- THEN no unsaved-changes handler requests a warning

### Requirement: Admin-Only Dirty Guard Scope

Dirty-state standardization MUST apply only to admin forms in this change and MUST NOT change public shop or auth forms.

#### Scenario: Public forms keep existing exit behavior

- GIVEN a public shop or auth form is edited
- WHEN admin dirty-state guard behavior is introduced
- THEN the public form keeps its existing exit behavior
