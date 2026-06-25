import { z } from "zod";

export function normalizeCbuCvu(value: string) {
  return value.replace(/[\s-]/g, "");
}

const requiredText = (fieldName: string) =>
  z.string().trim().min(1, `${fieldName} es obligatorio.`);

export const bankTransferSchema = z.object({
  cbuCvu: z
    .string()
    .trim()
    .transform(normalizeCbuCvu)
    .refine((value) => /^\d{22}$/.test(value), "El CBU/CVU debe tener exactamente 22 dígitos."),
  alias: requiredText("El alias"),
  holderName: requiredText("El titular"),
  cuitCuil: z
    .string()
    .trim()
    .regex(/^\d{2}-\d{7,9}-\d$/, "Usá el formato XX-YYYYYYYYY-Z."),
  bankName: requiredText("El banco o billetera"),
});

export type BankTransferFormInput = z.input<typeof bankTransferSchema>;
export type BankTransferFormValues = z.infer<typeof bankTransferSchema>;
