# ExecPlan: Customer-facing copy cleanup (no developer attribution, no demo/mock language)

## Objective

The public storefront, account and checkout present EntrenAR as a sports ecommerce brand. No customer-visible surface carries developer attribution, portfolio/social links, "demo/MVP/mock/phase/backend" language, invented contact channels, or fictitious bank data presented as real.

## Context

- `src/lib/data/footer.ts` + `Footer.tsx` exposed developer signature, personal portfolio/LinkedIn/GitHub links, invented support hours and a "demo" legal line.
- `/contacto` was a developer portfolio page (spec `static-support-pages` required it); `/nosotros` mentioned "MVP" and technical base; `/politicas/privacidad` promised future payment platforms.
- Checkout components showed server/debug language (`Configuración confirmada · ARS`, "confirmadas por el servidor", "datos mock") and, when no quote was available, `bankTransferInstructions` fixture data (`EntrenAR Demo`, fake CBU) as if real.
- Findings (not changed here, logic out of scope):
  - Bank-transfer proof: the client requires a selected file (`hasTransferProof`) to finalize, but the file is never uploaded or persisted (`buildCompletionInput` does not send it).
  - `SupportActionForm` (`/cambios-y-devoluciones`, `/boton-de-arrepentimiento`) never sends data yet shows "Recibimos tu solicitud".
  - Quote-provided bank config comes from backend seeds (`EntrenAR Demo`); the frontend cannot tell it from real data.

## Scope & Non-Goals

In: footer data/component, `/contacto`, `/nosotros`, `/politicas/privacidad`, `AuthenticationSection` copy, checkout presentation copy (`CheckoutSummary`, `DeliveryOptions`, `ShippingOptions`, `PickupOptions`, `PaymentOptions`, `BankTransferPanel`, `CouponBox`, `DeliveryAddressForm`, `checkout-form.validators` message, `src/lib/data/checkout.ts` copy strings), `static-support-pages` spec and footer design doc reconciliation.

Out: any `/admin` surface, checkout logic/stores/API/config/auth, backend and seeds/DB, SEO/JSON-LD, deleting personal assets (`logoNR.svg`, `linkedin.svg`, `github.svg`, `whatsapp.svg` stay in `public/`), internal docs that explain the portfolio nature of the repo.

## Execution Plan

1. Footer: drop developer text, social links, hours text; keep existing help links; neutral copyright.
2. `/contacto`: customer-support page linking only operative existing routes (order management, shipping/returns policies, terms); no invented channels or forms.
3. `/nosotros` and `/politicas/privacidad`: brand/user-language rewrite limited to verified capabilities.
4. Account `AuthenticationSection`: remove "vista mock" wording.
5. Checkout copy: remove server/debug/mock wording; fallback bank panel shows no fictitious data; no transfer-proof promise.
6. Update spec `static-support-pages` and design `2026-06-05-footer-static-legal-support-pages` (addendum, history preserved).
7. Validate.

## Decisions & Rationale

