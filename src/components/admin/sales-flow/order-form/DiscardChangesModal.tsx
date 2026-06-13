import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type DiscardChangesModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DiscardChangesModal({ open, onClose, onConfirm }: DiscardChangesModalProps) {
  return (
    <Modal open={open} title="¿Descartás los cambios?" onClose={onClose} className="max-w-sm">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-zinc-950">¿Descartás los cambios?</h3>
        <p className="mt-2 text-sm text-zinc-500">Tenés cambios sin guardar. Si salís ahora, se perderán.</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Continuar editando</Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm}>Descartar</Button>
        </div>
      </div>
    </Modal>
  );
}
