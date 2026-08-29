import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AccountAddress } from "@/types/account";
import type { AccountAddressField } from "@/components/shop/account/AccountState";

type AddressCardProps = {
  address: AccountAddress;
  editing: boolean;
  fieldErrors: Partial<Record<AccountAddressField, string>>;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onFieldBlur: (field: AccountAddressField) => void;
  onFieldChange: (field: AccountAddressField, value: string) => void;
  onSave: () => void;
  saving: boolean;
};

export function AddressCard({
  address,
  editing,
  fieldErrors,
  onCancel,
  onDelete,
  onEdit,
  onFieldBlur,
  onFieldChange,
  onSave,
  saving,
}: AddressCardProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave();
  }

  return (
    <div className="grid gap-3 rounded-card border border-border bg-white p-4 shadow-card">
      {editing ? (
        <form className="grid gap-3" onSubmit={handleSubmit}>
          <Input
            errorText={fieldErrors.label}
            helperText={fieldErrors.label ? undefined : "Un nombre para reconocerla, por ejemplo Casa."}
            id="account-address-label"
            label="Etiqueta"
            maxLength={60}
            onBlur={() => onFieldBlur("label")}
            onChange={(event) => onFieldChange("label", event.target.value)}
            value={address.label}
          />
          <Input
            errorText={fieldErrors.recipient}
            helperText={fieldErrors.recipient ? undefined : "Nombre de quien recibe el pedido."}
            id="account-address-recipient"
            label="Destinatario"
            maxLength={120}
            onBlur={() => onFieldBlur("recipient")}
            onChange={(event) => onFieldChange("recipient", event.target.value)}
            value={address.recipient}
          />
          <Input
            errorText={fieldErrors.street}
            helperText={fieldErrors.street ? undefined : "Incluí calle y número."}
            id="account-address-street"
            label="Calle y número"
            maxLength={200}
            onBlur={() => onFieldBlur("street")}
            onChange={(event) => onFieldChange("street", event.target.value)}
            value={address.street}
          />
          <Input
            errorText={fieldErrors.city}
            helperText={fieldErrors.city ? undefined : "Localidad donde se entrega."}
            id="account-address-city"
            label="Ciudad"
            maxLength={120}
            onBlur={() => onFieldBlur("city")}
            onChange={(event) => onFieldChange("city", event.target.value)}
            value={address.city}
          />
          <Input
            errorText={fieldErrors.province}
            helperText={fieldErrors.province ? undefined : "Provincia de entrega."}
            id="account-address-province"
            label="Provincia"
            maxLength={120}
            onBlur={() => onFieldBlur("province")}
            onChange={(event) => onFieldChange("province", event.target.value)}
            value={address.province}
          />
          <Input
            errorText={fieldErrors.postalCode}
            helperText={fieldErrors.postalCode ? undefined : "Ej: 1425 o B1640."}
            id="account-address-postal-code"
            inputMode="text"
            label="Código Postal"
            maxLength={20}
            onBlur={() => onFieldBlur("postalCode")}
            onChange={(event) => onFieldChange("postalCode", event.target.value)}
            value={address.postalCode}
          />
          <Input
            errorText={fieldErrors.phone}
            helperText={fieldErrors.phone ? undefined : "Ej: +54 11 4567-8901."}
            id="account-address-phone"
            label="Teléfono"
            maxLength={24}
            onBlur={() => onFieldBlur("phone")}
            onChange={(event) => onFieldChange("phone", event.target.value)}
            value={address.phone}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button disabled={saving} type="submit">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button disabled={saving} onClick={onCancel} type="button" variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div>
            <h3 className="font-subtitle text-lg font-semibold uppercase">{address.label}</h3>
            <p className="mt-1 text-sm text-text-muted">{address.recipient || "Sin destinatario"}</p>
          </div>
          <p className="text-sm leading-6 text-text-muted">
            {[address.street, address.city, address.province, address.postalCode].filter(Boolean).join(", ") ||
              "Sin datos de dirección"}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button onClick={onEdit} size="sm" variant="secondary">
              Editar
            </Button>
            <Button disabled={saving} onClick={onDelete} size="sm" variant="danger">
              <Trash2 aria-hidden size={16} />
              Eliminar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
