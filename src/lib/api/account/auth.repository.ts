import { getAccountRepository } from "@/lib/api/account/account.repository";
import type { DataSource } from "@/lib/api/config";
import type {
  AccountRole,
  AccountUser,
  AuthCredentials,
  AuthSession,
  PasswordChangeInput,
  PasswordResetInput,
} from "@/types/account";

export type AuthRepository = {
  bootstrap(): Promise<AccountUser | null>;
  changePassword(input: PasswordChangeInput): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  getCurrentUser(): Promise<AccountUser>;
  login(input: AuthCredentials): Promise<AuthSession>;
  logout(): Promise<void>;
  refresh(): Promise<AuthSession>;
  register(input: AuthCredentials): Promise<AuthSession>;
  resetPassword(input: PasswordResetInput): Promise<void>;
};

export type AuthUserRole = AccountRole;

export function getAuthRepository(source?: DataSource): AuthRepository {
  return getAccountRepository(source);
}
