import Link from "next/link";
import type { CatalogListingFacet, CatalogReadResult } from "@/lib/api/catalog/catalog.repository";

type BrandDirectoryProps = {
  result: CatalogReadResult<CatalogListingFacet[]>;
};

export function BrandDirectory({ result }: BrandDirectoryProps) {
  if (result.status === "loading") {
    return <p aria-live="polite" className="text-sm text-text-muted">Cargando marcas...</p>;
  }

  if (result.status === "error") {
    return <p aria-live="assertive" className="text-sm text-text-muted">No pudimos cargar las marcas. Intenta nuevamente más tarde.</p>;
  }

  if (result.status === "empty" || result.data.length === 0) {
    return <p className="text-sm text-text-muted">Todavía no hay marcas disponibles.</p>;
  }

  const groups = new Map<string, CatalogListingFacet[]>();
  for (const brand of result.data) {
    const initial = brand.label.trim().charAt(0).toLocaleUpperCase() || "#";
    const brands = groups.get(initial) ?? [];
    brands.push(brand);
    groups.set(initial, brands);
  }

  return (
    <nav aria-label="Directorio de marcas" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {[...groups.entries()].map(([initial, brands]) => (
        <section aria-labelledby={`brand-group-${initial}`} className="min-w-0" key={initial}>
          <h2 className="border-b border-border pb-2 font-subtitle text-sm font-semibold uppercase text-text-muted" id={`brand-group-${initial}`}>
            {initial}
          </h2>
          <ul className="mt-2 grid gap-1">
            {brands.map((brand) => (
              <li key={brand.slug}>
                <Link
                  className="inline-flex min-h-11 max-w-full items-center rounded-button px-2 text-base font-medium text-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  href={`/marcas/${encodeURIComponent(brand.slug)}`}
                >
                  <span className="whitespace-normal break-words">{brand.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
