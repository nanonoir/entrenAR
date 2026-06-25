import { z } from "zod";

const nameRegex = /^[\p{L}\s'’-]+$/u;
const phoneRegex = /^[+\d\s()-]*$/;
const dniRegex = /^[\d-]*$/;

const optionalText = z.string().trim().optional().or(z.literal(""));

export const customerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Ingresá nombre y apellido").regex(nameRegex, "Usá solo letras, espacios, apóstrofes o guiones"),
    email: z.string().trim().toLowerCase().email("Ingresá un e-mail válido"),
    phone: optionalText.refine((value) => !value || phoneRegex.test(value), "Ingresá un teléfono válido"),
    dniOrCuil: optionalText.refine((value) => !value || dniRegex.test(value), "Ingresá solo números y guiones"),
    street: optionalText,
    number: optionalText,
    floorOrApartment: optionalText,
    postalCode: optionalText,
    neighborhood: optionalText,
    city: optionalText,
    provinceOrState: optionalText,
    country: z.string().trim().default("Argentina"),
  })
  .superRefine((data, ctx) => {
    const addressValues = [data.street, data.number, data.floorOrApartment, data.postalCode, data.neighborhood, data.city, data.provinceOrState].map((value) => value?.trim() ?? "");
    const hasAddress = addressValues.some(Boolean);
    if (!hasAddress) return;
    const required: Array<keyof CustomerFormInput> = ["street", "number", "postalCode", "city", "provinceOrState", "country"];
    for (const field of required) {
      if (!String(data[field] ?? "").trim()) {
        ctx.addIssue({ code: "custom", path: [field], message: "Completá este dato de envío" });
      }
    }
  });

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export function normalizeOptionalField(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}
