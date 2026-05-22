export const passwordRules = [
  { label: "8 caracteres mínimo", test: (value: string) => value.length >= 8 },
  { label: "Una mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Una minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Un número", test: (value: string) => /\d/.test(value) },
  { label: "Un carácter especial", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPassword(value: string) {
  return passwordRules.every((rule) => rule.test(value));
}

export function isValidEmail(value: string) {
  return emailPattern.test(value.trim());
}
