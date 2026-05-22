"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddressCard } from "@/components/shop/account/cards/AddressCard";
import { emptyAddress } from "@/lib/account-defaults";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import type { AccountAddress } from "@/types/account";

type AddressesSectionProps = {
  addresses: AccountAddress[];
  userEmail: string;
};

export function AddressesSection({ addresses, userEmail }: AddressesSectionProps) {
  const addAddress = useAccountProfileStore((state) => state.addAddress);
  const updateAddress = useAccountProfileStore((state) => state.updateAddress);
  const removeAddress = useAccountProfileStore((state) => state.removeAddress);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountAddress>(emptyAddress);

  function startNewAddress() {
    if (addresses.length >= 6) {
      return;
    }

    setEditingId("new");
    setDraft({ ...emptyAddress, id: `addr-${Date.now()}`, label: "Nueva dirección" });
  }

  function startEdit(address: AccountAddress) {
    setEditingId(address.id);
    setDraft(address);
  }

  function updateField(field: keyof AccountAddress, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function saveAddress() {
    const address = {
      ...draft,
      label: draft.label.trim() || "Dirección",
    };

    if (editingId === "new") {
      addAddress(userEmail, address);
    } else {
      updateAddress(userEmail, address);
    }

    setEditingId(null);
    setDraft(emptyAddress);
  }

  return (
    <div>
      <SectionHeader
        action={
          <Button disabled={addresses.length >= 6 || editingId !== null} onClick={startNewAddress}>
            <Plus aria-hidden size={18} />
            Agregar Dirección
          </Button>
        }
        title="Direcciones"
      />
      {addresses.length >= 6 ? (
        <p className="mb-4 text-sm font-medium text-text-muted">Ya guardaste el máximo de 6 direcciones.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {editingId === "new" ? (
          <AddressCard
            address={draft}
            editing
            onDelete={() => setEditingId(null)}
            onEdit={() => undefined}
            onFieldChange={updateField}
            onSave={saveAddress}
          />
        ) : null}
        {addresses.map((address) => {
          const editing = editingId === address.id;

          return (
            <AddressCard
              address={editing ? draft : address}
              editing={editing}
              key={address.id}
              onDelete={() => removeAddress(userEmail, address.id)}
              onEdit={() => startEdit(address)}
              onFieldChange={updateField}
              onSave={saveAddress}
            />
          );
        })}
      </div>
      {addresses.length === 0 && editingId !== "new" ? (
        <EmptyState
          className="mt-4"
          description="Agregá una dirección para acelerar tus próximas compras."
          title="No tenés direcciones guardadas"
        />
      ) : null}
    </div>
  );
}
