# Admin Customers Export Specification

## Purpose

Defines customer CSV export endpoints for list and active detail, safe encoding and formula injection mitigation, and privacy preservation for anonymized profiles.

## Requirements

### Requirement: Customer CSV Export Endpoints

`GET /api/v1/admin/customers/export` MUST export the requested customer list, honoring supported listing filters and sort. `GET /api/v1/admin/customers/:id/export` MUST export one active customer detail. Both endpoints SHALL return a downloadable CSV response.

#### Scenario: Export filtered list
- GIVEN customers match a supported list query
- WHEN an ADMIN requests the list export
- THEN the CSV contains only the matching records in the requested order

#### Scenario: Export active detail
- GIVEN an active customer exists
- WHEN an ADMIN requests its detail export
- THEN a CSV containing that customer's permitted detail is returned

### Requirement: Safe Compatible CSV Encoding

CSV output MUST begin with a UTF-8 BOM and use semicolon (`;`) separators. Values MUST be safely escaped for delimiters, quotes, and line breaks. Values beginning with `=`, `+`, `-`, or `@` MUST be prefixed with a single quote to mitigate formula injection.

#### Scenario: Escaped hostile value
- GIVEN a customer field contains quotes, semicolons, line breaks, and a leading formula character
- WHEN an ADMIN exports CSV
- THEN the field is safely quoted and its formula character is prefixed with `'`

#### Scenario: Encoding header
- GIVEN an ADMIN requests either export endpoint
- WHEN the response is generated
- THEN its body begins with the UTF-8 BOM and uses semicolons as columns

### Requirement: Anonymized Export Privacy

Detail export for an anonymized customer MUST be rejected without producing a file. List export MUST retain anonymized records only with the masked identity `Cliente eliminado ({id})` and no original PII.

#### Scenario: Anonymized detail request
- GIVEN a customer is anonymized
- WHEN an ADMIN requests its detail export
- THEN the request is rejected and no CSV is returned

#### Scenario: Anonymized list row
- GIVEN an anonymized customer matches a list export
- WHEN an ADMIN exports the list
- THEN its row contains the masked identity and excludes original PII
