import { z } from "zod";

export const STATISTICS_PERIOD = {
  TODAY: "today",
  CURRENT_WEEK: "current-week",
  LAST_30_DAYS: "last-30-days",
  LAST_90_DAYS: "last-90-days",
  LAST_12_MONTHS: "last-12-months",
  ALL_TIME: "all-time",
  CUSTOM: "custom",
} as const;
export type StatisticsPeriod = (typeof STATISTICS_PERIOD)[keyof typeof STATISTICS_PERIOD];

export const STATISTICS_INTERVAL = { DAY: "day", WEEK: "week", MONTH: "month" } as const;
export type StatisticsInterval = (typeof STATISTICS_INTERVAL)[keyof typeof STATISTICS_INTERVAL];

export const STATISTICS_TREND = { UP: "up", DOWN: "down", FLAT: "flat" } as const;
export type StatisticsTrend = (typeof STATISTICS_TREND)[keyof typeof STATISTICS_TREND];

const periodValues = Object.values(STATISTICS_PERIOD) as [StatisticsPeriod, ...StatisticsPeriod[]];
const intervalValues = Object.values(STATISTICS_INTERVAL) as [StatisticsInterval, ...StatisticsInterval[]];
const trendValues = Object.values(STATISTICS_TREND) as [StatisticsTrend, ...StatisticsTrend[]];

export const StatisticsPeriodSchema = z.enum(periodValues);
export const StatisticsIntervalSchema = z.enum(intervalValues);
export const StatisticsTrendSchema = z.enum(trendValues);

const isoDateSchema = z.iso.date();
const isoDateTimeSchema = z.iso.datetime({ offset: true });
const nonNegativeNumberSchema = z.number().finite().nonnegative();
const countSchema = z.number().int().nonnegative();

export const StatisticsQuerySchema = z.object({
  period: StatisticsPeriodSchema.default(STATISTICS_PERIOD.CURRENT_WEEK),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  limit: z.coerce.number().int().positive().optional(),
  interval: StatisticsIntervalSchema.default(STATISTICS_INTERVAL.DAY),
}).strict().superRefine((query, context) => {
  if (query.period === STATISTICS_PERIOD.CUSTOM && !query.from) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "from is required for custom periods.", path: ["from"] });
  }
  if (query.period === STATISTICS_PERIOD.CUSTOM && !query.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "to is required for custom periods.", path: ["to"] });
  }
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before or equal to to.", path: ["from"] });
  }
});
export type StatisticsQuery = z.output<typeof StatisticsQuerySchema>;

export const StatisticsWindowSchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
}).strict().superRefine((window, context) => {
  if (window.from > window.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "window.from must be before or equal to window.to.", path: ["from"] });
  }
});

export const StatisticsMetadataSchema = z.object({
  period: StatisticsPeriodSchema,
  window: StatisticsWindowSchema,
  comparisonWindow: StatisticsWindowSchema,
}).strict();

export const StatisticsMetricSchema = z.object({
  current: nonNegativeNumberSchema,
  previous: nonNegativeNumberSchema,
  variationPct: z.number().finite(),
  trend: StatisticsTrendSchema,
}).strict();
const statisticsMetricsSchema = z.record(z.string().min(1), StatisticsMetricSchema);

const paymentStatusSchema = z.object({ status: z.string().trim().min(1), count: countSchema }).strict();
const paymentMethodSchema = z.object({ method: z.string().trim().min(1), revenue: nonNegativeNumberSchema }).strict();
const shippingSchema = z.object({ type: z.string().trim().min(1), orders: countSchema }).strict();
const provinceSchema = z.object({ province: z.string().trim().min(1), orders: countSchema, revenue: nonNegativeNumberSchema }).strict();
const productSchema = z.object({
  id: z.string().trim().min(1), name: z.string().trim().min(1), category: z.string().trim().min(1),
  unitsSold: countSchema, revenue: nonNegativeNumberSchema, stockAvailable: countSchema, stockReserved: countSchema,
}).strict();
const productSeriesPointSchema = z.object({ bucket: isoDateTimeSchema, unitsSold: countSchema, revenue: nonNegativeNumberSchema }).strict();
const inventoryAlertSchema = z.object({
  type: z.string().trim().min(1),
  items: z.array(z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1), stockAvailable: countSchema, stockReserved: countSchema }).strict()),
}).strict();
const customerSchema = z.object({
  id: z.string().trim().min(1), name: z.string().trim().min(1), email: z.email(), ordersCount: countSchema, totalSpent: nonNegativeNumberSchema,
}).strict();
const couponSchema = z.object({ code: z.string().trim().min(1), redemptions: countSchema, revenue: nonNegativeNumberSchema }).strict();
const couponComparisonSchema = z.object({ orders: countSchema, revenue: nonNegativeNumberSchema }).strict();

