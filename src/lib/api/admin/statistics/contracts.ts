import { z } from "zod";

import {
  STATISTICS_INTERVAL,
  STATISTICS_PERIOD,
  STATISTICS_TREND,
  type StatisticsApiIssue,
  type StatisticsInterval,
  type StatisticsPeriod,
  type StatisticsTrend,
} from "./types";

const periodValues = Object.values(STATISTICS_PERIOD) as [StatisticsPeriod, ...StatisticsPeriod[]];
const intervalValues = Object.values(STATISTICS_INTERVAL) as [StatisticsInterval, ...StatisticsInterval[]];
const trendValues = Object.values(STATISTICS_TREND) as [StatisticsTrend, ...StatisticsTrend[]];
const periodSchema = z.enum(periodValues);
const intervalSchema = z.enum(intervalValues);
const dateSchema = z.iso.date();
const dateTimeSchema = z.iso.datetime({ offset: true });
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const countSchema = z.number().int().nonnegative();
const identifierSchema = z.string().trim().min(1);

export const statisticsPeriodSchema = periodSchema;
export const statisticsIntervalSchema = intervalSchema;
export const statisticsTrendSchema = z.enum(trendValues);

export const statisticsQuerySchema = z.object({
  period: periodSchema.default(STATISTICS_PERIOD.CURRENT_WEEK),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  limit: z.coerce.number().int().positive().optional(),
  interval: intervalSchema.default(STATISTICS_INTERVAL.DAY),
}).strict().superRefine((query, context) => {
  if (query.period === STATISTICS_PERIOD.CUSTOM && !query.from) {
    context.addIssue({ code: "custom", message: "from is required for custom periods.", path: ["from"] });
  }
  if (query.period === STATISTICS_PERIOD.CUSTOM && !query.to) {
    context.addIssue({ code: "custom", message: "to is required for custom periods.", path: ["to"] });
  }
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({ code: "custom", message: "from must be before or equal to to.", path: ["from"] });
  }
});

const metadataSchema = z.object({
  period: periodSchema,
  window: z.object({ from: dateTimeSchema, to: dateTimeSchema }).strict(),
  comparisonWindow: z.object({ from: dateTimeSchema, to: dateTimeSchema }).strict(),
}).strict();
const overviewBehaviorSchema = z.object({
  createdCarts: countSchema.optional(),
  paidOrders: countSchema.optional(),
}).strict();
const metricSchema = z.object({
  current: nonNegativeNumberSchema,
  previous: nonNegativeNumberSchema,
  variationPct: z.number().finite(),
  trend: z.enum(trendValues),
}).strict();
const metricsSchema = z.record(z.string().min(1), metricSchema);
const overviewSchema = z.object({ behavior: overviewBehaviorSchema.optional(), metadata: metadataSchema, metrics: metricsSchema }).strict();
const paymentStatusSchema = z.object({ status: z.string().trim().min(1), count: countSchema }).strict();
const paymentMethodSchema = z.object({ method: z.string().trim().min(1), revenue: nonNegativeNumberSchema }).strict();
const shippingSchema = z.object({ type: z.string().trim().min(1), orders: countSchema }).strict();
const provinceSchema = z.object({ province: z.string().trim().min(1), orders: countSchema, revenue: nonNegativeNumberSchema }).strict();
const productSchema = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unitsSold: countSchema,
  revenue: nonNegativeNumberSchema,
  stockAvailable: countSchema,
  stockReserved: countSchema,
}).strict();
const productSeriesSchema = z.object({ bucket: dateTimeSchema, unitsSold: countSchema, revenue: nonNegativeNumberSchema }).strict();
const inventoryAlertSchema = z.object({
  type: z.string().trim().min(1),
  items: z.array(z.object({ id: identifierSchema, name: z.string().trim().min(1), stockAvailable: countSchema, stockReserved: countSchema }).strict()),
}).strict();
const customerSchema = z.object({ id: identifierSchema, name: z.string().trim().min(1), email: z.email(), ordersCount: countSchema, totalSpent: nonNegativeNumberSchema }).strict();
const couponSchema = z.object({ code: z.string().trim().min(1), redemptions: countSchema, revenue: nonNegativeNumberSchema }).strict();
const comparisonSchema = z.object({ orders: countSchema, revenue: nonNegativeNumberSchema }).strict();
const responseSchema = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data }).strict();

export const overviewResponseSchema = responseSchema(overviewSchema);
export const salesResponseSchema = responseSchema(z.object({
  metadata: metadataSchema,
  metrics: metricsSchema,
  paymentStatuses: z.array(paymentStatusSchema),
  paymentMethods: z.array(paymentMethodSchema),
  shipping: z.array(shippingSchema),
  provinces: z.array(provinceSchema),
}).strict());
export const productsResponseSchema = responseSchema(z.object({
  metadata: metadataSchema,
  metrics: metricsSchema,
  topProducts: z.array(productSchema),
  series: z.array(productSeriesSchema),
  inventoryAlerts: z.array(inventoryAlertSchema),
}).strict());
export const customersResponseSchema = responseSchema(z.object({
  metadata: metadataSchema,
  metrics: metricsSchema,
  topCustomers: z.array(customerSchema),
}).strict());
export const couponsResponseSchema = responseSchema(z.object({
  metadata: metadataSchema,
  metrics: metricsSchema,
  topCoupons: z.array(couponSchema),
  comparison: z.object({ withCoupon: comparisonSchema, withoutCoupon: comparisonSchema }).strict(),
}).strict());

export type StatisticsQueryContract = z.output<typeof statisticsQuerySchema>;
export type StatisticsOverviewResponseContract = z.output<typeof overviewResponseSchema>;
export type StatisticsSalesResponseContract = z.output<typeof salesResponseSchema>;
export type StatisticsProductsResponseContract = z.output<typeof productsResponseSchema>;
export type StatisticsCustomersResponseContract = z.output<typeof customersResponseSchema>;
export type StatisticsCouponsResponseContract = z.output<typeof couponsResponseSchema>;

export function toValidationIssues(error: z.ZodError): StatisticsApiIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    field: issue.path.map(String).join(".") || "request",
    message: issue.message,
  }));
}
