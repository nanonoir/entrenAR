/** Mirrors the backend challenge allowlist (`sanitizeChallengeUrl`): https on Mercado Pago/Libre domains only. */
const CHALLENGE_HOST_SUFFIXES = ["mercadopago.com", "mercadopago.com.ar", "mercadolibre.com", "mercadolibre.com.ar"] as const;

function isAllowedChallengeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return CHALLENGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Returns the normalized URL only for plain https URLs on an allowed host, without credentials or custom ports. */
export function sanitizeChallengeUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  return isAllowedChallengeHost(url.hostname) ? url.toString() : null;
}

/** True only for an https origin whose host is on the challenge allowlist. */
export function isAllowedChallengeOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && !url.port && isAllowedChallengeHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Accepts a `message` event only from the challenge iframe window and an allowed origin.
 * The payload is never trusted: a match merely signals that the status should be refreshed.
 */
export function isTrustedChallengeMessage(
  event: { origin: string; source: unknown },
  frameWindow: unknown,
): boolean {
  if (!frameWindow || event.source !== frameWindow) return false;
  return isAllowedChallengeOrigin(event.origin);
}
