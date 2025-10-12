export type UUID = string;

export type MediaSourceType = "url" | "camera" | "library";

export interface MediaAsset {
  uri: string;
  type: MediaSourceType;
  thumbnailUri?: string;
}

export interface Store {
  id: UUID;
  name: string;
  location: string;
  description?: string;
  imageUrl?: string;
  imageAsset?: MediaAsset;
}

export interface Category {
  id: UUID;
  storeId: UUID;
  name: string;
  description?: string;
}

export interface ProductBarcodes {
  upc?: string;
  box?: string;
}

export interface ProductPriceSnapshot {
  price: number;
  offerPrice?: number;
  recordedAt: string;
}

export interface ProductDiscountInfo {
  zeroInterestMonths?: number;
  cashOnly?: boolean;
  expiresAt?: string | null;
  hasExpiration?: boolean;
}

export interface Product {
  id: UUID;
  storeId: UUID;
  categoryId: UUID;
  name: string;
  price: number;
  previousPrice?: number;
  priceUpdatedAt: string;
  priceHistory: ProductPriceSnapshot[];
  stock: number;
  imageUrl?: string;
  imageAsset?: MediaAsset;
  description?: string;
  hasOffer: boolean;
  offerPrice?: number;
  discountInfo?: ProductDiscountInfo;
  barcodes?: ProductBarcodes;
}

export interface OfferSummary {
  productId: UUID;
  active: boolean;
  offerPrice?: number;
}
