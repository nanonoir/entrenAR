# Admin Shared Toasts Specification

## Purpose

Defines a reusable CRM/admin toast capability decoupled from sales-specific state so admin modules can emit consistent notifications.

## Requirements

### Requirement: Shared Admin Toast System

The system MUST provide a single shared admin toast mechanism for CRM modules and MUST NOT create a payment-method-specific parallel notification system.

#### Scenario: Payment methods use shared toasts

- GIVEN a payment method action succeeds or fails validation
- WHEN the notification is shown
- THEN it MUST be emitted through the shared admin toast system
- AND the existing admin toast container MUST display it

#### Scenario: Sales toasts remain functional

- GIVEN existing sales flows emit CRM notifications
- WHEN the toast system is shared
- THEN sales notifications MUST continue to render through the same admin toast container

### Requirement: Toast Messages for Payment Methods

The system MUST show consistent success and validation toasts for payment method actions.

#### Scenario: Success messages

- GIVEN a provider is activated, edited, or deactivated successfully
- WHEN the action completes
- THEN the toast MUST say `{Provider} activado correctamente.`, `Configuración actualizada correctamente.`, or `Medio de pago desactivado correctamente.` as applicable

#### Scenario: Validation messages

- GIVEN bank transfer validation fails or a selectable provider has no option selected
- WHEN the administrator confirms
- THEN the toast MUST say `Debes completar todos los campos obligatorios correctamente.` or `Debes seleccionar un plazo para activar este medio de pago.` as applicable
