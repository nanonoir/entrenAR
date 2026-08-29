import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type {
  AccountAddress,
  AccountAddressInput,
  AccountAsyncStatus,
  AccountOperationError,
  AccountProfile,
  AccountProfileUpdate,
} from "@/types/account";

export type AccountProfileField = keyof AccountProfileUpdate;
export type AccountAddressField = keyof AccountAddressInput;

type AccountStateProps = {
  children: ReactNode;
  empty?: ReactNode;
  error?: AccountOperationError | null;
  errorTitle?: string;
  hasData?: boolean;
  isEmpty?: boolean;
  loadingDescription?: string;
  loadingTitle?: string;
  onRetry?: () => void | Promise<unknown>;
  status: AccountAsyncStatus;
};

export function AccountState({
  children,
  empty,
  error,
  errorTitle = "No pudimos cargar esta información",
  hasData = false,
  isEmpty = false,
  loadingDescription = "Estamos buscando los datos de tu cuenta.",
  loadingTitle = "Cargando tu cuenta",
  onRetry,
  status,
}: AccountStateProps) {
  if (status === "loading" && !hasData) {
    return <AccountLoadingState description={loadingDescription} title={loadingTitle} />;
  }

  if (status === "error" && !hasData) {
    return <AccountErrorState error={error} onRetry={onRetry} title={errorTitle} />;
  }

  if (isEmpty && status !== "loading" && status !== "error") {
    return empty ?? <EmptyState description="Todavía no hay información para mostrar." title="Sin información" />;
  }

  return (
    <>
      {status === "loading" ? <AccountInlineLoading title={loadingTitle} /> : null}
      {status === "error" ? <AccountInlineError error={error} onRetry={onRetry} /> : null}
      {children}
    </>
  );
}

export function getAccountErrorMessage(
  error: AccountOperationError | null | undefined,
  fallback: string,
): string {
  if (!error) {
    return fallback;
  }

  const messages: Record<string, string> = {
    ACCOUNT_API_INVALID_RESPONSE: "Recibimos una respuesta inesperada. Intentá de nuevo.",
    ACCOUNT_API_UNAVAILABLE: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.",
    ACCOUNT_BOOTSTRAP_FAILED: "No pudimos cargar tu cuenta. Intentá de nuevo.",
    ADDRESS_LIMIT_REACHED: "Ya alcanzaste el máximo de 6 direcciones.",
    AUTH_BOOTSTRAP_FAILED: "No pudimos verificar tu sesión. Intentá de nuevo.",
    AUTH_FORGOT_PASSWORD_FAILED: "No pudimos procesar la recuperación. Intentá de nuevo.",
    AUTH_LOGIN_FAILED: "No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.",
    AUTH_LOGOUT_FAILED: "No pudimos cerrar la sesión correctamente.",
    AUTH_PASSWORD_CHANGE_FAILED: "No pudimos cambiar la contraseña. Revisá los datos e intentá de nuevo.",
    AUTH_PASSWORD_RESET_FAILED: "El enlace de recuperación no es válido o ya venció.",
    AUTH_REFRESH_FAILED: "Tu sesión venció. Iniciá sesión nuevamente.",
    AUTH_REGISTER_FAILED: "No pudimos crear la cuenta. Revisá los datos e intentá de nuevo.",
    EMAIL_EXISTS: "Ya existe una cuenta con ese email. Probá iniciar sesión.",
    INVALID_CREDENTIALS: "El email o la contraseña no son correctos.",
    INVALID_RESET_TOKEN: "El enlace de recuperación no es válido o ya venció.",
    PRODUCT_NOT_FOUND: "El producto ya no está disponible.",
    UNAUTHORIZED: "Tu sesión no está activa. Iniciá sesión para continuar.",
    VALIDATION_ERROR: "Revisá los campos marcados e intentá de nuevo.",
    WISHLIST_ITEM_EXISTS: "Ese producto ya está en tu lista de deseados.",
    WISHLIST_ITEM_NOT_FOUND: "El producto ya no está en tu lista de deseados.",
  };

  return messages[error.code] ?? fallback;
}

export function getAccountFieldError(
  error: AccountOperationError | null | undefined,
  field: string,
): string | undefined {
  return error?.issues?.find((issue) => issue.field === field)?.message;
}

