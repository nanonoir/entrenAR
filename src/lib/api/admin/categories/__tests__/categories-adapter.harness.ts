import { setAdminAccessToken, clearAdminAccessToken } from "@/lib/api/admin/auth/admin-access-token";
import { ApiAdminCategoriesRepository } from "../api-categories.repository";
import { MockAdminCategoriesRepository } from "../mock-categories.repository";
import type { AdminCategoriesRepository } from "../repository";
import { AdminCategoriesApiError, describeCategoryError, toCategoryUpdateInput, type AdminCategoryInput } from "../types";
import { createAdminCategoriesStore } from "@/stores/admin-categories-store";

type ServerCategory = { description?: string; id: string; name: string; parentId?: string; slug: string; visibility: "hidden" | "visible" };

async function run(): Promise<void> {
  setAdminAccessToken("harness-token");
  try {
    await runApiScenario();
    await runAuthScenario();
    await runStoreScenario();
    await runMockScenario();
  } finally {
    clearAdminAccessToken();
  }
  console.log("admin categories harness: authenticated API mutations, canonical reload cascade, error mapping, pending/no-false-success, stale init guard, and mock parity passed");
}

async function runApiScenario(): Promise<void> {
  const server = createServer([
    { id: "root", name: "Root", slug: "root", visibility: "visible" },
    { id: "child", name: "Child", parentId: "root", slug: "child", visibility: "visible" },
    { id: "used", name: "Used", slug: "used", visibility: "visible" },
  ]);
  const repository = new ApiAdminCategoriesRepository(server.fetch, "http://api.test/api/v1");

  const listed = await repository.list();
  assert(listed.map((category) => category.id).join() === "root,child,used" && listed[1]?.parentId === "root", "Admin category tree was not flattened.");
  assert(server.requests[0]?.authorization === "Bearer harness-token", "List did not send the admin Bearer token.");

  const created = await repository.create(form({ name: "Brand New", parentId: "root" }));
  assert(created.id === "srv-1" && created.slug === "brand-new" && created.parentId === "root", "Create did not return the server-issued identity and slug.");
  assert(server.last().method === "POST" && server.last().path === "/api/v1/admin/categories", "Create did not POST to the admin endpoint.");

  const updated = await repository.update("root", form({ name: "Root Renamed", description: "Hello" }));
  assert(updated.name === "Root Renamed" && updated.description === "Hello", "Update did not return the canonical category.");
  assert(server.last().method === "PUT" && !("parentId" in (server.last().body ?? {})), "Partial update must omit absent fields so the server preserves them.");

  // Omission preserves; explicit null (edit form blank) clears description and moves to the root.
  await repository.update("child", form({ name: "Child" }));
  const preserved = (await repository.list()).find((category) => category.id === "child");
  assert(preserved?.parentId === "root" && !("parentId" in (server.last().body ?? {})), "Omitted parentId did not preserve the hierarchy.");
  await repository.update("root", { name: "Root Renamed", visibility: "visible" });
  assert((await repository.list()).find((category) => category.id === "root")?.description === "Hello", "Omitted description was cleared.");
  await repository.update("child", toCategoryUpdateInput(form({ name: "Child" })));
  assert(server.last().body?.parentId === null && server.last().body?.description === null && !("slug" in (server.last().body ?? {})), "Edit form blanks must be sent as explicit nulls.");
  assert((await repository.list()).find((category) => category.id === "child")?.parentId === undefined, "Explicit null parentId did not move the category to the root.");
  await repository.update("root", toCategoryUpdateInput(form({ name: "Root Renamed" })));
  assert((await repository.list()).find((category) => category.id === "root")?.description === undefined, "Explicit null description was not cleared.");
  await repository.update("child", { name: "Child", visibility: "visible", parentId: "root" });

  await repository.setVisibility("root", "hidden");
  assert(server.last().path === "/api/v1/admin/categories/root/visibility" && JSON.stringify(server.last().body) === '{"visibility":"hidden"}', "Visibility used the wrong request.");
  const afterHide = await repository.list();
  assert(afterHide.filter((category) => ["root", "child", "srv-1"].includes(category.id)).every((category) => category.visibility === "hidden"), "Hidden cascade was not read back from the server.");

  await expectCode(repository.delete("used"), "CATEGORY_IN_USE", 409);
  await expectCode(repository.update("missing", form({ name: "Ghost" })), "NOT_FOUND", 404);
  await repository.delete("child");
  assert(!(await repository.list()).some((category) => category.id === "child"), "Delete was not persisted.");
  assert(describeCategoryError(new AdminCategoriesApiError({ code: "CATEGORY_IN_USE", message: "x", status: 409 })).includes("productos"), "In-use error wording is missing.");
}

