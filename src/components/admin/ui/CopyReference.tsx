"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { shortReference } from "@/lib/formatting/short-reference";
import { cn } from "@/lib/utils";

type CopyReferenceProps = {
  className?: string;
  id: string;
};

export function CopyReference({ className, id }: CopyReferenceProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-xs text-zinc-500", className)}>
      <span className="truncate font-mono" title={id}>{shortReference(id)}</span>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Referencia copiada" : "Copiar referencia completa"}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
      >
        {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      </button>
    </span>
  );
}
