# Money Calculation Engine Specification

## Purpose

Defines the shared bounded-precision monetary authority for P0 manual sales and purchase orders.

## Requirements

### Requirement: Decimal-Compatible Normalized Arithmetic

The system MUST provide one shared money primitive for multiply, add, subtract, and normalization compatible with persisted `Decimal(12,2)` values. It MUST reject non-finite values, invalid signs where prohibited, and inputs with more than two decimal places; raw floating-point accumulation MUST NOT be authoritative.

#### Scenario: Exact decimal calculation
- GIVEN quantities and prices containing decimal values
- WHEN a P0 flow calculates derived money
- THEN persisted results are normalized to two decimals without binary floating-point drift

#### Scenario: Invalid precision
- GIVEN a monetary write input with three decimal places
- WHEN validation occurs
- THEN it MUST return a controlled validation error before persistence

### Requirement: P0 Dependency Boundary

Ledger schema and generic inventory primitives MUST be available before lifecycle changes; fail-closed lifecycle/ownership MUST deploy before ledger-managed Order writers; coordinated frontend payload removal MUST deploy before strict derived-field rejection. Each phase MUST remain deployable without silently creating UNKNOWN Orders.

#### Scenario: Contract rollout order
- GIVEN frontend payload builders still submit derived values
- WHEN strict backend schemas are not yet coordinated
- THEN strict rejection MUST NOT be enabled
