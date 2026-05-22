import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AccountAddress } from "@/types/account";

type AddressCardProps = {
  address: AccountAddress;
  editing: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onFieldChange: (field: keyof AccountAddress, value: string) => void;
  onSave: () => void;
};

export function AddressCard({
  address,
  editing,
  onDelete,
  onEdit,
  onFieldChange,
  onSave,
}: AddressCardProps) {
  return (
    <div className="grid gap-3 rounded-card border border-border bg-white p-4 shadow-card">
      {editing ? (
        <>
          <Input label="Etiqueta" onChange={(event) => onFieldChange("label", event.target.value)} value={address.label} />
          <Input label="Destinatario" onChange={(event) => onFieldChange("recipient", event.target.value)} value={address.recipient} />
          <Input label="Calle y número" onChange={(event) => onFieldChange("street", event.target.value)} value={address.street} />
          <Input label="Ciudad" onChange={(event) => onFieldChange("city", event.target.value)} value={address.city} />
          <Input label="Provincia" onChange={(event) => onFieldChange("province", event.target.value)} value={address.province} />
          <Input label="Código Postal" onChange={(event) => onFieldChange("postalCode", event.target.value)} value={address.postalCode} />
          <Input label="Teléfono" onChange={(event) => onFieldChange("phone", event.target.value)} value={address.phone} />
          <Button onClick={onSave}>Guardar</Button>
        </>
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
            <Button onClick={onDelete} size="sm" variant="danger">
              <Trash2 aria-hidden size={16} />
              Eliminar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
