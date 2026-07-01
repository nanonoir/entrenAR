import Image from "next/image";
import { LinkButton } from "@/components/ui/LinkButton";
import { Button } from "@/components/ui/Button";

type DiscountEmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  eyebrow?: string;
  imageSrc?: string;
  onClear?: () => void;
  title: string;
  bullets?: string[];
  description?: string;
};

export function DiscountEmptyState({ actionHref, actionLabel, bullets, description, eyebrow, imageSrc = "/cuponPic.svg", onClear, title }: DiscountEmptyStateProps) {
  return (
    <section className="grid min-w-0 gap-6 overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-sm md:grid-cols-[220px_1fr] md:items-center">
      <div className="mx-auto flex size-40 shrink-0 items-center justify-center rounded-full bg-accent-soft md:size-48">
        <Image alt="" src={imageSrc} width={150} height={150} className="max-h-36 w-auto" />
      </div>
      <div className="min-w-0 text-center md:text-left">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-semibold text-text">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p> : null}
        {bullets ? (
          <ul className="mx-auto mt-4 grid max-w-xl gap-2 text-left text-sm text-text-muted md:mx-0">
            {bullets.map((bullet) => <li key={bullet} className="min-w-0 rounded-2xl bg-surface px-3 py-2">{bullet}</li>)}
          </ul>
        ) : null}
        {actionHref && actionLabel ? <LinkButton href={actionHref} className="mt-5">{actionLabel}</LinkButton> : null}
        {onClear ? <Button className="mt-5" variant="secondary" onClick={onClear}>Borrar filtros</Button> : null}
      </div>
    </section>
  );
}