export function focusFirstInvalidField(
  fieldIds: readonly string[],
  invalidFieldIds: readonly string[] = fieldIds,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const element = invalidFieldIds
    .map((fieldId) => document.getElementById(fieldId))
    .find((candidate): candidate is HTMLElement => candidate instanceof HTMLElement);

  if (!element) {
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.focus({ preventScroll: true });
}

export function getProfileFieldErrors(profile: AccountProfile): Partial<Record<AccountProfileField, string>> {
  const errors: Partial<Record<AccountProfileField, string>> = {};

  if (!isValidName(profile.firstName)) {
    errors.firstName = "Ingresá un nombre usando letras, espacios, apóstrofes o guiones.";
  }

  if (!isValidName(profile.lastName)) {
    errors.lastName = "Ingresá un apellido usando letras, espacios, apóstrofes o guiones.";
  }

  if (!/^\d{6,9}$/.test(profile.dni.trim())) {
    errors.dni = "El DNI debe tener entre 6 y 9 números.";
  }

  if (!isNonEmptyText(profile.gender, 40)) {
    errors.gender = "Ingresá tu género.";
  }

  if (!isValidIsoDate(profile.birthDate)) {
    errors.birthDate = "Ingresá una fecha válida.";
  }

  if (!isValidPhone(profile.phone)) {
    errors.phone = "Ingresá un teléfono válido.";
  }

  return errors;
}

export function getAddressFieldErrors(address: AccountAddress): Partial<Record<AccountAddressField, string>> {
  const errors: Partial<Record<AccountAddressField, string>> = {};

  if (!isNonEmptyText(address.label, 60)) {
    errors.label = "Ingresá una etiqueta para identificarla.";
  }

  if (!isNonEmptyText(address.recipient, 120)) {
    errors.recipient = "Ingresá quién recibe el pedido.";
  }

  if (!isNonEmptyText(address.street, 200)) {
    errors.street = "Ingresá la calle y el número.";
  }

  if (!isNonEmptyText(address.city, 120)) {
    errors.city = "Ingresá la ciudad.";
  }

  if (!isNonEmptyText(address.province, 120)) {
    errors.province = "Ingresá la provincia.";
  }

  if (!isValidPostalCode(address.postalCode)) {
    errors.postalCode = "Ingresá un código postal válido.";
  }

  if (!isValidPhone(address.phone)) {
    errors.phone = "Ingresá un teléfono válido.";
  }

  return errors;
}

function AccountLoadingState({ description, title }: { description: string; title: string }) {
  return (
    <div
      aria-live="polite"
      className="grid min-h-40 place-items-center gap-3 rounded-card border border-border bg-surface p-8 text-center"
      role="status"
    >
      <LoaderCircle aria-hidden className="animate-spin text-accent" size={24} />
      <div className="grid gap-1">
        <p className="font-subtitle text-lg font-semibold uppercase">{title}</p>
        <p className="text-sm text-text-muted">{description}</p>
      </div>
    </div>
  );
}

function AccountErrorState({
  error,
  onRetry,
  title,
}: {
  error: AccountOperationError | null | undefined;
  onRetry?: () => void | Promise<unknown>;
  title: string;
}) {
  return (
    <div className="grid gap-4 rounded-card border border-sale/30 bg-red-50 p-6" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 shrink-0 text-sale" size={20} />
        <div className="grid gap-1">
          <p className="font-subtitle font-semibold uppercase text-sale">{title}</p>
          <p className="text-sm leading-6 text-sale">
            {getAccountErrorMessage(error, "Intentá de nuevo en unos segundos.")}
          </p>
        </div>
      </div>
      {onRetry ? (
        <Button className="justify-self-start" onClick={() => void onRetry()} variant="secondary">
          <RefreshCw aria-hidden size={16} />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

function AccountInlineError({
  error,
  onRetry,
}: {
  error: AccountOperationError | null | undefined;
  onRetry?: () => void | Promise<unknown>;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-sale/30 bg-red-50 p-3 text-sm text-sale" role="alert">
      <span className="flex items-center gap-2">
        <AlertTriangle aria-hidden size={16} />
        {getAccountErrorMessage(error, "No pudimos actualizar la información.")}
      </span>
      {onRetry ? (
        <Button onClick={() => void onRetry()} size="sm" variant="secondary">
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

function AccountInlineLoading({ title }: { title: string }) {
  return (
    <div aria-live="polite" className="mb-4 flex items-center gap-2 text-sm text-text-muted" role="status">
      <LoaderCircle aria-hidden className="animate-spin text-accent" size={16} />
      {title}...
    </div>
  );
}

function isValidName(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 120 && /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u.test(normalized);
}

function isNonEmptyText(value: string, maxLength: number): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength;
}

function isValidPhone(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= 7 && normalized.length <= 24 && /^\+?[0-9\s\-()]+$/.test(normalized);
}

function isValidPostalCode(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 20 && /^[A-Za-z0-9][A-Za-z0-9 -]*$/.test(normalized);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
