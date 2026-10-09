# Admin Abandoned Carts Settings Specification

## Purpose

Defines persistent global recovery configuration and editable recovery-email content.

## Requirements

### Requirement: Singleton Recovery Configuration

The system MUST persist exactly one `CartRecoverySettings` record containing `isActive` and timing of `6hs`, `24hs`, `3_days`, `7_days`, `14_days`, or `manual`. ADMIN-only `GET` and `PUT /api/v1/admin/abandoned-carts/config` MUST retrieve and update that record.

#### Scenario: Update global timing
- Given an ADMIN submits an allowed timing and boolean activation state
- When the config endpoint processes the update
- Then subsequent reads return the persisted singleton values

#### Scenario: Reject unsupported timing
- Given an ADMIN submits an unsupported timing value
- When the update endpoint receives it
- Then it rejects the update without changing the singleton

### Requirement: Recovery Email Template

The singleton MUST retain `subject`, `htmlBody`, and `plainTextBody`. Templates MUST support `{{nombre}}`, `{{total}}`, and `{{checkoutUrl}}`. ADMIN-only `GET` and `PUT /api/v1/admin/abandoned-carts/template` MUST retrieve and update those fields.

#### Scenario: Save variable-bearing template
- Given an ADMIN supplies all template fields with supported variables
- When the template is updated
- Then later retrieval returns the saved template unchanged

#### Scenario: Incomplete template update
- Given an ADMIN omits a required template field
- When the update endpoint receives it
- Then validation rejects the request without persistence
