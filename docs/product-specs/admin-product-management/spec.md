# Admin Product Management Shipping Delta

## ADDED Requirements

### Requirement: Product shipping data fields

Admin product creation and editing MUST include an optional `Datos para envío` section with weight in grams and height, width, and length in centimeters.

#### Scenario: Create product with logistics data

- GIVEN the admin opens `/admin/productos/nuevo`
- WHEN valid positive logistics values are entered and the product is saved
- THEN weight and dimensions are retained in the in-memory product model.

#### Scenario: Edit product logistics data

- GIVEN the admin opens `/admin/productos/[nombreDelProducto]`
- WHEN logistics fields are changed and the product is saved
- THEN the updated values are retained in memory.

#### Scenario: Omit logistics data

- GIVEN the admin leaves logistics fields empty
- WHEN the product is saved
- THEN the product remains valid
- AND no shipping cost is calculated in checkout.

### Requirement: Product logistics validation and fallback rules

Product logistics fields MUST validate completed values as positive numbers and MUST document fallback semantics for future shipping calculations without applying them to checkout in this MVP.

#### Scenario: Reject invalid logistics values

- GIVEN any completed logistics field is zero, negative, or non-numeric
- WHEN the admin submits the product form
- THEN submission is blocked with field-level validation feedback.

#### Scenario: Future fallback semantics are preserved

- GIVEN product logistics data is incomplete
- WHEN the product is interpreted for future shipping work
- THEN complete user-entered dimensions take precedence
- AND missing values MAY fall back to standard or weight-estimated values outside this MVP.

### Requirement: Product logistics state boundary

Product logistics data MUST remain mock/in-memory for this MVP and MUST NOT introduce `localStorage`, Zustand `persist`, backend persistence, API behavior, or public checkout behavior.

#### Scenario: No persistence side effect

- GIVEN product logistics values were changed in the admin session
- WHEN the browser refreshes
- THEN changes MAY be lost with the current mock state model
- AND no backend or checkout behavior is implied.
