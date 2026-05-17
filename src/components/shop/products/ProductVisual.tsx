import { cn } from "@/lib/utils";
import type { ProductImageTone } from "@/types/product";

type ProductVisualProps = {
  tone: ProductImageTone;
  name: string;
  brand: string;
  className?: string;
};

const toneStyles = {
  green: "from-lime-300 via-accent to-zinc-950",
  black: "from-zinc-300 via-zinc-700 to-black",
  red: "from-red-300 via-sale to-zinc-950",
  amber: "from-amber-200 via-warning to-zinc-900",
  blue: "from-sky-200 via-blue-600 to-zinc-950",
};

export function ProductVisual({ tone, name, brand, className }: ProductVisualProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-card bg-gradient-to-br p-4", toneStyles[tone], className)}>
      <div className="absolute inset-x-6 top-6 h-24 rounded-full bg-white/20 blur-2xl" />
      <div className="relative mx-auto flex aspect-[3/4] max-h-64 w-40 flex-col justify-between rounded-card border border-white/30 bg-white/90 p-4 text-zinc-950 shadow-xl">
        <span className="font-subtitle text-xs font-semibold uppercase text-zinc-500">{brand}</span>
        <strong className="font-heading text-4xl leading-none">{name.split(" ").slice(0, 2).join(" ")}</strong>
        <span className="h-2 w-16 rounded-full bg-accent" />
      </div>
    </div>
  );
}
