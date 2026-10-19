export type HeroBannerImage = {
  src: string;
  width: number;
  height: number;
};

export type HeroBanner = {
  id: string;
  image: HeroBannerImage;
  mobileImage?: HeroBannerImage;
  alt: string;
  href: string;
};

export type HomeCategoryCard = {
  id: string;
  title: string;
  href: string;
  imageSrc: string;
  alt: string;
};
