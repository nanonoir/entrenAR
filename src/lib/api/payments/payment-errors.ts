const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  CHECKOUT_API_INVALID_RESPONSE: "No pudimos interpretar la respuesta del servicio. Verificá el estado de tu pedido antes de volver a intentar.",
  CHECKOUT_API_UNAVAILABLE: "No pudimos conectarnos. Si ya enviaste el pago, verificá el estado de tu pedido antes de volver a intentar.",
  CHECKOUT_SESSION_EXPIRED: "La sesión del checkout venció. Actualizá la cotización para continuar.",
  CHECKOUT_SESSION_INVALID: "La sesión del checkout venció. Actualizá la cotización para continuar.",
  IDEMPOTENCY_KEY_REUSED: "Esta solicitud ya se usó con otros datos. Actualizá la cotización e intentá de nuevo.",
  NOT_FOUND: "No encontramos el pedido. Si ya pagaste, escribinos con tu número de pedido.",
  OUT_OF_STOCK: "El stock cambió. Revisá las cantidades disponibles antes de pagar.",
  PAYMENT_ATTEMPT_ACTIVE: "Ya hay un pago en curso para este pedido. Esperá el resultado antes de intentar de nuevo.",
  PAYMENT_METHOD_UNAVAILABLE: "El pago con tarjeta no está disponible en este momento. Probá más tarde o elegí otro medio de pago.",
  PAYMENT_RETRY_UNAVAILABLE: "Ya no podés reintentar el pago de este pedido. Iniciá una compra nueva.",
  PRICE_CHANGED: "El precio o el total cambió. Actualizá la cotización antes de pagar.",
  SHIPPING_OPTION_UNAVAILABLE: "La opción de entrega seleccionada ya no está disponible.",
  UNAUTHORIZED: "Tu sesión venció. Volvé a iniciar sesión para ver el pedido.",
  VALIDATION_ERROR: "Revisá los datos de la tarjeta e intentá nuevamente.",
};

const STALE_QUOTE_CODES = new Set([
  "CHECKOUT_SESSION_EXPIRED",
  "CHECKOUT_SESSION_INVALID",
  "IDEMPOTENCY_KEY_REUSED",
  "OUT_OF_STOCK",
  "PRICE_CHANGED",
  "SHIPPING_OPTION_UNAVAILABLE",
]);

export function getPaymentErrorMessage(error: { code: string }): string {
  return PAYMENT_ERROR_MESSAGES[error.code] ?? "No pudimos procesar el pago. Intentá nuevamente en unos minutos.";
}

/** The failed request may still have been accepted: the outcome must be verified, not retried blindly. */
export function isUncertainPaymentError(error: { code: string; status?: number }): boolean {
  return error.code === "CHECKOUT_API_UNAVAILABLE"
    || error.code === "CHECKOUT_API_INVALID_RESPONSE"
    || (error.status ?? 0) >= 500;
}

export function isStaleQuotePaymentError(error: { code: string }): boolean {
  return STALE_QUOTE_CODES.has(error.code);
}
