# Client Support Actions Specification

## Purpose

Defines the behavior of client-facing operational support forms for order tracking, order cancellation (repentance), and returns/exchanges.

## Requirements

### Requirement: Order Tracking Form

The system MUST provide an order tracking form at `/gestion-de-pedidos` that normalizes input to uppercase and looks up order status.

#### Scenario: Valid Tracking Code
- GIVEN the user is on `/gestion-de-pedidos`
- WHEN the user enters a valid tracking code and submits
- THEN the system MUST display the order summary below the form, including order number, status, date, total, tracking code, and products
- AND the previous result MUST only update or clear upon a new submission, not during typing

#### Scenario: Invalid Tracking Code
- GIVEN the user is on `/gestion-de-pedidos`
- WHEN the user enters an invalid tracking code and submits
- THEN the system MUST display an error modal with text "No encontramos información para ese código por el momento. Verificá el código o iniciá sesión para ver tus pedidos."
- AND provide a "Reintentar" button to close the modal
- AND provide an "Iniciar Sesión" button to open the login drawer

### Requirement: Tracking Auth CTA Hydration

The system MUST isolate the Auth CTA on `/gestion-de-pedidos` to avoid hydration mismatches.

#### Scenario: During Hydration
- GIVEN the page is hydrating
- WHEN the CTA renders
- THEN the system MUST render a disabled button with stable dimensions and no text content

#### Scenario: Post Hydration - Guest
- GIVEN hydration is complete
- AND the user is not authenticated
- WHEN the CTA renders
- THEN it MUST display "Iniciar Sesión para ver todos los Pedidos" and open the login drawer on click

#### Scenario: Post Hydration - Authenticated
- GIVEN hydration is complete
- AND the user is authenticated
- WHEN the CTA renders
- THEN it MUST display "{Eye icon} Ver todos mis pedidos" and link to `/mi-cuenta?seccion=pedidos`

### Requirement: Support Action Forms

The system MUST provide frontend-only forms for "Botón de Arrepentimiento" and "Cambios y Devoluciones" that use validation patterns similar to checkout.

#### Scenario: Repentance Form Submission
- GIVEN the user is on `/boton-de-arrepentimiento`
- WHEN they fill out fullName, email, phone, orderNumber, an optional hasReceivedOrder checkbox, and message
- AND they submit the form with valid data
- THEN the system MUST show a success modal with a contact-soon message and a single "Volver al inicio" button to `/`
- AND the form data MUST clear only when that button is clicked

#### Scenario: Returns Form Submission
- GIVEN the user is on `/cambios-y-devoluciones`
- WHEN they fill out fullName, email, phone, orderNumber, and a message labeled "Productos afectados y detalle/descripción"
- AND they submit the form with valid data
- THEN the system MUST show a success modal with a contact-soon message and a single "Volver al inicio" button to `/`