- Contact lists no phone/email/social/hours because none are verified for the brand.
- Help links to `/cambios-y-devoluciones` and `/boton-de-arrepentimiento` stay in the footer (spec'd, existing routes) but are not promoted from `/contacto` because their forms do not submit anywhere. Reported as pending decision.
- Without a server quote, the bank panel shows a neutral "datos disponibles al confirmar el pedido" notice instead of the fixture; fixture constants stay in `checkout.ts` for the mock repository only.
- Copyright reads "© 2026 EntrenAR." without a rights/trademark claim.

- Review blockers resolved: `SupportActionForm` (local fake "Solicitud recibida") replaced by `SupportRequestUnavailable` ("La solicitud online no está disponible en este momento"), linking to `/gestion-de-pedidos` and `/mi-cuenta` only for consulting orders. No email-of-bank-details promise: no such capability is verified.
- Local transfer-proof upload and the `hasTransferProof` guards (wizard, completion, form state) were removed; checkout API/client/store untouched.
- `bank-transfer-config.ts` detects missing/placeholder bank config (zeroed CBU/CUIT, "Demo" labels). `getCheckoutConfigurationIssue` (used on the current and the refreshed quote) blocks transfer finalization with "La transferencia bancaria no está disponible en este momento."; no other provider is forced and the quote is not altered.
- Pending decisions: the spec'd returns-policy CTA "Iniciar cambio o devolución" and footer Help links still lead to routes without intake; backend seeds still ship "Demo" bank data.

## Progress Tracking

- [x] 1 footer
- [x] 2 contacto
- [x] 3 nosotros / privacidad
- [x] 4 account auth copy
- [x] 5 checkout copy
- [x] 6 spec + design
- [x] 7 validation: `tsc`, eslint on touched paths, `verify:frontend-acceptance` (incl. `bank-transfer-config.harness.ts`) passed; browser smoke check completed
- [x] 8 review blockers (helper jargon, fake support success, transfer proof, placeholder bank data)
- [x] 9 Review / archive (independent review `ses_ec1c9b682fferTaYEgFrabajUC` PASS; archived to `completed/`)

## Validation

- `npx tsc --noEmit`: 0 errors across frontend and backend.
- `npx eslint` across 27 touched files: clean (0 errors, 0 warnings).
- `npm run verify:frontend-acceptance`: 18/18 test harnesses passed (including `bank-transfer-config.harness.ts`).
- Browser smoke check: verified `/contacto`, `/gestion-de-pedidos`, `/boton-de-arrepentimiento`, `/cambios-y-devoluciones`, and checkout without orders.
- Independent Review: PASS (`ses_ec1c9b682fferTaYEgFrabajUC`).

## Implementation Outcome

### Implemented

- **Brand Identity & Footer (`src/lib/data/footer.ts`, `Footer.tsx`)**: Removed developer attribution, portfolio and personal social links (GitHub, LinkedIn, WhatsApp), and invented support schedules. Replaced with neutral copyright "© 2026 EntrenAR." while preserving operative Help navigation links.
- **Support & Static Pages (`/contacto`, `/nosotros`, `/politicas/privacidad`, `/mi-cuenta`)**:
  - `/contacto`: Converted from a developer portfolio into an operational customer support directory linking only active routes (`/gestion-de-pedidos`, `/politicas/envios`, `/politicas/devoluciones`, `/terminos-y-condiciones`), without invented phone numbers, emails, or non-functional forms.
  - `/nosotros` and `/politicas/privacidad`: Rewritten in natural brand voice, eliminating mentions of "MVP", technical base, and unintegrated future payment gateways.
  - Account `AuthenticationSection`: Cleaned presentation copy to remove "vista mock" wording.
- **Honest Support UX (`/boton-de-arrepentimiento`, `/cambios-y-devoluciones`)**:
  - Deleted non-submitting `SupportActionForm` and local simulation modal ("Solicitud recibida").
  - Introduced `SupportRequestUnavailable` ("La solicitud online no está disponible en este momento"), guiding users to check existing orders through `/gestion-de-pedidos` and `/mi-cuenta`.
- **Checkout Copy & Proof Cleanup (`src/components/checkout/*`)**:
  - Removed internal/debug and server state strings ("Configuración confirmada · ARS", "confirmadas por el servidor", "datos mock") across summary, delivery, shipping, pickup, coupon, and payment panels.
  - Removed local transfer proof file upload and the `hasTransferProof` guards from wizard state, form state, and completion logic without altering API contracts or backend schemas.
- **Placeholder Bank Data Safeguards (`src/components/checkout/bank-transfer-config.ts`)**:
  - Added detection of missing or placeholder bank configurations (zeroed CBU/CUIT, "Demo" label/bank/holder).
  - Wired `getCheckoutConfigurationIssue` to defensively block bank transfer checkout in wizard and refreshed completion with "La transferencia bancaria no está disponible en este momento.", preventing execution against fake seed accounts without altering quotes, mutating backend data, or modifying the admin panel.

### Deviations from Design

- **Support Request Form Simulation Removal**: Earlier designs assumed client-side mock form submission with success feedback. This was superseded by honest unavailability messaging (`SupportRequestUnavailable`) to prevent deceptive feedback when backend intake does not exist.
- **Bank Transfer Proof Elimination**: The original checkout flow enforced a client-side proof file upload before finalization, but the file was never transmitted to backend order endpoints. The client requirement was eliminated to reflect actual capabilities.
- **Defensive Bank Quote Validation**: Beyond neutralizing fallback UI data, active runtime checks (`bank-transfer-config.ts`) were added to prevent order completion when the server quote contains default demo/seed credentials.

### Validation

- Static Type Check (`npx tsc --noEmit`): 0 errors across frontend and backend.
- Linting (`npx eslint` across 27 touched files): Clean (0 errors, 0 warnings).
- Frontend Acceptance Test Suite (`npm run verify:frontend-acceptance`): 18/18 test harnesses passed, including `bank-transfer-config.harness.ts`.
- Browser Smoke Verification: Live browser check of `/`, `/contacto`, `/gestion-de-pedidos`, `/boton-de-arrepentimiento`, `/cambios-y-devoluciones`, and checkout without orders.
- Independent Review: PASS (`ses_ec1c9b682fferTaYEgFrabajUC`).

### Follow-up

- **Online Support Intake Pipeline**: Backend endpoints, processing queues, and email notifications for handling returns, exchanges, and statutory repentance requests remain pending implementation.
- **Operator Bank Transfer Configuration**: Backend database seed scripts continue to provision placeholder bank data (`EntrenAR Demo`, 0000000000000000000000). While frontend guards defensively block checkout against placeholder data, production activation requires an operator to configure authentic banking credentials in the backend environment.
- **Returns Policy Copy Minor Alignment**: Section "Cómo iniciar una solicitud" in `/politicas/devoluciones` instructs users to complete order details and reason, linking via CTA to `/cambios-y-devoluciones` where online requests are marked unavailable. Tracked in `docs/exec-plans/tech-debt-tracker.md`.
