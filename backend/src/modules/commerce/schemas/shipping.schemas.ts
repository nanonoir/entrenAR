import { z } from "zod";

import {
  ARGENTINE_SHIPPING_ZONE_IDS,
  FIXED_WEIGHT_BANDS,
  PICKUP_COST_TYPE,
  PICKUP_COVERAGE_TYPE,
  PICKUP_POINT_STATUS,
  PICKUP_WEEK_DAY,
  SHIPPING_MODALITY,
  SHIPPING_PROVIDER_IDS,
  SHIPPING_PROVIDER_STATUS,
} from "../commerce.constants";

const shippingProviderStatusValues = [
  SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED,
  SHIPPING_PROVIDER_STATUS.CONFIGURED_INACTIVE,
  SHIPPING_PROVIDER_STATUS.ACTIVE,
] as [
  (typeof SHIPPING_PROVIDER_STATUS)[keyof typeof SHIPPING_PROVIDER_STATUS],
  ...(typeof SHIPPING_PROVIDER_STATUS)[keyof typeof SHIPPING_PROVIDER_STATUS][],
];

const pickupPointStatusValues = [
  PICKUP_POINT_STATUS.NOT_CONFIGURED,
  PICKUP_POINT_STATUS.CONFIGURED_INACTIVE,
  PICKUP_POINT_STATUS.ACTIVE,
] as [
  (typeof PICKUP_POINT_STATUS)[keyof typeof PICKUP_POINT_STATUS],
  ...(typeof PICKUP_POINT_STATUS)[keyof typeof PICKUP_POINT_STATUS][],
];

const shippingModalityValues = [SHIPPING_MODALITY.HOME_DELIVERY, SHIPPING_MODALITY.BRANCH_DELIVERY] as [
  (typeof SHIPPING_MODALITY)[keyof typeof SHIPPING_MODALITY],
  ...(typeof SHIPPING_MODALITY)[keyof typeof SHIPPING_MODALITY][],
];

const pickupCostTypeValues = [PICKUP_COST_TYPE.FREE, PICKUP_COST_TYPE.FIXED] as [
  (typeof PICKUP_COST_TYPE)[keyof typeof PICKUP_COST_TYPE],
  ...(typeof PICKUP_COST_TYPE)[keyof typeof PICKUP_COST_TYPE][],
];

const pickupCoverageTypeValues = [PICKUP_COVERAGE_TYPE.ALL, PICKUP_COVERAGE_TYPE.PROVINCES] as [
  (typeof PICKUP_COVERAGE_TYPE)[keyof typeof PICKUP_COVERAGE_TYPE],
  ...(typeof PICKUP_COVERAGE_TYPE)[keyof typeof PICKUP_COVERAGE_TYPE][],
];

const pickupWeekDayValues = Object.values(PICKUP_WEEK_DAY) as [
  (typeof PICKUP_WEEK_DAY)[keyof typeof PICKUP_WEEK_DAY],
  ...(typeof PICKUP_WEEK_DAY)[keyof typeof PICKUP_WEEK_DAY][],
];

const identifierSchema = z.string({ error: "Identifier must be a string." })
  .trim()
  .min(1, { error: "Identifier is required." })
  .max(160, { error: "Identifier is too long." });

const nonNegativeIntegerSchema = z.number({ error: "Value must be a number." })
  .int({ error: "Value must be an integer." })
  .nonnegative({ error: "Value must be zero or greater." });

const positiveIntegerSchema = z.number({ error: "Value must be a number." })
  .int({ error: "Value must be an integer." })
  .positive({ error: "Value must be greater than zero." });

const nonNegativeMoneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .nonnegative({ error: "Amount must be zero or greater." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

const positiveMoneySchema = z.number({ error: "Amount must be a number." })
  .finite({ error: "Amount must be finite." })
  .positive({ error: "Amount must be greater than zero." })
  .multipleOf(0.01, { error: "Amount can have at most two decimal places." });

const nameSchema = (field: string) => z.string({ error: `${field} must be a string.` })
  .trim()
  .min(1, { error: `${field} is required.` })
  .max(200, { error: `${field} is too long.` })
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, { error: `${field} contains invalid characters.` });

const textSchema = (field: string, max: number) => z.string({ error: `${field} must be a string.` })
  .trim()
  .min(1, { error: `${field} is required.` })
  .max(max, { error: `${field} is too long.` });

const phoneSchema = textSchema("Phone", 32).regex(/^\+?[0-9 ()-]+$/, { error: "Phone contains invalid characters." });
const postalCodeSchema = textSchema("Postal code", 24).regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, { error: "Postal code contains invalid characters." });
const timeSchema = z.string({ error: "Time must be a string." })
  .trim()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { error: "Time must use HH:mm format." });

