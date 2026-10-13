# CRM showcase: isolated backend operation

**Local generation and real persistence/HTTP verification are complete.** Start with the [Spanish operator guide](./guia-operador-local.md) and [execution evidence](./local-owner-evidence.md). The exact local-owner exception supersedes the earlier classification of preserved administrators/tokens as contamination. Do not delete them. The default isolated preparation below still applies unless using explicit trusted-owner authorization.

## Exact local-owner manifest

The CLI still requires explicit `CRM_SHOWCASE_DATABASE_URL`; never inherit a habitual URL. For the exact `127.0.0.1:5432/entrenar/public` target, use `purpose=crm-showcase-trusted-owner-local`, `trustedOwner=true`, and destination/source fingerprint `83356d0e3af5e1161197c6962b763172d389fde5682cd686b5cef0facd5d5d3a`. A different host, port, database or schema fails closed. Supply the existing scheduler/connected-server evidence and current `baselineDigest` captured **after** authorized manual configuration.

`restoreEvidence` is explicit operator attestation: `destination` is a canonical credential-free `entrenar_crm_demo_*` identity on `127.0.0.1`, a different port, `public`; `dumpSha256` equals `baselineDumpSha256`; `sourceBaselineDigest` and `restoredBaselineDigest` are equal canonical baseline SHA-256 values; `verified=true`; `description` records the actual restoration/comparison performed. Do not confuse a table-comparison receipt hash with `digest(await readBaseline(tx))`. The CLI validates evidence shape and identities; it does not discover schedulers or repeat the backup restoration itself. Keep manifest and backup private.

For restored test copies, retain `purpose=crm-showcase-demo`, `separateInstance=true`, the original isolated identity checks, and explicitly add `trustedOwner=true` plus the same restoration evidence to preserve legitimate administrator tokens. `sourcePersonalDataAbsent` may be false only with this trusted-owner evidence. Do not authorize the local source as disposable or run destructive suites on it. Real checkout must run on another disposable restored copy, not the generation baseline: its commercial rows would violate the clean-commerce prerequisite.

## Required preparation

1. Obtain an independently verified, PII-free imported baseline with active checkout payment options, shipping and pickup. Configuration repair, anonymization and source cleanup are outside this workstream. Do not seed/reset the source or remove its users/sessions.
2. Use source **read-only credentials** and a private PostgreSQL service/password file to take a consistent custom-format `pg_dump --format=custom`. Do not put passwords in command arguments or logs. Hash the private dump with SHA-256.
3. Restore the dump using `pg_restore --exit-on-error --no-owner --no-privileges` into fresh databases named `entrenar_crm_demo_<run>` in a **separate loopback-only PostgreSQL instance on a different port**, using destination-only credentials. Preserve existing schema, constraints, triggers and migration records. Do not run migrations or legacy fixtures to build the copy.
4. Keep generation copies free of applications/jobs. Inspect relevant Windows scheduled tasks, container cron/processes and systemd timer/service schedules where applicable. Record evidence that `entrenar-showcase-reset.timer`/service and equivalent jobs cannot reach these destinations. A manifest is an attestation, not scheduler discovery.
5. Verify connected identity and canonical whole-baseline digests on source and restored copies. The implementation exports `readBaseline(transaction)` and `digest(baseline)`; baseline tables are the static `BASELINE_TABLES` whitelist in `crm-showcase.service.ts`. Read-only verification tooling must receive an explicit read-only DSN, not habitual URL fallback. The digest includes rows, timestamps, settings, catalog and commercial state; it excludes database identity and credentials. Do not print the underlying row export.
6. Create a **private external** authorization manifest for each destination. Do not commit manifests, connection strings, dumps, token/contact exports or passwords.

### Manifest fields

