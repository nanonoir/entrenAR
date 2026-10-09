# PRD2 Cloudflare R2 / Object Storage Smoke Investigation Report

- **Investigation Date**: `2026-09-27T02:45:00.000Z`
- **Target Pipeline**: PRD2 Entreno Catalog Scraper & Import Pipeline
- **Investigation Status**: **VERIFIED (S3 API OPERATIONS AND PUBLIC HEAD FULLY PROVEN)**
- **Real Object Lifecycle**: `diagnostics/prd2/smoke-{timestamp}-{uuid}.webp` (Created, Verified, Deleted, Confirmed Cleaned)
- **Ready for PRD Refinement**: **YES (Storage API, Public Custom Domain, and Cleanup Operationally Validated)**

---

## 1. Executive Summary

Following the initial configuration audit, all required Cloudflare R2 environment variables were supplied to `backend/.env`. `@aws-sdk/client-s3` (`^3.1141.0`) was installed in the backend package.

An end-to-end live S3 API smoke test was executed against Cloudflare R2 using a temporary valid WebP payload under a cryptographically unique key (`diagnostics/prd2/smoke-{timestamp}-{uuid}.webp`). The test successfully validated:
1. **S3 SigV4 Authentication & Bucket Access**
2. **`PutObject`** with valid image metadata (`image/webp`)
3. **`HeadObject`** metadata verification (ContentLength, ContentType, ETag)
4. **`GetObject`** byte and SHA-256 integrity match
5. **`DeleteObject`** removal
6. **Provider-side cleanup confirmation** via subsequent `HeadObject` returning HTTP 404 (`NotFound`)

The public CDN/custom domain preflight against `ASSETS_BASE_URL` (`assets.entrenar.shop`) was subsequently verified with a temporary WebP object and cleanup confirmation.

All safety and security protocols were observed:
- Zero credentials, account IDs, bucket names, endpoints, or signed URLs are exposed.
- No existing or unrelated bucket objects were inspected or modified.
- All temporary test scripts were executed outside the repository in temporary storage and deleted immediately upon completion.
- No Git operations were performed.

---

## 2. Configuration & Tooling Audit

### 2.1 Environment Variables Discovery

The environment was audited in `backend/.env` using non-logging boolean presence verification.

| Variable Name | Required For | Configured & Non-Empty? | Sanitized Value Format | Status |
|---|---|:---:|---|:---:|
| `R2_ACCOUNT_ID` | Cloudflare account identifier & endpoint resolution | ✅ Yes | 32-char hex string | **CONFIGURED** |
| `R2_ACCESS_KEY_ID` | S3 API SigV4 authentication | ✅ Yes | 32-char hex string | **CONFIGURED** |
| `R2_SECRET_ACCESS_KEY` | S3 API SigV4 signature signing | ✅ Yes | 64-char hex string | **CONFIGURED** |
| `R2_BUCKET_NAME` | Target object storage bucket | ✅ Yes | Valid bucket identifier | **CONFIGURED** |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible API endpoint | ✅ Yes | HTTPS S3 endpoint URL | **CONFIGURED** |
| `ASSETS_BASE_URL` | Public CDN/R2 HEAD preflight & frontend image URL resolution | ✅ Yes | HTTPS custom domain URL (`assets.entrenar.shop`) | **CONFIGURED (PENDING DNS)** |

*Note: Per security policy, all secret values, access keys, account IDs, bucket names, and URLs remain fully redacted.*

#### Configuration Finding: `R2_ENDPOINT` Input Normalization
During initial endpoint parsing, it was detected that the value assigned to `R2_ENDPOINT` in `backend/.env` contained a duplicated variable-name prefix. The one-off smoke runner removed that prefix only to complete this approved diagnostic.

**Required correction**: update the local environment value so it contains only the HTTPS endpoint URL. The production R2 client factory MUST validate `R2_ENDPOINT` as a URL and fail fast on malformed configuration; it must not silently repair duplicated assignments.

### 2.2 Client Libraries & Tooling Discovery

| Tool / Package | Location Checked | Installed Version | Status |
|---|---|:---:|:---:|
| `@aws-sdk/client-s3` | `backend/package.json` & `backend/package-lock.json` | `^3.1141.0` | **INSTALLED** |
| `wrangler` | System PATH | Not installed | *Not Required (S3 SDK in use)* |
| `aws` CLI | System PATH | Not installed | *Not Required (S3 SDK in use)* |