export const StatisticsOverviewSchema = z.object({ metadata: StatisticsMetadataSchema, metrics: statisticsMetricsSchema }).strict();
export const StatisticsSalesSchema = z.object({
  metadata: StatisticsMetadataSchema, metrics: statisticsMetricsSchema,
  paymentStatuses: z.array(paymentStatusSchema), paymentMethods: z.array(paymentMethodSchema),
  shipping: z.array(shippingSchema), provinces: z.array(provinceSchema),
}).strict();
export const StatisticsProductsSchema = z.object({
  metadata: StatisticsMetadataSchema, metrics: statisticsMetricsSchema,
  topProducts: z.array(productSchema), series: z.array(productSeriesPointSchema), inventoryAlerts: z.array(inventoryAlertSchema),
}).strict();
export const StatisticsCustomersSchema = z.object({ metadata: StatisticsMetadataSchema, metrics: statisticsMetricsSchema, topCustomers: z.array(customerSchema) }).strict();
export const StatisticsCouponsSchema = z.object({
  metadata: StatisticsMetadataSchema, metrics: statisticsMetricsSchema, topCoupons: z.array(couponSchema),
  comparison: z.object({ withCoupon: couponComparisonSchema, withoutCoupon: couponComparisonSchema }).strict(),
}).strict();

const statisticsResponseSchema = <T extends z.ZodType>(data: T) => z.object({ ok: z.literal(true), data }).strict();
export const StatisticsOverviewResponseSchema = statisticsResponseSchema(StatisticsOverviewSchema);
export const StatisticsSalesResponseSchema = statisticsResponseSchema(StatisticsSalesSchema);
export const StatisticsProductsResponseSchema = statisticsResponseSchema(StatisticsProductsSchema);
export const StatisticsCustomersResponseSchema = statisticsResponseSchema(StatisticsCustomersSchema);
export const StatisticsCouponsResponseSchema = statisticsResponseSchema(StatisticsCouponsSchema);

export type StatisticsMetadata = z.output<typeof StatisticsMetadataSchema>;
export type StatisticsMetric = z.output<typeof StatisticsMetricSchema>;
export type StatisticsOverview = z.output<typeof StatisticsOverviewSchema>;
export type StatisticsSales = z.output<typeof StatisticsSalesSchema>;
export type StatisticsProducts = z.output<typeof StatisticsProductsSchema>;
export type StatisticsCustomers = z.output<typeof StatisticsCustomersSchema>;
export type StatisticsCoupons = z.output<typeof StatisticsCouponsSchema>;
export type StatisticsOverviewResponse = z.output<typeof StatisticsOverviewResponseSchema>;
export type StatisticsSalesResponse = z.output<typeof StatisticsSalesResponseSchema>;
export type StatisticsProductsResponse = z.output<typeof StatisticsProductsResponseSchema>;
export type StatisticsCustomersResponse = z.output<typeof StatisticsCustomersResponseSchema>;
export type StatisticsCouponsResponse = z.output<typeof StatisticsCouponsResponseSchema>;

export const statisticsQuerySchema = StatisticsQuerySchema;
export const statisticsOverviewResponseSchema = StatisticsOverviewResponseSchema;
export const statisticsSalesResponseSchema = StatisticsSalesResponseSchema;
export const statisticsProductsResponseSchema = StatisticsProductsResponseSchema;
export const statisticsCustomersResponseSchema = StatisticsCustomersResponseSchema;
export const statisticsCouponsResponseSchema = StatisticsCouponsResponseSchema;
