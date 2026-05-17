import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/LinkButton";
import { cn } from "@/lib/utils";
import type { HomeCategoryCard as HomeCategoryCardType } from "@/types/home";

type HomeCategoryCardProps = {
  category: HomeCategoryCardType;
  className?: string;
};

const cardBase =
  "w-full max-w-[320px] overflow-hidden rounded-card border border-border bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lg";

export function HomeCategoryCard({ category, className }: HomeCategoryCardProps) {
  return (
    <article className={cn(cardBase, className)}>
      <Link
        aria-label={category.title}
        className="block overflow-hidden rounded-t-card"
        href={category.href}
      >
        <Image
          alt={category.alt}
          className="h-[180px] w-full object-cover transition duration-300 hover:scale-[1.03]"
          height={380}
          src={category.imageSrc}
          width={640}
        />
      </Link>
      <div className="flex min-h-[118px] flex-col items-center justify-center gap-4 bg-white px-5 py-5 text-center">
        <h3 className="font-subtitle text-lg font-bold uppercase leading-tight text-text">
          {category.title}
        </h3>
        <LinkButton className="h-10 w-[132px] px-4" href={category.href} size="sm">
          {"VER M\u00c1S"}
        </LinkButton>
      </div>
    </article>
  );
}
