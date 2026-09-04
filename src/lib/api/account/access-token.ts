let accountAccessToken: string | null = null;

export function getAccountAccessToken(): string | null {
  return accountAccessToken;
}

export function setAccountAccessToken(accessToken: string): void {
  accountAccessToken = accessToken.trim() || null;
}

export function clearAccountAccessToken(): void {
  accountAccessToken = null;
}
