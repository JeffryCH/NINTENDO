export type UUID = string;

export type MediaSourceType = "url" | "camera" | "library";

export type ProductUnit =
  | "unit"
  | "piece"
  | "box"
  | "pair"
  | "kilogram"
  | "gram"
  | "liter"
  | "milliliter";

export interface ProductChangeLogEntry {
  id: UUID;
  productId: UUID;
  performedAt: string;
  summary: string;
  changes: string[];
}

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
  unit: ProductUnit;
  templateId?: UUID;
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
  changeLog: ProductChangeLogEntry[];
}

export interface ProductTemplate {
  id: UUID;
  name: string;
  unit: ProductUnit;
  categoryName?: string;
  basePrice: number;
  masterSku: string;
  associatedUpcCodes: string[];
  imageUrl?: string;
  imageAsset?: MediaAsset;
  description?: string;
  barcodes?: ProductBarcodes;
  sourceStoreId?: UUID;
  sourceStoreName?: string;
  storeReferences: ProductTemplateStoreReference[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface ProductTemplateStoreReference {
  storeId: UUID;
  storeName?: string;
  upc?: string;
  box?: string;
  lastSeenAt: string;
}

export interface OfferSummary {
  productId: UUID;
  active: boolean;
  offerPrice?: number;
}

export type InventoryMovementKind = "increase" | "decrease" | "initial";

export type InventoryMovementReason =
  | "restock"
  | "sale"
  | "manual-adjust"
  | "transfer"
  | "initial-load";

export interface InventoryMovement {
  id: UUID;
  productId: UUID;
  storeId: UUID;
  delta: number;
  quantity: number;
  kind: InventoryMovementKind;
  reason: InventoryMovementReason;
  previousStock: number;
  resultingStock: number;
  note?: string;
  createdAt: string;
  synced: boolean;
}