async function runAuthScenario(): Promise<void> {
  const server = createServer([{ id: "root", name: "Root", slug: "root", visibility: "visible" }]);
  server.rejectAuth = true;
  const repository = new ApiAdminCategoriesRepository(server.fetch, "http://api.test/api/v1");
  const error = await repository.create(form({ name: "Nope" })).then(() => undefined, (cause: unknown) => cause);
  assert(error instanceof AdminCategoriesApiError && (error.status === 401 || error.status === 403), "Unauthorized create did not reject with an auth error.");
  assert(server.categories.length === 1, "Unauthorized create changed server data.");
  setAdminAccessToken("harness-token");
  const unavailable = new ApiAdminCategoriesRepository(async () => { throw new Error("offline"); }, "http://api.test/api/v1");
  await expectCode(unavailable.list(), "ADMIN_API_UNAVAILABLE", 503);
}

async function runStoreScenario(): Promise<void> {
  const server = createServer([
    { id: "root", name: "Root", slug: "root", visibility: "visible" },
    { id: "child", name: "Child", parentId: "root", slug: "child", visibility: "visible" },
  ]);
  const gate = deferred();
  server.gate = gate.promise;
  const repository = new ApiAdminCategoriesRepository(server.fetch, "http://api.test/api/v1");
  const store = createAdminCategoriesStore({ repository });
  store.getState().initializeCategories(await repository.list(), Date.now());

  // Pending: no state change and no false success until the server answers; second action rejected.
  const creating = store.getState().createCategory(form({ name: "Gated" }));
  await flush();
  assert(store.getState().pendingAction?.type === "create" && store.getState().categories.length === 2, "Create was applied before server confirmation.");
  const duplicate = await store.getState().deleteCategory("child").then(() => undefined, (cause: unknown) => cause);
  assert(duplicate instanceof Error && (duplicate as { code?: string }).code === "CATEGORY_MUTATION_IN_PROGRESS", "A second action ran while one was pending.");
  store.getState().initializeCategories([], Date.now());
  assert(store.getState().categories.length === 2, "Stale init overwrote the store during a pending mutation.");
  gate.resolve();
  const created = await creating;
  assert(created.id.startsWith("srv-") && store.getState().categories.some((category) => category.id === created.id) && store.getState().pendingAction === null, "Create was not confirmed and reloaded.");
  server.gate = undefined;

  // A boundary read that started before the last settled mutation is stale.
  const settledAt = store.getState().lastSettledAt;
  store.getState().initializeCategories([], settledAt - 10);
  assert(store.getState().categories.length === 3, "Pre-mutation boundary data overwrote the confirmed result.");

  // Cascade authority: toggling hides descendants as the server reports.
  await store.getState().toggleCategoryVisibility("root");
  const hidden = store.getState().categories;
  assert(hidden.find((category) => category.id === "root")?.visibility === "hidden" && hidden.find((category) => category.id === "child")?.visibility === "hidden", "Hide cascade was not reloaded from the server.");
  await store.getState().toggleCategoryVisibility("root");
  const shown = store.getState().categories;
  assert(shown.find((category) => category.id === "root")?.visibility === "visible" && shown.find((category) => category.id === "child")?.visibility === "hidden", "Show must not reveal descendants.");

  // Failures: no false success, state untouched, retry allowed.
  server.failNext = { code: "SLUG_CONFLICT", status: 409 };
  const before = JSON.stringify(store.getState().categories);
  const failure = await store.getState().updateCategory("root", form({ name: "Root", slug: "child" })).then(() => undefined, (cause: unknown) => cause);
  assert(failure instanceof Error && failure.message.includes("slug") && store.getState().error === failure.message, "Slug conflict was not surfaced.");
  assert(JSON.stringify(store.getState().categories) === before && store.getState().pendingAction === null, "A failed update changed state or stayed pending.");
  await store.getState().updateCategory("root", form({ name: "Root v2" }));
  assert(store.getState().categories.find((category) => category.id === "root")?.name === "Root v2" && store.getState().error === null, "Retry did not succeed after a failure.");

  // A persisted change survives a fresh read (page reload).
  const reloaded = createAdminCategoriesStore({ repository });
  reloaded.getState().initializeCategories(await repository.list());
  assert(reloaded.getState().categories.find((category) => category.id === created.id) !== undefined, "Created category did not persist across a reload.");

  await store.getState().deleteCategory(created.id);
  assert(!store.getState().categories.some((category) => category.id === created.id), "Delete was not reflected after confirmation.");
  server.failNext = { code: "CATEGORY_IN_USE", status: 409 };
  const blocked = await store.getState().deleteCategory("child").then(() => undefined, (cause: unknown) => cause);
  assert(blocked instanceof Error && store.getState().categories.some((category) => category.id === "child"), "Rejected delete removed the category locally.");
}

