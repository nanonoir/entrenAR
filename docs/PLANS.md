# ExecPlans Guide

This document defines how ExecPlans are created, structured, tracked, and archived in EntrenAR.

## Directory Layout

- `docs/exec-plans/active/`: Holds actively executed plans.
- `docs/exec-plans/completed/`: Holds completed and validated plans.
- `docs/exec-plans/tech-debt-tracker.md`: Concrete unresolved technical debt tracked across the project.

## Structure of an ExecPlan

Each ExecPlan must be stored as a Markdown document (`docs/exec-plans/active/<name>.md`) and contain the following sections:

1. **Objective**: Concrete technical or architectural goal.
2. **Context**: Relevant system background, files involved, and dependencies.
3. **Scope & Non-Goals**: Clear boundaries of what is included and excluded.
4. **Execution Plan**: Discrete, verifiable work units and tasks.
5. **Decisions & Rationale**: Key architectural and technical choices made during planning or execution.
6. **Progress Tracking**: Status checklist of planned tasks.
7. **Validation**: Concrete commands and verification evidence (unit, integration, harnesses, E2E).
8. **Final Implementation Outcome**: Appended upon completion before moving the document to `docs/exec-plans/completed/`.