const providerOriginSchema = z.object({
  apartment: textSchema("Apartment", 40).optional(),
  city: nameSchema("City"),
  cuitCuil: textSchema("CUIT/CUIL", 32).optional(),
  email: z.email({ error: "Origin email must be valid." }),
  floor: textSchema("Floor", 40).optional(),
  number: textSchema("Street number", 32),
  phone: phoneSchema,
  province: nameSchema("Province"),
  reference: textSchema("Reference", 200).optional(),
  postalCode: postalCodeSchema,
  senderName: nameSchema("Sender name"),
  street: textSchema("Street", 200),
}).strict();

export const weightBandSchema = z.object({
  cost: nonNegativeMoneySchema,
  id: identifierSchema,
  maxGrams: nonNegativeIntegerSchema.nullable(),
  minGrams: nonNegativeIntegerSchema,
}).strict();

export type WeightBandInput = z.output<typeof weightBandSchema>;

export function hasWeightBandOverlap(ranges: readonly Pick<WeightBandInput, "maxGrams" | "minGrams">[]): boolean {
  const sorted = [...ranges].sort((left, right) => left.minGrams - right.minGrams);

  return sorted.some((range, index) => {
    const next = sorted[index + 1];
    if (!next) return false;

    return range.maxGrams === null || range.maxGrams > next.minGrams;
  });
}

function fixedWeightBandIssue(range: WeightBandInput, expected: (typeof FIXED_WEIGHT_BANDS)[number]): string | undefined {
  if (range.id !== expected.id) return `Weight band ${expected.id} has an immutable identifier.`;
  if (range.minGrams !== expected.minGrams) return `Weight band ${expected.id} has an immutable minimum boundary.`;
  if (range.maxGrams !== expected.maxGrams) return `Weight band ${expected.id} has an immutable maximum boundary.`;

  return undefined;
}

export const shippingProviderUpdateSchema = z.object({
  enabledModalities: z.array(z.enum(shippingModalityValues))
    .refine((modalities) => new Set(modalities).size === modalities.length, { error: "Shipping modalities must not repeat." }),
  freeShippingThreshold: positiveMoneySchema.optional(),
  origin: providerOriginSchema.optional(),
  status: z.enum(shippingProviderStatusValues),
  weightRanges: z.array(weightBandSchema).length(FIXED_WEIGHT_BANDS.length, { error: "All fixed weight bands are required." }),
}).strict().superRefine((input, context) => {
  if (input.status !== SHIPPING_PROVIDER_STATUS.NOT_CONFIGURED && !input.origin) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A configured provider requires a complete origin.", path: ["origin"] });
  }

  if (input.status === SHIPPING_PROVIDER_STATUS.ACTIVE && input.enabledModalities.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "An active provider requires at least one modality.", path: ["enabledModalities"] });
  }

  input.weightRanges.forEach((range, index) => {
    const expected = FIXED_WEIGHT_BANDS[index];
    if (!expected) return;

    if (range.maxGrams !== null && range.maxGrams <= range.minGrams) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "The maximum boundary must exceed the minimum boundary.", path: ["weightRanges", index, "maxGrams"] });
    }

    const issue = fixedWeightBandIssue(range, expected);
    if (issue) context.addIssue({ code: z.ZodIssueCode.custom, message: issue, path: ["weightRanges", index] });
  });

  if (hasWeightBandOverlap(input.weightRanges)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Weight bands must not overlap.", path: ["weightRanges"] });
  }
});

export const shippingProviderSchema = z.object({
  id: z.enum(SHIPPING_PROVIDER_IDS),
  name: nameSchema("Provider name"),
  ...shippingProviderUpdateSchema.shape,
}).strict();

const spanishDayToCanonical: Readonly<Record<string, string>> = {
  domingo: PICKUP_WEEK_DAY.SUNDAY,
  jueves: PICKUP_WEEK_DAY.THURSDAY,
  lunes: PICKUP_WEEK_DAY.MONDAY,
  martes: PICKUP_WEEK_DAY.TUESDAY,
  miércoles: PICKUP_WEEK_DAY.WEDNESDAY,
  miercoles: PICKUP_WEEK_DAY.WEDNESDAY,
  sábado: PICKUP_WEEK_DAY.SATURDAY,
  sabado: PICKUP_WEEK_DAY.SATURDAY,
  viernes: PICKUP_WEEK_DAY.FRIDAY,
};

