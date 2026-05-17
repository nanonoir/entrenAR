"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";

type FavoriteAuthModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FavoriteAuthModal({ open, onClose }: FavoriteAuthModalProps) {
  return (
    <Modal className="max-w-md" onClose={onClose} open={open} title="Iniciar sesion requerida">
      <div className="px-5 pb-6 pt-7 sm:px-7">
        <p className="text-base leading-7 text-text">
          Debes iniciar sesion o registrarte para a&ntilde;adir este producto a tu lista de favoritos.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <LinkButton className="h-11 px-3 text-sm" href="/registrarse" onClick={onClose} variant="secondary">
            Registrarse
          </LinkButton>
          <Button className="h-11 px-3 text-sm" onClick={onClose}>
            Iniciar sesion
          </Button>
        </div>
      </div>
    </Modal>
  );
}