async function runMockScenario(): Promise<void> {
  const repository: AdminCategoriesRepository = new MockAdminCategoriesRepository(
    [
      { id: "a", name: "A", slug: "a", visibility: "visible" },
      { id: "b", name: "B", slug: "b", visibility: "visible", parentId: "a" },
      { id: "c", name: "C", slug: "c", visibility: "visible" },
    ],
    new Set(["c"]),
  );
  const created = await repository.create(form({ name: "A" }));
  assert(created.slug === "a-2" && created.id !== "a" && !created.id.match(/\d{10,}/), "Mock create must mirror server slug/id rules.");
  await expectCode(repository.create(form({ name: "Other", slug: "a" })), "SLUG_CONFLICT", 409);
  await expectCode(repository.update("a", form({ name: "A", parentId: "b" })), "CATEGORY_CYCLE", 409);
  await expectCode(repository.delete("c"), "CATEGORY_IN_USE", 409);
  await repository.update("c", { name: "C", visibility: "visible", description: "Keep" });
  await repository.update("b", { name: "B2", visibility: "visible" });
  assert((await repository.list()).find((category) => category.id === "b")?.parentId === "a", "Mock update omission did not preserve the parent.");
  await repository.update("c", { name: "C", visibility: "visible" });
  assert((await repository.list()).find((category) => category.id === "c")?.description === "Keep", "Mock update omission did not preserve metadata.");
  await repository.update("b", toCategoryUpdateInput(form({ name: "B2" })));
  assert((await repository.list()).find((category) => category.id === "b")?.parentId === undefined, "Mock explicit null did not move to the root.");
  await repository.update("c", toCategoryUpdateInput(form({ name: "C" })));
  assert((await repository.list()).find((category) => category.id === "c")?.description === undefined, "Mock explicit null did not clear metadata.");
  await repository.update("b", { name: "B2", visibility: "visible", parentId: "a" });
  await repository.setVisibility("a", "hidden");
  assert((await repository.list()).filter((category) => ["a", "b"].includes(category.id)).every((category) => category.visibility === "hidden"), "Mock hide did not cascade.");
  await repository.delete("a");
  assert((await repository.list()).map((category) => category.id).join() === "c," + created.id, "Mock delete did not remove the subtree.");
}

