"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { CouponFilters, defaultCouponFilters, type CouponFiltersState, type CouponSort } from "@/components/admin/discounts/CouponFilters";
import { CouponList } from "@/components/admin/discounts/CouponList";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountEmptyState } from "@/components/admin/discounts/DiscountEmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { CommerceErrorBanner, CommerceLoadingState, CommerceMutationStatus, CommerceSourceBadge } from "@/components/admin/ui/CommerceDataState";
import type { Coupon } from "@/lib/data/admin/discounts/types";
import { normalizeSearch } from "@/components/admin/discounts/discount-utils";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

export function CouponsPageClient() {
  const coupons = useAdminDiscountsStore((state) => state.coupons);
  const activateCoupon = useAdminDiscountsStore((state) => state.activateCoupon);
  const deactivateCoupon = useAdminDiscountsStore((state) => state.deactivateCoupon);
  const deleteCoupon = useAdminDiscountsStore((state) => state.deleteCoupon);
  const clearError = useAdminDiscountsStore((state) => state.clearError);
  const couponsEmpty = useAdminDiscountsStore((state) => state.couponsEmpty);
  const error = useAdminDiscountsStore((state) => state.error);
  const hasLoaded = useAdminDiscountsStore((state) => state.hasLoaded);
  const load = useAdminDiscountsStore((state) => state.load);
  const source = useAdminDiscountsStore((state) => state.source);
  const status = useAdminDiscountsStore((state) => state.status);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CouponFiltersState>(defaultCouponFilters);
  const [draftFilters, setDraftFilters] = useState<CouponFiltersState>(defaultCouponFilters);
  const [sort, setSort] = useState<CouponSort>("code-asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [couponToDeactivate, setCouponToDeactivate] = useState<Coupon | null>(null);

  const visibleCoupons = filterAndSortCoupons(coupons, search, filters, sort);

  useEffect(() => {
    if (!hasLoaded) void load();
  }, [hasLoaded, load]);

  function clearFilters() {
    setSearch("");
    setDraftFilters(defaultCouponFilters);
    setFilters(defaultCouponFilters);
    setFilterOpen(false);
  }

  function toggleCoupon(coupon: Coupon) {
    if (coupon.status === "active") {
      clearError();
      setCouponToDeactivate(coupon);
      return;
    }
    return activateCoupon(coupon.id).then((succeeded) => {
      if (succeeded) addToast("Cupón activado correctamente.");
    });
  }

  async function confirmDeactivate(): Promise<boolean> {
    if (!couponToDeactivate) return false;
    const succeeded = await deactivateCoupon(couponToDeactivate.id);
    if (!succeeded) return false;

    addToast("Cupón desactivado correctamente.");
    setCouponToDeactivate(null);
    return true;
  }

  async function confirmDelete(): Promise<boolean> {
    if (!couponToDelete) return false;
    const succeeded = await deleteCoupon(couponToDelete.id);
    if (!succeeded) return false;

    addToast("Cupón eliminado correctamente.");
    setCouponToDelete(null);
    return true;
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title="Cupones" description="Creá y administrá códigos promocionales para campañas comerciales." tag="Descuentos">
        <CommerceSourceBadge source={source} />
        <LinkButton href="/admin/descuentos/cupones/nuevo" size="sm"><Plus aria-hidden size={16} />Crear cupón</LinkButton>
      </AdminPageHeader>
      {!hasLoaded && !error ? <CommerceLoadingState label="Cargando cupones…" /> : null}
      {!hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && status === "loading" ? <CommerceMutationStatus /> : null}
      {hasLoaded && error ? <CommerceErrorBanner error={error} onRetry={() => void load()} /> : null}
      {hasLoaded && couponsEmpty ? (
        <DiscountEmptyState
          eyebrow="CUPONES"
          imageSrc="/cuponPic.svg"
          title="Creá cupones para vender más y fidelizar clientes"
          bullets={["Ofrecé descuentos personalizados para fechas clave o campañas especiales.", "Recompensá a quienes ya compraron con cupones exclusivos.", "Usá cupones como incentivo para atraer nuevas visitas y ventas."]}
          actionHref="/admin/descuentos/cupones/nuevo"
          actionLabel="Crear cupón"
        />
      ) : hasLoaded ? (
        <>
          <CouponFilters search={search} sort={sort} draftFilters={draftFilters} filterOpen={filterOpen} onSearchChange={setSearch} onSortChange={setSort} onDraftFiltersChange={setDraftFilters} onFilterOpenChange={setFilterOpen} onClearFilters={clearFilters} onApplyFilters={() => { setFilters(draftFilters); setFilterOpen(false); }} />
          {visibleCoupons.length === 0 ? (
            <DiscountEmptyState title={search.trim() ? "No encontramos cupones con ese código." : "No encontramos cupones con los filtros seleccionados."} description="Probá ajustar la búsqueda o borrar filtros para volver al listado completo." onClear={clearFilters} />
          ) : (
            <CouponList disabled={status === "loading"} coupons={visibleCoupons} onDelete={(coupon) => { clearError(); setCouponToDelete(coupon); }} onToggle={toggleCoupon} />
          )}
          <p className="text-sm text-text-muted">Mostrando {visibleCoupons.length} de {coupons.length} cupones.</p>
        </>
      ) : null}
      <DeleteDiscountModal error={error} open={Boolean(couponToDelete)} title="¿Eliminar este cupón?" message="Al hacerlo, perderás toda la información sobre este cupón y no podrás recuperarla." confirmLabel="Eliminar" onClose={() => setCouponToDelete(null)} onConfirm={confirmDelete} />
      <DeleteDiscountModal error={error} open={Boolean(couponToDeactivate)} title="¿Desactivar este cupón?" message="Al hacerlo, deshabilitás este cupón. Tus clientes no podrán usarlo en la tienda." confirmLabel="Desactivar" onClose={() => setCouponToDeactivate(null)} onConfirm={confirmDeactivate} />
    </div>
  );
}

function filterAndSortCoupons(coupons: Coupon[], search: string, filters: CouponFiltersState, sort: CouponSort) {
  const query = normalizeSearch(search);
  return coupons
    .filter((coupon) => {
      const matchesSearch = !query || normalizeSearch(coupon.code).includes(query);
      const matchesType = filters.discountType === "all" || coupon.discountType === filters.discountType;
      const includesShipping = coupon.discountType === "free_shipping" || coupon.includeShippingCost;
      const matchesShipping = filters.includesShipping === "all" || (filters.includesShipping === "yes" ? includesShipping : !includesShipping);
      const matchesUsage = filters.usage === "all" || coupon.totalUsageLimitType === filters.usage;
      const matchesValidity = filters.validity === "all" || coupon.dateLimitType === filters.validity;
      const matchesMinimum = filters.minimumCart === "all" || (filters.minimumCart === "with" ? coupon.minimumCartAmount > 0 : coupon.minimumCartAmount === 0);
      const matchesMax = filters.maxDiscount === "all" || (filters.maxDiscount === "with" ? coupon.maxDiscountType === "amount" : coupon.maxDiscountType === "none");
      const matchesStatus = filters.status === "all" || coupon.status === filters.status;
      return matchesSearch && matchesType && matchesShipping && matchesUsage && matchesValidity && matchesMinimum && matchesMax && matchesStatus;
    })
    .sort((a, b) => {
      if (sort === "code-asc") return a.code.localeCompare(b.code);
      if (sort === "code-desc") return b.code.localeCompare(a.code);
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "most-used") return b.usageCount - a.usageCount;
      return a.usageCount - b.usageCount;
    });
}
