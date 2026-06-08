import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SameRouteScrollLink } from "@/components/shop/layout/SameRouteScrollLink";
import {
  footerDeveloperText,
  footerHelpActions,
  footerHelpText,
  footerLegalText,
  footerSections,
  footerSocialLinks,
} from "@/lib/data/footer";

function FooterLinks({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return (
    <div>
      <h3 className="font-subtitle text-sm font-semibold uppercase text-white">{title}</h3>
      <div className="mt-4 grid gap-2.5 text-sm text-zinc-300">
        {links.map((link) => (
          <SameRouteScrollLink className="transition hover:text-accent" href={link.href} key={link.label}>
            {link.label}
          </SameRouteScrollLink>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  const [aboutSection, buySection, policiesSection] = footerSections;

  return (
    <footer className="border-t border-border bg-zinc-950 text-white">
      <Container className="grid gap-9 py-11 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.35fr_1fr]" size="wide">
        <div>
          <Image alt="EntrenAR" height={42} src="/logoWhite.svg" width={150} />
          {aboutSection ? (
            <div className="mt-7">
              <FooterLinks links={aboutSection.links} title={aboutSection.title} />
            </div>
          ) : null}
        </div>

        {buySection ? <FooterLinks links={buySection.links} title={buySection.title} /> : null}
        {policiesSection ? <FooterLinks links={policiesSection.links} title={policiesSection.title} /> : null}

        <div>
          <h3 className="font-subtitle text-sm font-semibold uppercase text-white">AYUDA</h3>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-zinc-300">{footerHelpText}</p>
          <div className="mt-5 grid gap-2">
            {footerHelpActions.map((action) => (
              <SameRouteScrollLink
                className="inline-flex min-h-10 items-center justify-center rounded-button border border-white/25 bg-transparent px-4 py-2 text-center font-subtitle text-sm font-semibold uppercase text-white transition hover:border-accent hover:text-accent"
                href={action.href}
                key={action.label}
              >
                {action.label}
              </SameRouteScrollLink>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-subtitle text-sm font-semibold uppercase text-white">REDES SOCIALES</h3>
          <p className="mt-4 text-sm leading-6 text-zinc-300">{footerDeveloperText}</p>
          <div className="mt-5 flex items-center gap-3">
            {footerSocialLinks.map((link) => (
              <a
                aria-label={link.label}
                className="grid h-10 w-10 place-items-center rounded-button border border-white/20 transition hover:border-accent"
                href={link.href}
                key={link.label}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Image alt="" aria-hidden height={20} src={link.iconSrc} width={20} />
              </a>
            ))}
          </div>
        </div>
      </Container>

      <div className="border-t border-white/10">
        <Container className="py-4 text-center text-xs leading-5 text-zinc-400" size="wide">
          {footerLegalText}
        </Container>
      </div>
    </footer>
  );
}