function createServer(initial: ServerCategory[]) {
  const state = {
    categories: initial.map((category) => ({ ...category })),
    failNext: undefined as { code: string; status: number } | undefined,
    gate: undefined as Promise<void> | undefined,
    rejectAuth: false,
    requests: [] as Array<{ authorization: string | null; body?: Record<string, unknown>; method: string; path: string }>,
    last: () => state.requests[state.requests.length - 1]!,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://api.test");
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
      if (url.pathname === "/api/admin-session/refresh") return json({ code: "UNAUTHORIZED", message: "expired" }, 401);
      state.requests.push({ authorization: headers.get("Authorization"), body, method, path: url.pathname });
      if (state.rejectAuth) return json({ code: "UNAUTHORIZED", message: "Unauthorized" }, 401);
      if (state.gate && method !== "GET") await state.gate;
      if (state.failNext && method !== "GET") { const failure = state.failNext; state.failNext = undefined; return json({ code: failure.code, message: failure.code }, failure.status); }
      return handle(state.categories, method, url.pathname.replace("/api/v1/admin/categories", ""), body);
    }) as (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  };
  return state;
}

let nextServerId = 1;
function handle(categories: ServerCategory[], method: string, rest: string, body?: Record<string, unknown>): Response {
  const find = (id: string) => categories.find((category) => category.id === id);
  const descendants = (id: string): string[] => { const ids = [id]; for (let index = 0; index < ids.length; index += 1) categories.filter((category) => category.parentId === ids[index]).forEach((category) => ids.push(category.id)); return ids; };
  if (method === "GET") {
    const node = (category: ServerCategory): unknown => ({ ...category, children: categories.filter((child) => child.parentId === category.id).map(node) });
    return json(categories.filter((category) => !category.parentId).map(node), 200);
  }
  if (method === "POST") {
    const category: ServerCategory = { description: body?.description as string | undefined, id: `srv-${nextServerId++}`, name: String(body?.name), parentId: body?.parentId as string | undefined, slug: String(body?.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"), visibility: body?.visibility as "hidden" | "visible" };
    categories.push(category);
    return json({ ...category, children: [] }, 201);
  }
  const visibility = rest.match(/^\/([^/]+)\/visibility$/);
  if (method === "PUT" && visibility) {
    const target = find(visibility[1]!);
    if (!target) return json({ code: "NOT_FOUND", message: "missing" }, 404);
    const ids = new Set(body?.visibility === "hidden" ? descendants(target.id) : [target.id]);
    categories.forEach((category) => { if (ids.has(category.id)) category.visibility = body?.visibility as "hidden" | "visible"; });
    return json({ ok: true }, 200);
  }
  const id = rest.slice(1);
  const target = find(id);
  if (!target) return json({ code: "NOT_FOUND", message: "missing" }, 404);
  if (method === "PUT") {
    target.name = String(body?.name);
    if (body && "description" in body) target.description = (body.description as string | null) ?? undefined;
    if (body && "parentId" in body) target.parentId = (body.parentId as string | null) ?? undefined;
    target.visibility = body?.visibility as "hidden" | "visible";
    if (typeof body?.slug === "string") target.slug = body.slug;
    return json({ ...target, children: [] }, 200);
  }
  if (id === "used") return json({ code: "CATEGORY_IN_USE", message: "in use" }, 409);
  descendants(id).reverse().forEach((removed) => categories.splice(categories.findIndex((category) => category.id === removed), 1));
  return new Response(null, { status: 204 });
}

function json(payload: unknown, status: number): Response { return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" }, status }); }
function form(overrides: Partial<AdminCategoryInput> & { name: string }): AdminCategoryInput {
  return { description: undefined, googleShoppingCategory: undefined, imageUrl: undefined, parentId: undefined, seoDescription: undefined, seoTitle: undefined, slug: undefined, visibility: "visible", ...overrides };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
function flush(): Promise<void> { return new Promise((resolve) => setTimeout(resolve, 0)); }
async function expectCode(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  const error = await promise.then(() => undefined, (cause: unknown) => cause);
  assert(error instanceof AdminCategoriesApiError && error.code === code && error.status === status, `Expected ${code}/${status}, received ${error instanceof Error ? `${(error as { code?: string }).code}/${(error as { status?: number }).status}` : "success"}.`);
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

void run().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
