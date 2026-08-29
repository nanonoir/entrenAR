import { z } from "zod";

const RESET_TOKEN_MAX_LENGTH = 512;

export const passwordSchema = z.string({
  error: "Password must be a string.",
}).min(12, { error: "Password must contain at least 12 characters." });

export const emailSchema = z.email({ error: "Email must be valid." }).transform((email) => email.toLowerCase());

export const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
}).strict();

export const authCredentialsSchema = credentialsSchema;
export const loginSchema = credentialsSchema;
export const registerSchema = credentialsSchema;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
}).strict();

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  token: z.string({ error: "Reset token must be a string." }).trim().min(1, { error: "Reset token is required." }).max(RESET_TOKEN_MAX_LENGTH, { error: "Reset token is too long." }),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: "Current password must be a string." }).min(1, { error: "Current password is required." }),
  newPassword: passwordSchema,
}).strict();

export type AuthCredentialsInput = z.infer<typeof credentialsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
