# Branded Error System Specification

## Purpose

Provide accessible branded root error recovery without replacing localized recoverable states.

## Requirements

### Requirement: Reusable Full-Page Errors

The system MUST provide a responsive accessible full-page error layout using the tracked `/error.svg`, error code, concise recovery copy, and primary plus optional secondary actions. It MUST NOT replace localized banners, form errors, or recoverable section states.

#### Scenario: Public 404
- GIVEN a nonexistent public route
- WHEN not-found renders
- THEN it MUST show 404, catalog and back actions, and no admin-login hint

#### Scenario: Recoverable runtime error
- GIVEN a route runtime error
- WHEN the route boundary renders
- THEN it MUST offer framework reset and home navigation without internals

### Requirement: Stable Root Boundaries

The system MUST provide root not-found, route error, and global error boundaries. Route and global error boundaries MUST be Client Components; global error MUST render its own HTML and body and hide exception details.

#### Scenario: Global failure
- GIVEN root-layout rendering fails
- WHEN the global boundary renders
- THEN it MUST display branded recovery with valid HTML and body
