export type CategoryNavItem = {
  slug: string;
  label: string;
  description: string;
  featured?: boolean;
  groups?: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
};

export type ShopNavItem = {
  label: string;
  href: string;
  highlight?: boolean;
  megaMenuLayout?: "flat-5" | "grouped-5" | "flat-1";
  groups?: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
};
