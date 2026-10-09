# Design: footer-static-legal-support-pages

## Technical Approach
Implement the required static pages as Server Components within the `app/(shop)` route group. Use the existing `<Container>` UI primitive for consistent layout. Typography will use high-contrast semantic tokens (`text-text`) to ensure readability, completely removing small accent labels above the `h1` headings. Content will match the exact text and sections specified in the formal spec.

## Architecture Decisions

### Decision: Layout Structure for Static Pages
**Choice**: Use `<section>` wrapper with padding, `<Container>`, and a `max-w-3xl` text grid directly in each page file.
**Alternatives considered**: Create a new `<LegalPageLayout>` wrapper component.
**Rationale**: Repeating the container structure (which is only ~10 lines) is simpler than introducing a rigid layout component. It prevents overengineering and allows page-specific additions, such as the Returns CTA or the Contact page social links, without cluttering a layout component with complex props.

### Decision: Typography and Visual Hierarchy
**Choice**: Use `text-text` (foreground/black-level) for body text and remove the accent eyebrow label (e.g., "Legal") above headings.
**Alternatives considered**: Keep `text-text-muted` and the eyebrow label.
**Rationale**: The spec strictly forbids light gray text and eyebrow labels to maintain a clear visual hierarchy and high readability.

### Decision: Handling Out-of-Scope Footer Links
**Choice**: Comment out out-of-scope links (`/ayuda/boton-arrepentimiento`, `/ayuda/cambios-devoluciones`, `/cuenta/pedidos`) in `src/lib/data/footer.ts`.
**Alternatives considered**: Render them as disabled buttons or leave as 404s.
**Rationale**: Avoids exposing broken links in the global navigation. The Returns policy page will contain a soft dead-end CTA pointing to the future route, providing a clear path rather than a broken global link.

## Data Flow

Pages are purely static Server Components with no data fetching. Content is hardcoded in JSX.

    Client ──→ Server Component (Page) ──→ HTML Response

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(shop)/nosotros/page.tsx` | Create | Static "Sobre nosotros" page. |
| `src/app/(shop)/contacto/page.tsx` | Create | Static "Contacto" portfolio page with external SVG links (`target="_blank" rel="noopener noreferrer"`). |
| `src/app/(shop)/terminos-y-condiciones/page.tsx` | Modify | Update to high-contrast typography, remove eyebrow, add specified legal sections. |
| `src/app/(shop)/politicas/envios/page.tsx` | Create | Static "Política de envíos" page. |
| `src/app/(shop)/politicas/devoluciones/page.tsx` | Create | Static "Política de devoluciones" page. Includes a strong CTA using standard button classes (e.g., `bg-text text-white`) pointing to `/ayuda/cambios-devoluciones`. |
| `src/app/(shop)/politicas/privacidad/page.tsx` | Modify | Update to high-contrast typography, remove eyebrow, add specified privacy sections. |
| `src/app/(shop)/politicas/calidad/page.tsx` | Create | Static "Política de calidad" page. |
| `src/lib/data/footer.ts` | Modify | Add Portfolio (`logoNR.svg`) to `footerSocialLinks`. Comment out `footerHelpActions` items to prevent global 404s. |

## Interfaces / Contracts

- Link components to external channels MUST use `target="_blank" rel="noopener noreferrer"`.
- Returns CTA MUST NOT include any "coming soon" or placeholder language in the visible UI.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Static | Syntax & Code Standards | Run `npm run lint` to ensure valid React/Next.js syntax and no unused imports. |

*(No test runner currently configured for the project)*

## Migration / Rollout

No migration required.

## Open Questions

- None
