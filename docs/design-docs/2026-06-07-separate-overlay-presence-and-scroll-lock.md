# Design: Separate Overlay Presence and Scroll Lock (Deferred Navigation)

## Technical Approach

We will resolve navigation scroll bugs caused by race conditions between overlay exit animations, body scroll unlocking, and route transitions.
Instead of allowing the Next.js router to navigate while the overlay is still visibly animating away (which causes scroll jumps when `useLockBodyScroll` tries to restore scroll), we will defer the navigation until the overlay's exit transition fully completes.

1. Enhance `usePresenceTransition` with an `onExited` callback, managed with refs to ensure stable closures. It will trigger in a `useEffect` reacting to `shouldRender = false` to guarantee it fires strictly after `unlockBodyScroll` cleans up.
2. Expose `onExited` in `Drawer` and `Modal` components.
3. In `MobileMenu`, intercept `<Link>` clicks. Instead of navigating immediately, prevent default, save the target href, close the menu, and then perform `router.push(href)` or a same-route scroll in the `onExited` callback.

## Architecture Decisions

### Decision: Lifecycle-based deferred navigation

**Choice**: Defer programmatic navigation (`router.push`) to the `onExited` callback of the Drawer.
**Alternatives considered**: Using hardcoded `setTimeout` in the menu component matching the CSS transition duration.
**Rationale**: Hardcoded timeouts are brittle and can drift from CSS timings. Deferring navigation via the actual presence transition hook ensures the router only changes the page when the body scroll lock is fully released and the overlay is unmounted, preventing scroll jumps.

### Decision: React effect ordering for cleanup

**Choice**: Fire `onExited` inside a `useEffect` watching `shouldRender` rather than synchronously inside the exit `setTimeout` or `skipExitAnimation` unmount request.
**Alternatives considered**: Calling `onExited` synchronously when calling `setShouldRender(false)`.
**Rationale**: React batches state updates. Calling `onExited` synchronously triggers navigation while the Drawer is still mounted, preserving its `z-50` overlay over the new route and causing scroll restoration race conditions. Firing `onExited` via an effect strictly waits for React to unmount the overlay and execute cleanup functions (like `unlockBodyScroll`), ensuring navigation starts in a clean state.

### Decision: Preserving Next.js Link prefetching

**Choice**: Continue using Next.js `<Link>` components in the MobileMenu, but intercept their `onClick` to `preventDefault()` and defer the push.
**Alternatives considered**: Replacing `<Link>` with `<button>` or `<a>`.
**Rationale**: Using `<Link>` preserves Next.js route prefetching on hover/viewport, keeping the app fast. We only take over the actual click execution and defer the navigation.

## Data Flow

    User Clicks Link in Menu
         │
         ├─ e.preventDefault()
         ├─ setPendingHref(href)
         └─ close() (triggers Drawer open=false)
                  │
                  ▼
    usePresenceTransition starts hide animation
                  │
                  ▼
    timeout completes (durationMs)
         │
         └─ setShouldRender(false)
                  │
                  ▼
    React Render Phase
         │
         ├─ Unmount Drawer children
         ├─ Run cleanup: unlockBodyScroll() ──→ restores scrollY
         └─ Run effect: trigger onExited()
                  │
                  ▼
    handleNavigation(pendingHref)
         │
         ├─ If same route: window.scrollTo(0, 0)
         └─ If different route: router.push(href)

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/usePresenceTransition.ts` | Modify | Add `onExited?: () => void`. Use `pendingExitRef` and `useEffect` on `shouldRender` to trigger after cleanup. |
| `src/components/ui/Drawer.tsx` | Modify | Add `onExited?: () => void` prop and pass it to `usePresenceTransition`. |
| `src/components/ui/Modal.tsx` | Modify | Add `onExited?: () => void` prop and pass it to `usePresenceTransition`. |
| `src/components/shop/layout/MobileMenu.tsx` | Modify | Intercept link clicks, store `pendingHref`, close menu, and execute navigation in `<Drawer onExited={...}>`. |

## Interfaces / Contracts

```typescript
type UsePresenceTransitionOptions = {
  durationMs: number;
  open: boolean;
  onExited?: () => void;
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit / Hook | `usePresenceTransition` | Verify `onExited` is NOT called on initial render when `open` is false. Verify it IS called when transitioning from true to false. |
| Manual / E2E | Menu Navigation | Open Mobile Menu, click a category. Verify menu slides out fully, THEN page navigates/scrolls, with no scroll jitter. |
| Manual / E2E | New Tab Navigation | Ctrl+click a menu link. Verify it opens in a new tab without closing the menu or triggering deferred navigation. |

## Migration / Rollout

No migration required.

## Open Questions

- None
