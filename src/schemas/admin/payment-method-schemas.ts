import { z } from "zod";

export function normalizeCbuCvu(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeCuitCuil(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function normalizeNameLike(value: string) {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, "").replace(/\s+/g, " ");
}

const nameLikePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/;

const requiredText = (fieldName: string) =>
  z.string().trim().min(1, `${fieldName} es obligatorio.`);

const requiredNameLike = (fieldName: string) =>
  requiredText(fieldName).regex(nameLikePattern, `${fieldName} solo puede incluir letras, espacios, apóstrofes o guiones.`);

export const bankTransferSchema = z.object({
  cbuCvu: z
    .string()
    .trim()
    .transform(normalizeCbuCvu)
    .refine((value) => /^\d{22}$/.test(value), "El CBU/CVU debe tener exactamente 22 dígitos."),
  alias: requiredText("El alias"),
  holderName: requiredNameLike("El titular"),
  cuitCuil: z
    .string()
    .trim()
    .transform(normalizeCuitCuil)
    .refine((value) => /^\d{2}-\d{7,9}-\d$/.test(value), "Usá el formato XX-YYYYYYYYY-Z."),
  bankName: requiredNameLike("El banco o billetera"),
});

export type BankTransferFormInput = z.input<typeof bankTransferSchema>;
export type BankTransferFormValues = z.infer<typeof bankTransferSchema>;
