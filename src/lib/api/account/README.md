# Account Adapter Compatibility

`NEXT_PUBLIC_DATA_SOURCE` selects the account repository. `mock` is the safe default; `api` is an explicit opt-in that uses the NestJS account endpoints.

The API repository maps account, address, order, wishlist, and authentication DTOs into the existing storefront contracts. Access tokens remain memory-only, refresh sessions use `credentials: "include"`, public authentication requests suppress stale bearer headers, and malformed responses become controlled adapter errors.

The mock repository remains available for rollback and local preview behavior. Server responses are authoritative in API mode; legacy profile, address, and wishlist snapshots are reconciled once only when the corresponding server collection is empty.

Run the compatibility harness from the repository root:

```bash
npx tsx src/lib/api/account/account-adapter.harness.ts
```

The harness covers source selection, DTO mapping, server-owned request fields, token cleanup, mock rollback, loading/empty/error states, server authority, and one-time legacy reconciliation. It does not call a live backend or persist credentials.
