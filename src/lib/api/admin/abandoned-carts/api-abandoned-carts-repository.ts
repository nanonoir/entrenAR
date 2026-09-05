import { z } from "zod";

import { AbandonedCartsApiError, FetchAbandonedCartsApiClient, type AbandonedCartsApiClient } from "./client";
import { abandonedCartsApiConfig } from "./abandoned-carts-api-config";
import {
  abandonedCartActionResponseSchema,
  abandonedCartDetailResponseSchema,
  abandonedCartIdParamSchema,
  abandonedCartListQuerySchema,
  abandonedCartListResponseSchema,
  convertCartSchema,
  discardCartSchema,
  manualRecoverySchema,
  recoveryConfigPatchSchema,
  recoveryConfigSchema,
  recoveryTemplatePatchSchema,
  recoveryTemplateSchema,
  sendRecoveryEmailSchema,
  toValidationIssues,
} from "./contracts";
import { MockAbandonedCartsRepository } from "./mock-abandoned-carts-repository";
import type { AbandonedCartsRepository } from "./repository";
import type {
  AbandonedCartDetailResult,
  AbandonedCartListQuery,
  AbandonedCartListResult,
  RecoveryActionResult,
  RecoveryConfig,
  RecoveryEmailTemplate,
} from "./types";

export class ApiAbandonedCartsRepository implements AbandonedCartsRepository {
  readonly source = "api" as const;

  constructor(
    private readonly client: AbandonedCartsApiClient = new FetchAbandonedCartsApiClient(),
    private readonly fallback: AbandonedCartsRepository = new MockAbandonedCartsRepository(),
    private readonly fallbackToMock = abandonedCartsApiConfig.fallbackToMock,
  ) {}

  list(query: AbandonedCartListQuery = {}): Promise<AbandonedCartListResult> {
    const parsed = parse(abandonedCartListQuerySchema, query, "The abandoned-cart list query is invalid.");
    return this.recover(
      () => this.client.get<unknown>(withQuery(abandonedCartsApiConfig.endpoints.collection, parsed)).then((value) => response(abandonedCartListResponseSchema, value)),
      () => this.fallback.list(parsed),
    );
  }

  getById(id: string): Promise<AbandonedCartDetailResult> {
    const cartId = parse(abandonedCartIdParamSchema, { id }, "The abandoned-cart identifier is invalid.").id;
    return this.recover(
      () => this.client.get<unknown>(abandonedCartsApiConfig.endpoints.detail(cartId)).then((value) => response(abandonedCartDetailResponseSchema, value)),
      () => this.fallback.getById(cartId),
    );
  }

  sendRecoveryEmail(id: string, note?: string): Promise<RecoveryActionResult> {
    const cartId = this.validId(id);
    const payload = parse(sendRecoveryEmailSchema, note === undefined ? {} : { note }, "The recovery-email payload is invalid.");
    return this.recover(
      () => this.client.post<unknown>(abandonedCartsApiConfig.endpoints.email(cartId), payload).then((value) => response(abandonedCartActionResponseSchema, value)),
      () => this.fallback.sendRecoveryEmail(cartId, payload.note),
    );
  }

  markManualRecovery(id: string, notes?: string): Promise<RecoveryActionResult> {
    const cartId = this.validId(id);
    const payload = parse(manualRecoverySchema, notes === undefined ? {} : { note: notes }, "The manual-recovery payload is invalid.");
    return this.recover(
      () => this.client.post<unknown>(abandonedCartsApiConfig.endpoints.manual(cartId), payload).then((value) => response(abandonedCartActionResponseSchema, value)),
      () => this.fallback.markManualRecovery(cartId, payload.note),
    );
  }

  convertCart(id: string): Promise<RecoveryActionResult> {
    const cartId = this.validId(id);
    const payload = parse(convertCartSchema, {}, "The conversion payload is invalid.");
    return this.recover(
      () => this.client.post<unknown>(abandonedCartsApiConfig.endpoints.convert(cartId), payload).then((value) => response(abandonedCartActionResponseSchema, value)),
      () => this.fallback.convertCart(cartId),
    );
  }

  discardCart(id: string, reason: string): Promise<RecoveryActionResult> {
    const cartId = this.validId(id);
    const payload = parse(discardCartSchema, { reason }, "A discard reason is required.");
    return this.recover(
      () => this.client.post<unknown>(abandonedCartsApiConfig.endpoints.discard(cartId), payload).then((value) => response(abandonedCartActionResponseSchema, value)),
      () => this.fallback.discardCart(cartId, payload.reason),
    );
  }