| Field | Required evidence |
| --- | --- |
| `purpose` | Exactly `crm-showcase-demo` |
| `destinationFingerprint` | Credential-free `identifyDatabaseTarget(explicitDestinationUrl).fingerprint` |
| `source` | The complete credential-free identity returned by `identifyDatabaseTarget(explicitReadOnlySourceUrl)`; source/destination database names and ports must differ |
| `baselineDumpSha256` | SHA-256 of the verified private dump |
| `baselineDigest` | Canonical `digest(await readBaseline(readOnlyTransaction))`, matching each restored copy |
| `schedulerDisabled`, `schedulerEvidence` | `true` only after inspection, plus a concise non-secret evidence description |
| `sourcePersonalDataAbsent` | `true` only after PII/session checks, not merely because orders are empty |
| `separateInstance` | `true` only after verifying a separate instance and destination-only credentials |
| `serverAddress` | The restored destination's `inet_server_addr()::text`, independently verified over its TCP connection |

Only literal `127.0.0.1`/`::1`, `public`, the demo database namespace and an optional single `schema=public` query parameter are accepted. Host/port/database overrides, socket/hostaddr/options/search-path parameters, unknown URL parameters and production runtime are rejected before client construction. There is no fallback to `DATABASE_URL`/`DATABASE_URL_E2E`.

## Generate once

Supply `CRM_SHOWCASE_DATABASE_URL` privately to the process, then run from the repository root:

```bash
npm run build:backend
npm run seed:crm-showcase -- --seed review-demo --reference-date 2026-10-09T15:00:00Z --authorization "<private absolute manifest path>"
```

The command does not load dotenv, bootstrap `AppModule`, send messages, take payments or access storage. Its finite transaction limit is 120 seconds; the process deadline is 135 seconds. Output contains only status, destination fingerprint and, on generation, counts/manifest digest. Errors intentionally omit raw Prisma/pg/filesystem exceptions.

| Result | Operator action |
| --- | --- |
| `generated` | Preserve the private pre-generation dump and command summary; validate CRM consumers on a separate dedicated demo process |
| `already-generated` | No row writes occurred, including after legitimate admin operations or seed/date changes |
| Rejection/deadline | Inspect authorization/prerequisites and marker privately; never clean namespace rows, reset stock or delete history to retry |

The fixed `OrderHistory.id=crm-showcase:completion` is inserted last. Missing marker plus reserved namespace rows, malformed marker or inadequate prerequisites are failures, not repair instructions. Reconstruction means restoring the private baseline into another fresh authorized demo, never selective deletion or overwriting the source.

## Dedicated persistence fixture

**Do not use the general integration command.** The new fixture has its own Jest config without `setup-e2e-environment.ts`; it is explicitly excluded from the legacy integration config.

Provide two fresh disposable copies from the same private dump:

| Variable | Value |
| --- | --- |
| `CRM_SHOWCASE_DATABASE_URL`, `CRM_SHOWCASE_AUTHORIZATION` | Private DSN and manifest path for copy A |
| `CRM_SHOWCASE_DATABASE_URL_B`, `CRM_SHOWCASE_AUTHORIZATION_B` | Private DSN and manifest path for copy B |
| `CRM_SHOWCASE_DISPOSABLE`, `CRM_SHOWCASE_DISPOSABLE_B` | Exact corresponding destination fingerprints, explicitly authorizing test mutations |
| `CRM_SHOWCASE_SEED`, `CRM_SHOWCASE_REFERENCE_DATE` | Explicit seed and UTC ISO instant |

```bash
npm run build:backend
npm run test:crm-showcase
```

The fixture performs rollback/fault checks, transaction-local partial/collision guards, bounded lock contention, hidden finite CLI processes on separate connections, immutable-trigger checks, A/B deterministic manifest comparison, existing statistics/abandonment/sales read consumers and live confirmation/cancellation/receipt followed by no-op. It does **not** delete generated graphs afterward: copy A intentionally retains admin test operations; copy B retains the original scenario. Use a different authorized copy for a presentable demo. No source credentials or external integration configuration are forwarded to child CLIs.

Real checkout/persistence, timing, source generation/no-op and authenticated HTTP acceptance are recorded in `local-owner-evidence.md`. New visual CRM browser acceptance and independent re-review of the continuation were not executed; prior synthetic storefront browser evidence is separate. Unit tests are not substitutes for runtime results.
