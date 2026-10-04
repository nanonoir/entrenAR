export function withListingPage(searchParams: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  return next;
}

export function resetListingPage(searchParams: URLSearchParams): URLSearchParams {
  return withListingPage(searchParams, 1);
}
