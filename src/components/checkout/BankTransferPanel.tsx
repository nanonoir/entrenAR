import { Upload } from "lucide-react";
import { bankTransferInstructions } from "@/lib/data/checkout";

type BankTransferPanelProps = {
  fileName: string;
  onFileSelect: (fileName: string) => void;
  open: boolean;
};

export function BankTransferPanel({ fileName, onFileSelect, open }: BankTransferPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="mt-4 rounded-card border border-accent bg-accent-soft p-4">
      <h3 className="font-subtitle text-lg font-bold uppercase text-accent-hover">Datos para transferencia</h3>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Titular</dt>
          <dd className="font-semibold text-text">{bankTransferInstructions.accountHolder}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Alias</dt>
          <dd className="font-semibold text-text">{bankTransferInstructions.alias}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">CBU</dt>
          <dd className="font-semibold text-text">{bankTransferInstructions.cbu}</dd>
        </div>
      </dl>
      <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-button border border-dashed border-accent bg-surface px-4 py-5 text-sm font-semibold text-accent-hover">
        <Upload aria-hidden size={18} />
        {bankTransferInstructions.uploadLabel}
        <input
          className="sr-only"
          onChange={(event) => onFileSelect(event.target.files?.[0]?.name ?? "")}
          type="file"
        />
      </label>
      {fileName ? <p className="mt-3 text-sm font-semibold text-text">Comprobante seleccionado: {fileName}</p> : null}
      <p className="mt-3 text-xs leading-5 text-text-muted">{bankTransferInstructions.uploadHelper}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-text">{bankTransferInstructions.note}</p>
    </div>
  );
}