  getConfig(): Promise<RecoveryConfig> {
    return this.recover(
      () => this.client.get<unknown>(abandonedCartsApiConfig.endpoints.config).then((value) => response(recoveryConfigSchema, value)),
      () => this.fallback.getConfig(),
    );
  }

  async updateConfig(config: Partial<RecoveryConfig>): Promise<RecoveryConfig> {
    const patch = parse(recoveryConfigPatchSchema, config, "The recovery configuration is invalid.");
    const complete = await this.completeConfig(patch);
    return this.recover(
      () => this.client.put<unknown>(abandonedCartsApiConfig.endpoints.config, complete).then((value) => response(recoveryConfigSchema, value)),
      () => this.fallback.updateConfig(patch),
    );
  }

  getTemplate(): Promise<RecoveryEmailTemplate> {
    return this.recover(
      () => this.client.get<unknown>(abandonedCartsApiConfig.endpoints.template).then((value) => response(recoveryTemplateSchema, value)),
      () => this.fallback.getTemplate(),
    );
  }

  async updateTemplate(template: Partial<RecoveryEmailTemplate>): Promise<RecoveryEmailTemplate> {
    const patch = parse(recoveryTemplatePatchSchema, template, "The recovery email template is invalid.");
    const complete = await this.completeTemplate(patch);
    return this.recover(
      () => this.client.put<unknown>(abandonedCartsApiConfig.endpoints.template, complete).then((value) => response(recoveryTemplateSchema, value)),
      () => this.fallback.updateTemplate(patch),
    );
  }

  private validId(id: string): string {
    return parse(abandonedCartIdParamSchema, { id }, "The abandoned-cart identifier is invalid.").id;
  }

  private async completeConfig(patch: Partial<RecoveryConfig>): Promise<RecoveryConfig> {
    if (patch.isActive !== undefined && patch.timing !== undefined) return patch as RecoveryConfig;
    return { ...(await this.getConfig()), ...patch };
  }

  private async completeTemplate(patch: Partial<RecoveryEmailTemplate>): Promise<RecoveryEmailTemplate> {
    if (patch.htmlBody !== undefined && patch.plainTextBody !== undefined && patch.subject !== undefined) return patch as RecoveryEmailTemplate;
    return { ...(await this.getTemplate()), ...patch };
  }

  private async recover<T>(operation: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.fallbackToMock && isFallbackEligible(error)) return fallback();
      throw error;
    }
  }
}

export const getAdminAbandonedCartsRepository = (client?: AbandonedCartsApiClient): ApiAbandonedCartsRepository => new ApiAbandonedCartsRepository(client);

function response<T>(schema: z.ZodType<T>, value: unknown): T {
  const unwrapped = isRecord(value) && value.ok === true && "data" in value ? value.data : value;
  if (isRecord(unwrapped) && unwrapped.ok === false) {
    throw new AbandonedCartsApiError({ code: String(unwrapped.code ?? "ABANDONED_CARTS_API_ERROR"), message: String(unwrapped.message ?? "The abandoned-carts request failed."), status: 400, issues: readIssues(unwrapped.issues) });
  }
  const parsed = schema.safeParse(unwrapped);
  if (parsed.success) return parsed.data;
  throw new AbandonedCartsApiError({ code: "ABANDONED_CARTS_API_INVALID_RESPONSE", issues: toValidationIssues(parsed.error), message: "The abandoned-carts API returned an invalid response.", status: 502 });
}

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new AbandonedCartsApiError({ code: "VALIDATION_ERROR", issues: toValidationIssues(parsed.error), message, status: 400 });
}

function withQuery(path: string, query: AbandonedCartListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function isFallbackEligible(error: unknown): boolean {
  if (error instanceof AbandonedCartsApiError) return error.status >= 500;
  return error instanceof TypeError || (error instanceof Error && /fetch|network|offline|unavailable/i.test(error.message));
}

function readIssues(value: unknown): AbandonedCartsApiError["issues"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    return [{ code: String(item.code ?? "INVALID_FIELD"), field: String(item.field ?? "request"), message: String(item.message ?? "Invalid value.") }];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
