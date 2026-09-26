import { Injectable } from "@nestjs/common";

import type { ObjectExistencePort } from "../ports/object-existence.port";

type FetchLike = (input: string, init?: { method?: string }) => Promise<{ ok: boolean; status: number }>;

@Injectable()
export class R2ObjectExistenceAdapter implements ObjectExistencePort {
  private readonly baseUrl = process.env["ASSETS_BASE_URL"]?.replace(/\/$/, "");
  private readonly fetchObject: FetchLike = fetch as unknown as FetchLike;
  private readonly concurrency = 8;

  async exists(storageKey: string): Promise<boolean> {
    if (!this.baseUrl) throw new Error("ASSETS_BASE_URL is required for R2 object preflight.");
    const response = await this.fetchObject(`${this.baseUrl}/${storageKey}`, { method: "HEAD" });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`R2 object preflight failed with status ${response.status}.`);
    return true;
  }

  async existsMany(storageKeys: readonly string[]): Promise<ReadonlyMap<string, boolean>> {
    const results = new Map<string, boolean>();
    let cursor = 0;
    const worker = async () => {
      while (cursor < storageKeys.length) {
        const index = cursor++;
        const key = storageKeys[index]!;
        results.set(key, await this.exists(key));
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, storageKeys.length) }, worker));
    return results;
  }
}