export function normalizePickupDay(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();

  return spanishDayToCanonical[normalized] ?? normalized;
}

const pickupDaySchema = z.string({ error: "Day must be a string." })
  .transform(normalizePickupDay)
  .pipe(z.enum(pickupWeekDayValues));

const pickupAddressSchema = z.object({
  city: nameSchema("City"),
  number: textSchema("Street number", 32),
  postalCode: postalCodeSchema,
  province: nameSchema("Province"),
  street: textSchema("Street", 200),
}).strict();

const pickupScheduleSchema = z.object({
  day: pickupDaySchema,
  from: timeSchema,
  id: identifierSchema.optional(),
  to: timeSchema,
}).strict();

export function findScheduleOverlap(ranges: readonly Pick<z.output<typeof pickupScheduleSchema>, "day" | "from" | "to">[]): number | undefined {
  const byDay = new Map<string, Array<{ from: string; index: number; to: string }>>();

  ranges.forEach((range, index) => {
    const dayRanges = byDay.get(range.day) ?? [];
    dayRanges.push({ from: range.from, index, to: range.to });
    byDay.set(range.day, dayRanges);
  });

  for (const dayRanges of byDay.values()) {
    const sorted = [...dayRanges].sort((left, right) => left.from.localeCompare(right.from));
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const current = sorted[index];
      const next = sorted[index + 1];
      if (current && next && current.to > next.from) return next.index;
    }
  }

  return undefined;
}

export const pickupPointUpdateSchema = z.object({
  address: pickupAddressSchema.optional(),
  contactEmail: z.email({ error: "Contact email must be valid." }).optional(),
  contactName: nameSchema("Contact name").optional(),
  contactPhone: phoneSchema.optional(),
  costType: z.enum(pickupCostTypeValues),
  coverageType: z.enum(pickupCoverageTypeValues),
  fixedCost: positiveMoneySchema.optional(),
  isMain: z.boolean(),
  name: nameSchema("Pickup point name"),
  preparationHours: positiveIntegerSchema.max(720, { error: "Preparation time is too long." }),
  provinces: z.array(textSchema("Province", 120))
    .refine((provinces) => new Set(provinces).size === provinces.length, { error: "Provinces must not repeat." }),
  schedule: z.array(pickupScheduleSchema).default([]),
  status: z.enum(pickupPointStatusValues),
}).strict().superRefine((input, context) => {
  const requiresConfiguration = input.status !== PICKUP_POINT_STATUS.NOT_CONFIGURED;

  if (requiresConfiguration && !input.address) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A configured pickup point requires a complete address.", path: ["address"] });
  }

  if (requiresConfiguration && input.schedule.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A configured pickup point requires at least one schedule range.", path: ["schedule"] });
  }

  input.schedule.forEach((range, index) => {
    if (range.to <= range.from) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Closing time must be later than opening time.", path: ["schedule", index, "to"] });
    }
  });

  const overlapIndex = findScheduleOverlap(input.schedule);
  if (overlapIndex !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup schedule ranges must not overlap on the same day.", path: ["schedule", overlapIndex, "from"] });
  }

  if (input.costType === PICKUP_COST_TYPE.FIXED && input.fixedCost === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Fixed cost is required for a fixed pickup cost.", path: ["fixedCost"] });
  }

  if (input.costType === PICKUP_COST_TYPE.FREE && input.fixedCost !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Free pickup points must not include a fixed cost.", path: ["fixedCost"] });
  }

  if (input.coverageType === PICKUP_COVERAGE_TYPE.PROVINCES && input.provinces.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "At least one province is required for specific coverage.", path: ["provinces"] });
  }

  if (input.coverageType === PICKUP_COVERAGE_TYPE.ALL && input.provinces.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "All-country coverage must not include specific provinces.", path: ["provinces"] });
  }
});

export const pickupPointSchema = z.object({
  id: identifierSchema,
  ...pickupPointUpdateSchema.shape,
}).strict();

export const shippingProviderRequestSchema = shippingProviderUpdateSchema;
export const pickupPointRequestSchema = pickupPointUpdateSchema;

export type PickupPointUpdateInput = z.output<typeof pickupPointUpdateSchema>;
export type ShippingProviderUpdateInput = z.output<typeof shippingProviderUpdateSchema>;

export function isSupportedShippingZoneId(value: string): boolean {
  return ARGENTINE_SHIPPING_ZONE_IDS.includes(value);
}
