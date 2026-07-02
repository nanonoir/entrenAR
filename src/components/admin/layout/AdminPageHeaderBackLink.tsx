"use client";

import { ArrowLeft } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";

type AdminPageHeaderBackLinkProps = {
  href: string;
  label: string;
  onNavigate?: (href: string) => void;
};

export function AdminPageHeaderBackLink({ href, label, onNavigate }: AdminPageHeaderBackLinkProps) {
  return (
    <LinkButton
      href={href}
      variant="secondary"
      size="sm"
      onClick={onNavigate ? (event) => {
        event.preventDefault();
        onNavigate(href);
      } : undefined}
    >
      <ArrowLeft aria-hidden size={16} />
      {label}
    </LinkButton>
  );
}
