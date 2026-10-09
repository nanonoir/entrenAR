# Admin Route Cloaking Specification

## Purpose

Provide privacy-oriented operational-route cloaking while preserving public admin login and backend authority.

## Requirements

### Requirement: Operational Route Gate

`/admin/:path*` operational routes except `/admin/login` MUST locally validate the signed gate without database access. Missing, malformed, forged, or unsupported gates MUST return the public branded 404; active gates MAY reach only a safe bootstrap boundary; trusted logically expired gates MUST redirect to `/admin/login?expired=true`.

#### Scenario: Anonymous document request
- GIVEN no trusted gate
- WHEN `/admin/ventas` is requested as a document
- THEN status MUST be 404 with the original URL and no admin shell or login hint

#### Scenario: Client navigation
- GIVEN no trusted gate
- WHEN an RSC navigation targets an invented operational route
- THEN it MUST resolve as branded not-found without router failure or disclosure

### Requirement: Public Admin Login Isolation

`/admin/login` MUST remain public, isolated from operational admin layout, stores, navigation, toasts, and protected loaders, and MUST use `noindex, nofollow`. Active gates MUST redirect to `/admin`; expired gates MUST render the expiration notice.

#### Scenario: Successful login
- GIVEN valid ADMIN credentials
- WHEN the branded login submits once
- THEN it MUST establish admin state, notify tabs, and navigate to `/admin`

#### Scenario: Generic rejection
- GIVEN invalid or CUSTOMER credentials
- WHEN login is submitted
- THEN the UI MUST show the same generic failure without role disclosure

### Requirement: Route Verification Coverage

Focused Playwright coverage MUST assert document and RSC cloaking, original-URL 404 behavior, gate forgery and expiry, bootstrap non-disclosure, login restoration, and responsive logout controls.

#### Scenario: Cloaking evidence
- GIVEN the route suite runs against an anonymous browser
- WHEN document and client navigation target operational admin routes
- THEN it MUST prove no shell, data, router crash, or login hint is exposed
