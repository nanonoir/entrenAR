import { listAll, assertProductsPrefix, verifyExactSet, type ObjectMetadata, type R2StoragePort } from "./r2-storage";

describe("guarded R2 helpers", () => {
  it("follows continuation tokens and rejects escaped prefixes", async () => {
    const calls: Array<string | undefined> = [];
    const storage: R2StoragePort = { list: async (_prefix, cursor) => { calls.push(cursor); return cursor ? { objects: [{ key: "products/b/1.webp", size: 1 }] } : { objects: [{ key: "products/a/1.webp", size: 1 }], nextCursor: "next" }; }, delete: async () => undefined, put: async () => undefined, head: async () => null };
    expect((await listAll(storage)).map((item) => item.key)).toEqual(["products/a/1.webp", "products/b/1.webp"]);
    expect(calls).toEqual([undefined, "next"]);
    expect(() => assertProductsPrefix("other/")).toThrow();
  });

  it("requires authenticated SHA metadata and checks public availability", async () => {
    const expected: ObjectMetadata[] = [{ key: "products/a/1.webp", size: 4, sha256: "a".repeat(64) }];
    const storage: R2StoragePort = {
      list: async () => ({ objects: [{ key: expected[0]!.key, size: 4 }] }),
      delete: async () => undefined,
      put: async () => undefined,
      head: async (_key, publicRequest) => publicRequest ? { key: expected[0]!.key, size: 4 } : { ...expected[0]! },
    };
    await expect(verifyExactSet(storage, expected)).resolves.toBeUndefined();
    await expect(verifyExactSet({ ...storage, head: async (_key, publicRequest) => publicRequest ? null : { ...expected[0]! } }, expected)).rejects.toThrow("public object unavailable");
    await expect(verifyExactSet(storage, [{ key: expected[0]!.key, size: 4 }])).rejects.toThrow("integrity metadata is incomplete");
    await expect(verifyExactSet({ ...storage, head: async () => ({ key: expected[0]!.key, size: 5, sha256: expected[0]!.sha256 }) }, expected)).rejects.toThrow("integrity mismatch");
    await expect(verifyExactSet({ ...storage, list: async () => ({ objects: [] }) }, expected)).rejects.toThrow("exact set mismatch");
    await expect(verifyExactSet({ ...storage, list: async () => ({ objects: [...expected, { key: "products/extra/1.webp", size: 4 }] }) }, expected)).rejects.toThrow("exact set mismatch");
    const rejectedPublicHead = verifyExactSet({ ...storage, head: async (_key, publicRequest) => { if (publicRequest) throw new Error("private URL with-secret"); return { ...expected[0]! }; } }, expected);
    await expect(rejectedPublicHead).rejects.toThrow("R2 public object unavailable: public HEAD failed.");
    await expect(rejectedPublicHead).rejects.not.toThrow(/url|secret/i);
    await expect(verifyExactSet({ ...storage, head: async (_key, publicRequest) => { if (!publicRequest) throw new Error("authenticated failure"); return { key: expected[0]!.key, size: 4 }; } }, expected)).rejects.toThrow("authenticated failure");
  });

  it("verifies large inventories with bounded concurrent HEAD requests", async () => {
    const expected = Array.from({ length: 40 }, (_, index) => ({ key: `products/item-${index}/1.webp`, size: 4, sha256: `${index}`.padStart(64, "a") }));
    let active = 0;
    let maximumActive = 0;
    let headCalls = 0;
    const storage: R2StoragePort = {
      list: async () => ({ objects: expected }),
      delete: async () => undefined,
      put: async () => undefined,
      head: async (key, publicRequest) => {
        active += 1;
        headCalls += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
        return { key, size: 4, ...(publicRequest ? {} : { sha256: expected.find((item) => item.key === key)!.sha256 }) };
      },
    };

    await expect(verifyExactSet(storage, expected)).resolves.toBeUndefined();
    expect(headCalls).toBe(expected.length * 2);
    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(8);
  });
});
