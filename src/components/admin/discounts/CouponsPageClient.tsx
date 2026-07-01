"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/layout/AdminPageHeader";
import { CouponFilters, defaultCouponFilters, type CouponFiltersState, type CouponSort } from "@/components/admin/discounts/CouponFilters";
import { CouponList } from "@/components/admin/discounts/CouponList";
import { DeleteDiscountModal } from "@/components/admin/discounts/DeleteDiscountModal";
import { DiscountEmptyState } from "@/components/admin/discounts/DiscountEmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import type { Coupon } from "@/lib/data/admin/discounts/types";
import { normalizeSearch } from "@/components/admin/discounts/discount-utils";
import { useAdminDiscountsStore } from "@/stores/admin-discounts-store";
import { useAdminToastStore } from "@/stores/admin-toast-store";

export function CouponsPageClient() {
  const coupons = useAdminDiscountsStore((state) => state.coupons);
  const activateCoupon = useAdminDiscountsStore((state) => state.activateCoupon);
  const deactivateCoupon = useAdminDiscountsStore((state) => state.deactivateCoupon);
  const deleteCoupon = useAdminDiscountsStore((state) => state.deleteCoupon);
  const addToast = useAdminToastStore((state) => state.addToast);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CouponFiltersState>(defaultCouponFilters);
  const [draftFilters, setDraftFilters] = useState<CouponFiltersState>(defaultCouponFilters);
  const [sort, setSort] = useState<CouponSort>("code-asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [couponToDeactivate, setCouponToDeactivate] = useState<Coupon | null>(null);

  const visibleCoupons = useMemo(() => filterAndSortCoupons(coupons, search, filters, sort), [coupons, filters, search, sort]);

  function clearFilters() {
    setSearch("");
    setDraftFilters(defaultCouponFilters);
    setFilters(defaultCouponFilters);
    setFilterOpen(false);
  }

  function toggleCoupon(coupon: Coupon) {
    if (coupon.status === "active") {
      setCouponToDeactivate(coupon);
      return;
    }
    activateCoupon(coupon.id);
    addToast("Cupón activado correctamente.");
  }

  function confirmDeactivate() {
    if (!couponToDeactivate) return;
    deactivateCoupon(couponToDeactivate.id);
    addToast("Cupón desactivado correctamente.");
    setCouponToDeactivate(null);
  }

  function confirmDelete() {
    if (!couponToDelete) return;
    deleteCoupon(couponToDelete.id);
    addToast("Cupón eliminado correctamente.");
    setCouponToDelete(null);
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-5 overflow-hidden">
      <AdminPageHeader title="Cupones" description="Creá y administrá códigos promocionales para campañas comerciales." tag="Descuentos">
        <LinkButton href="/admin/descuentos/cupones/nuevo" size="sm"><Plus aria-hidden size={16} />Crear cupón</LinkButton>
      </AdminPageHeader>
      {coupons.length === 0 ? (
        <DiscountEmptyState
          eyebrow="CUPONES"
          imageSrc="/cuponPic.svg"
          title="Creá cupones para vender más y fidelizar clientes"
          bullets={["Ofrecé descuentos personalizados para fechas clave o campañas especiales.", "Recompensá a quienes ya compraron con cupones exclusivos.", "Usá cupones como incentivo para atraer nuevas visitas y ventas."]}
          actionHref="/admin/descuentos/cupones/nuevo"
          actionLabel="Crear cupón"
        />
      ) : (
        <>
          <CouponFilters search={search} sort={sort} draftFilters={draftFilters} filterOpen={filterOpen} onSearchChange={setSearch} onSortChange={setSort} onDraftFiltersChange={setDraftFilters} onFilterOpenChange={setFilterOpen} onClearFilters={clearFilters} onApplyFilters={() => { setFilters(draftFilters); setFilterOpen(false); }} />
          {visibleCoupons.length === 0 ? (
            <DiscountEmptyState title={search.trim() ? "No encontramos cupones con ese código." : "No encontramos cupones con los filtros seleccionados."} description="Probá ajustar la búsqueda o borrar filtros para volver al listado completo." onClear={clearFilters} />
          ) : (
            <CouponList coupons={visibleCoupons} onDelete={setCouponToDelete} onToggle={toggleCoupon} />
          )}
          <p className="text-sm text-text-muted">Mostrando {visibleCoupons.length} de {coupons.length} cupones.</p>
        </>
      )}
      <DeleteDiscountModal open={Boolean(couponToDelete)} title="¿Eliminar este cupón?" message="Al hacerlo, perderás toda la información sobre este cupón y no podrás recuperarla." confirmLabel="Eliminar" onClose={() => setCouponToDelete(null)} onConfirm={confirmDelete} />
      <DeleteDiscountModal open={Boolean(couponToDeactivate)} title="¿Desactivar este cupón?" message="Al hacerlo, deshabilitás este cupón. Tus clientes no podrán usarlo en la tienda." confirmLabel="Desactivar" onClose={() => setCouponToDeactivate(null)} onConfirm={confirmDeactivate} />
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