---

## 3. Storage Smoke Test Execution Outcomes

The smoke test executed an end-to-end lifecycle verification against Cloudflare R2 using `@aws-sdk/client-s3`.

| Phase / Operation | Result | HTTP Status | Details |
|---|:---:|:---:|---|
| **Temporary WebP Generation** | `SUCCESS` | — | Minimal valid 1x1 WebP binary (44 bytes, RIFF/WEBP/VP8 chunk). |
| **Object Key Allocation** | `SUCCESS` | — | Isolated diagnostic key format: `diagnostics/prd2/smoke-${Date.now()}-${crypto.randomUUID()}.webp`. |
| **Authentication & Bucket Access** | `SUCCESS` | `200 OK` | S3 SigV4 handshake and bucket authorization accepted by Cloudflare R2. |
| **Upload (`PutObject`)** | `SUCCESS` | `200 OK` | Uploaded 44-byte WebP with `ContentType: "image/webp"`. ETag returned. |
| **Metadata Verification (`HeadObject`)** | `SUCCESS` | `200 OK` | Verified `ContentLength === 44`, `ContentType === "image/webp"`, and matching ETag. |
| **Integrity Verification (`GetObject`)** | `SUCCESS` | `200 OK` | Stream downloaded into memory; SHA-256 hash matched uploaded buffer with 100% bitwise parity. |
| **Cleanup Deletion (`DeleteObject`)** | `SUCCESS` | `204 No Content` | Executed in a mandatory `finally` block to prevent lingering test artifacts. |
| **Provider-Side Cleanup Confirmation** | `CONFIRMED_DELETED` | `404 Not Found` | Immediate `HeadObject` for deleted key confirmed `NotFound` (distinguished from auth/network errors). Zero lingering artifacts. |
| **Public Preflight (`HEAD` via `ASSETS_BASE_URL`)** | `SUCCESS` | `200 OK` | Temporary WebP served with matching `image/webp` content type and 44-byte content length; object was deleted and cleanup confirmed. |

---

## 4. Codebase & Architectural Analysis

### 4.1 Implemented PRD1 R2 Adapter Behavior
Inspection of `backend/src/modules/catalog-import/adapters/r2-object-existence.adapter.ts` confirms:
```typescript
export class R2ObjectExistenceAdapter implements ObjectExistencePort {
  private readonly baseUrl = process.env["ASSETS_BASE_URL"]?.replace(/\/$/, "");
  private readonly fetchObject: FetchLike = fetch as unknown as FetchLike;
  ...
  async exists(storageKey: string): Promise<boolean> {
    if (!this.baseUrl) throw new Error("ASSETS_BASE_URL is required for R2 object preflight.");
    const response = await this.fetchObject(`${this.baseUrl}/${storageKey}`, { method: "HEAD" });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`R2 object preflight failed with status ${response.status}.`);
    return true;
  }
}
```

Key observations:
1. **Public Preflight (`exists` / `existsMany`)**: Consumes `ASSETS_BASE_URL` for lightweight HTTP HEAD existence checks before importing products into the database.
2. **Uploader Architecture (PRD2)**: Requires an authenticated S3 client adapter using `@aws-sdk/client-s3`. The successful smoke test proves that `@aws-sdk/client-s3` operates seamlessly with Cloudflare R2 using `region: "auto"`.

---

## 5. PRD2 Refinement Readiness & Actionable Next Steps

### 5.1 Storage Readiness Verdict: **READY FOR PRD REFINEMENT**
- **S3 API Capabilities**: Fully verified for write, read, metadata, delete, and cleanup operations.
- **Dependency Status**: `@aws-sdk/client-s3` (`^3.1141.0`) is installed in `backend/package.json`.
- **Environment**: All 6 required variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `ASSETS_BASE_URL`) are present.

### 5.2 Final Operational Status
- **Public Domain**: DNS, TLS, and HTTP HEAD are verified against a real temporary R2 object. The object returned `200 OK`, `image/webp`, and the expected content length, then was deleted with post-delete confirmation.
- **Remaining storage blockers**: None.
