export type UUID = string;

export interface Store {
  id: UUID;
  name: string;
  location: string;
  description?: string;
  imageUrl?: string;
}

export interface Category {
  id: UUID;
  storeId: UUID;
  name: string;
  description?: string;
}

export interface Product {
  id: UUID;
  storeId: UUID;
  categoryId: UUID;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  description?: string;
  hasOffer: boolean;
  offerPrice?: number;
}

export interface OfferSummary {
  productId: UUID;
  active: boolean;
  offerPrice?: number;
}
