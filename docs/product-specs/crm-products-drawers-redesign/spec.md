# CRM Products Drawers Redesign Specification

## Requirements

### Requirement: Categories Drawer Structure

The Categories drawer MUST be compact and top-aligned with header, search, create action, and list.

#### Scenario: Opens with controls

- GIVEN product form is open
- WHEN the user opens Categories
- THEN content MUST start near the top
- AND required controls MUST be visible.

#### Scenario: Create entry point

- GIVEN Categories is open
- WHEN the user activates create category
- THEN an add-category entry point or placeholder MUST appear
- AND it MUST NOT auto-select a category.

### Requirement: Categories Search and Filter

The drawer MUST filter unlimited categories/subcategories by label or hierarchy text and preserve selection.

#### Scenario: Search matches

- GIVEN categories exist
- WHEN the user enters matching search text
- THEN matching rows MUST remain visible
- AND non-matches MUST be hidden.

#### Scenario: No matches

- GIVEN selected categories exist
- WHEN the search has no matches
- THEN an empty-results state MUST be shown
- AND selected categories MUST remain selected.

### Requirement: Categories Multi-select Hierarchy

Rows MUST use independent checkboxes. Child rows MUST render inline parent/child text without a tree.

#### Scenario: Multi-select

- GIVEN Categories is open
- WHEN the user checks multiple rows
- THEN all checked rows MUST remain selected
- AND one checkbox MUST NOT clear another.

#### Scenario: Unselect one

- GIVEN multiple categories are selected
- WHEN the user unchecks one row
- THEN only that row MUST be removed from selection.

#### Scenario: Hierarchy text

- GIVEN a category has ancestors
- WHEN the list renders
- THEN the row MUST show inline parent/child path text
- AND the relationship MUST be understandable without tree expansion.

### Requirement: Variants Two-select Flow

The Variants drawer MUST be compact and top-aligned. It MUST expose Variante and Subvariante selectors with Color, Sabor, Tamaño, Talle, and + Nueva variante.

#### Scenario: Select Variante

- GIVEN no primary property is active
- WHEN the user selects an option in Variante
- THEN that property MUST become active
- AND values MUST render as checkboxes plus custom input.

#### Scenario: Select Subvariante

- GIVEN Variante has an active property
- WHEN the user selects an allowed option in Subvariante
- THEN Subvariante MUST become active independently
- AND it MUST render its own checkboxes plus custom input.

### Requirement: Variant Mutual Exclusion

Variante and Subvariante MUST NOT hold the same property simultaneously.

#### Scenario: Exclude property

- GIVEN Variante is Color
- WHEN the user opens Subvariante
- THEN Color MUST NOT be selectable there.

#### Scenario: Prevent duplicate

- GIVEN both selectors have different properties
- WHEN a change would duplicate a property
- THEN the duplicate MUST be prevented or the conflicting selector MUST be cleared.

### Requirement: Variant Values and Custom Properties

Preset properties MUST show default checkbox values and allow custom values. + Nueva variante MUST require a custom property name and custom values.

#### Scenario: Preset values

- GIVEN the user selects Color, Sabor, Tamaño, or Talle
- WHEN values render
- THEN preset defaults MUST appear as checkboxes
- AND multiple values MAY be checked.

#### Scenario: Add custom value

- GIVEN a preset property is active
- WHEN the user adds a custom value
- THEN it MUST be available with existing checked defaults.

#### Scenario: Custom property

- GIVEN the user selects + Nueva variante
- WHEN the custom area renders
- THEN the user MUST provide a property name
- AND custom values MUST be addable for that property.

### Requirement: Remove Drawer Clutter

The Variants drawer MUST NOT display chips, cards, subtitles, or visible automatic-combinations footer text.

#### Scenario: Clean variant controls

- GIVEN Variants is open
- WHEN controls render
- THEN values MUST use checkboxes and inputs only
- AND chips, cards, subtitles, and combinations footer text MUST NOT be visible.
