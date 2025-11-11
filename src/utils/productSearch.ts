import type { Product, Store } from "@/types/inventory";

type ProductWithStore = {
  product: Product;
  store: Store;
};

const normalizeText = (value?: string | null): string =>
  (value ?? "").trim().toLowerCase();

export const productMatchesQuery = (
  product: Product,
  query: string
): boolean => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return false;
  }

  const searchableFields = [
    product.name,
    product.description,
    product.barcodes?.upc,
    product.barcodes?.box,
  ]
    .map((field) => normalizeText(field))
    .filter((field) => field.length > 0);

  return searchableFields.some((field) => field.includes(normalizedQuery));
};

export const filterProductsByQuery = (
  products: Product[],
  query: string
): Product[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) => productMatchesQuery(product, query));
};

export const findProductsByBarcode = (
  products: Product[],
  code: string
): Product[] => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) {
    return [];
  }

  return products.filter((product) => {
    const upc = normalizeText(product.barcodes?.upc);
    const box = normalizeText(product.barcodes?.box);
    return upc === normalizedCode || box === normalizedCode;
  });
};

export const findStoreMatchesByBarcode = (
  products: Product[],
  stores: Store[],
  code: string
): ProductWithStore[] => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) {
    return [];
  }

  const matches: ProductWithStore[] = [];
  products.forEach((product) => {
    const upc = normalizeText(product.barcodes?.upc);
    const box = normalizeText(product.barcodes?.box);
    if (upc !== normalizedCode && box !== normalizedCode) {
      return;
    }
    const store = stores.find((candidate) => candidate.id === product.storeId);
    if (!store) {
      return;
    }
    matches.push({ product, store });
  });

  return matches;
};
