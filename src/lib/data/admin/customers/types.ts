export type CustomerAddress = {
  street: string;
  number: string;
  floorOrApartment?: string;
  postalCode: string;
  neighborhood?: string;
  city: string;
  provinceOrState: string;
  country: string;
};

export type CustomerLastOrder = {
  id: string;
  number: string;
  date: string;
  total: number;
};

export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  dniOrCuil?: string;
  firstInteractionDate: string;
  address?: CustomerAddress;
  notes?: string;
  isAnonymized: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSalesSummary = {
  totalSpent: number;
  ordersCount: number;
  lastOrder?: CustomerLastOrder;
};
