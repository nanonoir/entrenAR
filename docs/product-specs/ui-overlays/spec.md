# UI Overlays Specification

## Purpose

This spec defines the behavior of UI overlays (Modals, Drawers), their presence transitions, and their interaction with document scroll locking and Next.js route navigation.

## Requirements

### Requirement: Same-Route Persistent Navigation

The system MUST provide a narrow same-route scroll-to-top behavior for persistent shop navigation elements. The behavior MUST only intercept clicks when the target pathname equals the current pathname. Cross-route navigation MUST preserve normal Next.js `Link` behavior.

#### Scenario: Same-Route Persistent Navigation
- GIVEN the user is scrolled down on a page
- WHEN the user clicks a persistent navigation link pointing to the current pathname
- THEN the click is prevented from re-navigating
- AND the page scrolls to the absolute top

#### Scenario: Cross-Route Persistent Navigation
- GIVEN the user is on page A
- WHEN the user clicks a persistent navigation link pointing to page B
- THEN the system navigates to page B
- AND normal Next.js route behavior is preserved

### Requirement: Default Route Scroll Behavior

The system MUST preserve the default `next/link` route scroll behavior for programmatic navigation. Local route-link wrappers or blanket route scroll restoration MUST NOT be used to "fix" normal navigation. Global smooth scrolling on the HTML body MUST NOT interfere with immediate programmatic scroll restoration.

#### Scenario: Normal Navigation
- GIVEN the user is on a long page
- WHEN the user clicks a `next/link` to a new route
- THEN the browser navigates to the new route
- AND the scroll position is reset to the top without a global smooth scrolling delay

### Requirement: Overlay Presence Transitions

The system MUST separate presence transitions from body scroll locking. `usePresenceTransition` MUST handle animations and DOM presence only.

#### Scenario: Overlay Animation
- GIVEN an overlay is configured with presence transitions
- WHEN the overlay opens or closes
- THEN the presence hook applies transition classes and mounts/unmounts the DOM node
- AND the presence hook does not independently mutate body scroll state

### Requirement: Overlay Exit Lifecycle Coordination

The system MUST support an explicit post-exit lifecycle hook for UI overlays to defer actions (like route navigation) until after exit animations complete and the DOM node is removed. `usePresenceTransition` MUST support an `onExited` callback. This callback MUST ONLY fire from a `useEffect` observing `shouldRender`, ensuring it executes strictly after React has committed the unmount and body scroll locks are cleaned up. Calling `onExited` synchronously during state updates is forbidden. The `onExited` callback MUST NOT fire on initial render when `open=false`. Base overlays (`Drawer`, `Modal`) SHOULD pass through `onExited?: () => void` for lifecycle coordination. MobileMenu route navigation from inside the drawer MUST be deferred until the drawer exits, using the `onExited` lifecycle instead of hardcoded timeout. The system MUST provide an optional `skipExitAnimation` flag to unmount overlays instantly for immediate navigation.

#### Scenario: Deferred Navigation on Exit
- GIVEN an open Drawer contains a MobileMenu navigation link
- WHEN the user clicks the link to a new route
- THEN the Drawer initiates its close transition immediately
- AND the system defers navigation, waiting until `onExited` fires
- AND the system navigates to the new route only after the Drawer is unmounted
- AND the old drawer z-index is never shown over the new route

#### Scenario: Same-Route Link inside Drawer
- GIVEN an open Drawer containing a MobileMenu navigation link
- WHEN the user clicks the link pointing to the current route
- THEN the Drawer initiates its close transition immediately
- AND the system waits until `onExited` fires
- AND the system closes the drawer and scrolls to the top instead of re-navigating

#### Scenario: Immediate Close for Non-Navigation
- GIVEN an open Drawer
- WHEN the user clicks the close button or backdrop
- THEN the Drawer initiates its close transition immediately
- AND existing immediate overlay close behavior remains unchanged without deferred actions

### Requirement: Body Scroll Locking

Base UI overlay components (`Drawer`, `Modal`) MUST explicitly compose body scroll locking. The lock mechanism MUST capture the route identity when the lock is applied.

#### Scenario: Opening an Overlay
- GIVEN the user is on a page with scroll position `Y`
- WHEN an overlay opens
- THEN the system captures the current route and locks the body scroll

### Requirement: Context-Aware Scroll Restoration

When an overlay unlocks, the system MUST restore the previous scroll position if the user is still on the same route they were on when the lock was applied. If the route changed while locked, the system MUST scroll to the absolute top instead of restoring stale scroll.

#### Scenario: Closing without Navigation
- GIVEN an overlay is open and body scroll is locked
- WHEN the overlay is closed
- THEN the system verifies the current route matches the captured route
- AND the system restores the body scroll to the original `Y` position

#### Scenario: Closing after Navigation
- GIVEN an overlay is open and body scroll is locked
- WHEN the user clicks a link inside the overlay that navigates to a new route
- THEN the overlay unmounts and releases the lock
- AND the system detects the route has changed
- AND the system scrolls to the absolute top after restoring body styles
