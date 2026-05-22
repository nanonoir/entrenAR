"use client";

import { AccountEntryButton } from "@/components/shop/account/AccountEntryButton";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/stores/ui-store";

type FavoriteAuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FavoriteAuthModal({ open, onClose }: FavoriteAuthModalProps) {
  const openAccountDrawer = useUIStore((state) => state.openAccountDrawer);

  function handleAccountEntry() {
    onClose();
    openAccountDrawer();
  }

  return (
    <Modal className="max-w-md" onClose={onClose} open={open} title="Cuenta requerida">
      <div className="grid gap-5 px-5 pb-6 pt-7 sm:px-7">
        <p className="text-base leading-7 text-text">
          Debés iniciar sesión o registrarte para añadir un producto a favoritos.
        </p>
        <AccountEntryButton onClick={handleAccountEntry} />
      </div>
    </Modal>
  );
}
