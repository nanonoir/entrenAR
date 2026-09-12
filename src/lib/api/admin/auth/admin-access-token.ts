let adminAccessToken: string | null = null;

export function getAdminAccessToken(): string | null {
  return adminAccessToken;
}

export function setAdminAccessToken(token: string): void {
  if (!token.trim()) throw new Error("The administrator access token cannot be empty.");
  adminAccessToken = token;
}

export function clearAdminAccessToken(): void {
  adminAccessToken = null;
}
