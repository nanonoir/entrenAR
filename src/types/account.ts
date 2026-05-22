export type AccountNavItem = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type MockAccountUser = {
  email: string;
  name: string;
};

export type AccountSection =
  | "perfil"
  | "direcciones"
  | "pedidos"
  | "metodos-de-pago"
  | "lista-de-deseados"
  | "autenticacion";

export type AccountProfile = {
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  gender: string;
  birthDate: string;
  phone: string;
};

export type AccountAddress = {
  id: string;
  label: string;
  recipient: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
};

export type AccountOrderStatus = "preparacion" | "en-camino" | "entregado";

export type AccountOrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
};

export type AccountOrder = {
  id: string;
  date: string;
  status: AccountOrderStatus;
  total: number;
  trackingCode: string;
  items: AccountOrderItem[];
};

export type WishlistProductId = string;
