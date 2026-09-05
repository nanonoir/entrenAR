import type {
  AbandonedCartDetailResult,
  AbandonedCartListQuery,
  AbandonedCartListResult,
  AbandonedCartsDataSource,
  RecoveryActionResult,
  RecoveryConfig,
  RecoveryEmailTemplate,
} from "./types";

export interface AbandonedCartsRepository {
  readonly source: AbandonedCartsDataSource;
  list(query?: AbandonedCartListQuery): Promise<AbandonedCartListResult>;
  getById(id: string): Promise<AbandonedCartDetailResult>;
  sendRecoveryEmail(id: string, note?: string): Promise<RecoveryActionResult>;
  markManualRecovery(id: string, notes?: string): Promise<RecoveryActionResult>;
  convertCart(id: string): Promise<RecoveryActionResult>;
  discardCart(id: string, reason: string): Promise<RecoveryActionResult>;
  getConfig(): Promise<RecoveryConfig>;
  updateConfig(config: Partial<RecoveryConfig>): Promise<RecoveryConfig>;
  getTemplate(): Promise<RecoveryEmailTemplate>;
  updateTemplate(template: Partial<RecoveryEmailTemplate>): Promise<RecoveryEmailTemplate>;
}
