export interface CustomerAddress {
  street: string;
  number: string;
  floorOrApartment?: string;
  postalCode: string;
  neighborhood?: string;
  city: string;
  provinceOrState: string;
  country: string;
}

export interface CustomerLastOrder {
  id: string;
  number: string;
  date: string;
  total: number;
}

export interface Customer {
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
  tags?: string[];
  summary?: CustomerSalesSummary;
}

export interface CustomerSalesSummary {
  totalSpent: number;
  ordersCount: number;
  lastOrder?: CustomerLastOrder;
}
