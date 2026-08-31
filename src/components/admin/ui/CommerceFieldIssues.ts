import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import type { CommerceApiIssue } from "@/lib/api/commerce/client";

export function applyCommerceFieldIssues<TFieldValues extends FieldValues>(
  issues: readonly CommerceApiIssue[],
  resolveField: (field: string) => FieldPath<TFieldValues> | undefined,
  setError: UseFormSetError<TFieldValues>,
): FieldPath<TFieldValues> | undefined {
  let firstField: FieldPath<TFieldValues> | undefined;

  for (const issue of issues) {
    const field = resolveField(issue.field);
    if (!field) continue;

    setError(field, { message: issue.message, type: "server" });
    firstField ??= field;
  }

  return firstField;
}

export function focusFirstCommerceError() {
  if (typeof document === "undefined") return;

  const firstInvalid = document.querySelector('[aria-invalid="true"]');
  if (!(firstInvalid instanceof HTMLElement)) return;

  firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  firstInvalid.focus({ preventScroll: true });
}
