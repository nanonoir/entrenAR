"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

type QuantitySelectorProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
  showLabel?: boolean;
};

export function QuantitySelector({
  value,
  min = 1,
  max = 99,
  onChange,
  label = "Cantidad",
  showLabel = true,
}: QuantitySelectorProps) {
  return (
    <div className="grid gap-2">
      {showLabel ? <span className="text-sm font-medium text-text">{label}</span> : null}
      <div className="grid h-11 w-36 grid-cols-[44px_1fr_44px] overflow-hidden rounded-button border border-border bg-surface">
        <Button
          aria-label="Reducir cantidad"
          className="h-full rounded-none border-r border-border"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          size="icon"
          variant="ghost"
        >
          <Minus aria-hidden size={16} />
        </Button>
        <output className="flex items-center justify-center font-subtitle text-base font-semibold">
          {value}
        </output>
        <Button
          aria-label="Aumentar cantidad"
          className="h-full rounded-none border-l border-border"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          size="icon"
          variant="ghost"
        >
          <Plus aria-hidden size={16} />
        </Button>
      </div>
    </div>
  );
}
