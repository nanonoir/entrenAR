# Delta for Catalog Taxonomy Sync

## ADDED Requirements

### Requirement: Active Taxonomy Consolidation
Active normalization MUST use 60 categories, map `shakers-y-botellas` memberships to `shakers`, prevent resurrection and permanently redirect the old URL. Frozen artifacts/cutover receipts MUST remain immutable; historical synchronization contracts remain unchanged.

#### Scenario: Future normalization
- GIVEN obsolete source memberships
- WHEN active normalization runs
- THEN only canonical shakers appear in taxonomy/navigation/filters and the old URL permanently redirects

### Requirement: Bounded Recoverable Local Merge
Consolidation MUST require identified existing local database, current-row/reference audit and private recovery evidence without overwriting backups/exposing secrets. Material drift MUST stop mutation. One transaction MUST union/deduplicate memberships, preserving unrelated memberships (including combo supplements/protein), IDs, 649 products/1,119 variants/3,790 images, prices/stock, admin/configuration and R2. Scratch databases/reimports/schema-wide changes MUST NOT occur.

#### Scenario: Authorized baseline
- GIVEN audited 19 root/23 obsolete memberships and recovery evidence
- WHEN consolidation commits
- THEN four links are added, 23 removed; 23 unique shakers, 60 categories and 2,105 links remain

#### Scenario: Safety and recovery
- GIVEN missing prerequisites, failure or completed consolidation
- WHEN execution is attempted
- THEN unsafe mutation stops, failure rolls back, and reruns do not duplicate links
- AND post-commit recovery restores original memberships/removes only added links, preserving subsequent unrelated data
