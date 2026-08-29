"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  AccountState,
  focusFirstInvalidField,
  getAccountFieldError,
  getAddressFieldErrors,
  type AccountAddressField,
} from "@/components/shop/account/AccountState";
import { AddressCard } from "@/components/shop/account/cards/AddressCard";
import { emptyAddress } from "@/lib/account-defaults";
import { SectionHeader } from "@/components/shop/account/dashboard/SectionHeader";
import { useAccountProfileStore } from "@/stores/account-profile-store";
import { ACCOUNT_ASYNC_STATUS, type AccountAddress } from "@/types/account";

type AddressesSectionProps = {
  addresses: AccountAddress[];
  userEmail: string;
};

export function AddressesSection({ addresses, userEmail }: AddressesSectionProps) {
  const addAddress = useAccountProfileStore((state) => state.addAddress);
  const updateAddress = useAccountProfileStore((state) => state.updateAddress);
  const removeAddress = useAccountProfileStore((state) => state.removeAddress);
  const loadAddresses = useAccountProfileStore((state) => state.load);
  const addressesError = useAccountProfileStore((state) => state.addressesError);
  const addressesStatus = useAccountProfileStore((state) => state.addressesStatus);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AccountAddress>(emptyAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Partial<Record<AccountAddressField, boolean>>>({});

  function startNewAddress() {
    if (addresses.length >= 6) {
      return;
    }

    setEditingId("new");
    setDraft({ ...emptyAddress, id: "new-address", label: "" });
    setSubmitted(false);
    setTouchedFields({});
  }

  function startEdit(address: AccountAddress) {
    setEditingId(address.id);
    setDraft(address);
    setSubmitted(false);
    setTouchedFields({});
  }

  function updateField(field: AccountAddressField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function handleBlur(field: AccountAddressField) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  function fieldError(field: AccountAddressField) {
    if (!submitted && !touchedFields[field]) {
      return undefined;
    }

    return addressErrors[field] ?? getAccountFieldError(addressesError, field);
  }

  async function saveAddress() {
    if (isSaving || editingId === null) {
      return;
    }

    const address = {
      ...draft,
      label: draft.label.trim(),
    };
    const nextErrors = getAddressFieldErrors(address);
    setSubmitted(true);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(
        addressFieldIds,
        addressFieldIds.filter((fieldId) => Boolean(nextErrors[addressFieldFromId(fieldId)])),
      );
      return;
    }

    setIsSaving(true);
    let saved = false;
    if (editingId === "new") {
      saved = await addAddress(userEmail, address);
    } else {
      saved = await updateAddress(userEmail, address);
    }
    setIsSaving(false);

    if (saved) {
      setEditingId(null);
      setDraft(emptyAddress);
      setSubmitted(false);
      setTouchedFields({});
    }
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(emptyAddress);
    setSubmitted(false);
    setTouchedFields({});
  }

  const addressErrors = getAddressFieldErrors(draft);
  const hasAddressData = addresses.length > 0 || editingId !== null;
  const isBusy = isSaving || addressesStatus === ACCOUNT_ASYNC_STATUS.LOADING;

  return (
    <div>
      <SectionHeader
        action={
          <Button
            disabled={addresses.length >= 6 || editingId !== null || isBusy}
            onClick={startNewAddress}
          >
            <Plus aria-hidden size={18} />
            Agregar Dirección
          </Button>
        }
        title="Direcciones"
      />
      {addresses.length >= 6 ? (
        <p className="mb-4 text-sm font-medium text-text-muted">Ya guardaste el máximo de 6 direcciones.</p>
      ) : null}
      <AccountState
        empty={
          <EmptyState
            className="mt-4"
            description="Agregá una dirección para acelerar tus próximas compras."
            title="No tenés direcciones guardadas"
          />
        }
        error={addressesError}
        hasData={hasAddressData}
        isEmpty={!hasAddressData}
        loadingTitle="Cargando tus direcciones"
        onRetry={() => loadAddresses(userEmail)}
        status={addressesStatus}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {editingId === "new" ? (
            <AddressCard
              address={draft}
              editing
              fieldErrors={visibleFieldErrors(fieldError)}
              onCancel={cancelEditing}
              onDelete={cancelEditing}
              onEdit={() => undefined}
              onFieldBlur={handleBlur}
              onFieldChange={updateField}
              onSave={() => void saveAddress()}
              saving={isBusy}
            />
          ) : null}
          {addresses.map((address) => {
            const editing = editingId === address.id;

            return (
              <AddressCard
                address={editing ? draft : address}
                editing={editing}
                fieldErrors={editing ? visibleFieldErrors(fieldError) : {}}
                key={address.id}
                onCancel={cancelEditing}
                onDelete={() => void removeAddress(userEmail, address.id)}
                onEdit={() => startEdit(address)}
                onFieldBlur={handleBlur}
                onFieldChange={updateField}
                onSave={() => void saveAddress()}
                saving={isBusy}
              />
            );
          })}
        </div>
      </AccountState>
    </div>
  );
}

const addressFieldIds = [
  "account-address-label",
  "account-address-recipient",
  "account-address-street",
  "account-address-city",
  "account-address-province",
  "account-address-postal-code",
  "account-address-phone",
] as const;

function visibleFieldErrors(
  getFieldError: (field: AccountAddressField) => string | undefined,
): Partial<Record<AccountAddressField, string>> {
  return addressFieldIds.reduce<Partial<Record<AccountAddressField, string>>>((errors, fieldId) => {
    const field = addressFieldFromId(fieldId);
    const error = getFieldError(field);

    if (error) {
      errors[field] = error;
    }

    return errors;
  }, {});
}

function addressFieldFromId(fieldId: (typeof addressFieldIds)[number]): AccountAddressField {
  const fields: Record<(typeof addressFieldIds)[number], AccountAddressField> = {
    "account-address-city": "city",
    "account-address-label": "label",
    "account-address-phone": "phone",
    "account-address-postal-code": "postalCode",
    "account-address-province": "province",
    "account-address-recipient": "recipient",
    "account-address-street": "street",
  };

  return fields[fieldId];
}
