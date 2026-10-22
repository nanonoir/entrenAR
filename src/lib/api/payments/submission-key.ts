export interface SubmissionKeyState {
  key: string;
  token: string;
}

function createSubmissionKey(): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `card-${suffix}`;
}

/**
 * One idempotency key per explicit submission. A network retry of the same submission (same one-shot card
 * token) reuses the key so the backend deduplicates; a new token is a new submission with a new key.
 */
export function resolveSubmissionKey(
  previous: SubmissionKeyState | null,
  token: string,
  createKey: () => string = createSubmissionKey,
): SubmissionKeyState {
  return previous && previous.token === token ? previous : { key: createKey(), token };
}
