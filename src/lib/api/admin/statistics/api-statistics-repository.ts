import { z } from "zod";

import { statisticsApiConfig } from "./statistics-api-config";
import { FetchStatisticsApiClient, StatisticsApiClient } from "./client";
import {
  couponsResponseSchema,
  customersResponseSchema,
  overviewResponseSchema,
  productsResponseSchema,
  salesResponseSchema,
  statisticsQuerySchema,
  toValidationIssues,
} from "./contracts";
import { MockStatisticsRepository } from "./mock-statistics-repository";
import { STATISTICS_DATA_SOURCE, type StatisticsRepository } from "./repository";
import { StatisticsApiError, type StatisticsQuery } from "./types";

export class ApiStatisticsRepository implements StatisticsRepository {
  readonly source = STATISTICS_DATA_SOURCE.API;

  constructor(
    private readonly client: StatisticsApiClient = new FetchStatisticsApiClient(),
    private readonly fallback: StatisticsRepository = new MockStatisticsRepository(),
    private readonly fallbackToMock = statisticsApiConfig.fallbackToMock,
  ) {}

  getOverview(query: StatisticsQuery = {}) { const parsed = parseQuery(query); return this.recover(() => this.client.getOverview(parsed).then((value) => responseData(overviewResponseSchema, value)), () => this.fallback.getOverview(parsed)); }
  getSales(query: StatisticsQuery = {}) { const parsed = parseQuery(query); return this.recover(() => this.client.getSales(parsed).then((value) => responseData(salesResponseSchema, value)), () => this.fallback.getSales(parsed)); }
  getProducts(query: StatisticsQuery = {}) { const parsed = parseQuery(query); return this.recover(() => this.client.getProducts(parsed).then((value) => responseData(productsResponseSchema, value)), () => this.fallback.getProducts(parsed)); }
  getCustomers(query: StatisticsQuery = {}) { const parsed = parseQuery(query); return this.recover(() => this.client.getCustomers(parsed).then((value) => responseData(customersResponseSchema, value)), () => this.fallback.getCustomers(parsed)); }
  getCoupons(query: StatisticsQuery = {}) { const parsed = parseQuery(query); return this.recover(() => this.client.getCoupons(parsed).then((value) => responseData(couponsResponseSchema, value)), () => this.fallback.getCoupons(parsed)); }

  private async recover<T>(operation: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.fallbackToMock && isFallbackEligible(error)) return fallback();
      throw error;
    }
  }
}

export const getAdminStatisticsRepository = (client?: StatisticsApiClient): ApiStatisticsRepository => new ApiStatisticsRepository(client);

function parseQuery(query: StatisticsQuery) {
  const result = statisticsQuerySchema.safeParse(query);
  if (result.success) return result.data;
  throw new StatisticsApiError({ code: "VALIDATION_ERROR", issues: toValidationIssues(result.error), message: "The statistics query is invalid.", status: 400 });
}

function responseData<T>(schema: z.ZodType<{ ok: true; data: T }>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data.data;
  throw new StatisticsApiError({ code: "STATISTICS_API_INVALID_RESPONSE", issues: toValidationIssues(result.error), message: "The statistics API returned an invalid response.", status: 502 });
}

function isFallbackEligible(error: unknown): boolean {
  if (error instanceof StatisticsApiError) return error.status >= 500;
  return true;
}
