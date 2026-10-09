# PRD2 Corrective Apply Evidence

## Focused evidence

- Backend corrective unit coverage: 6 suites / 20 tests passed.
- Frontend route harness: `performance`, `control-de-peso`, and multi-category membership passed.
- Isolated catalog E2E: 2 tests passed with `DATABASE_URL_E2E`; the application database was not used.
- Handoff generation: 61 categories and one canonical fixture product generated deterministically under `scrape-output/`.
- Manual-import boundary: preparation command tests do not invoke `catalog:import`.
- TypeScript: backend and frontend `tsc --noEmit` passed.

## Database benchmark status

The five-run production-shape benchmark and forced late rollback were executed against a fresh disposable PostgreSQL 16 container. Maximum duration was 1,730.21 ms, mean duration was 1,583.41 ms, each run observed 20 SQL queries, and rollback left zero product, variant, image, or relation rows.

## Cleanup

- The configured application database was not opened or mutated.
- The disposable benchmark database and container were removed after execution.
- No live R2 objects were created by the corrective batch.
- Fixture outputs contain no credentials or endpoint values.

## Handoff

The generated `scrape-output/report.md` is **READY** for fixture-mode review only. It is not evidence of live source/R2 readiness; sdd-verify must run the isolated PostgreSQL, live storage, benchmark, and rollback checks before verification can pass.
