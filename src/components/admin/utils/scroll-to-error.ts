import type { FieldErrors, FieldValues } from "react-hook-form";

function scrollToElement(element: Element) {
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  if (element instanceof HTMLElement) element.focus({ preventScroll: true });
}

export function scrollToFirstError<TFieldValues extends FieldValues>(errors: FieldErrors<TFieldValues>, prioritySections: string[] = []) {
  if (Object.keys(errors).length === 0) return;

  for (const section of prioritySections) {
    const target = document.getElementById(section) ?? document.querySelector(`[data-error-section="${section}"]`);
    if (target) {
      scrollToElement(target);
      return;
    }
  }

  const firstInvalid = document.querySelector('[aria-invalid="true"]');
  if (firstInvalid) scrollToElement(firstInvalid);
}
