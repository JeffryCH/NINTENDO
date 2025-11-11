import { describe, it, expect } from "@jest/globals";
import type { Product, ProductPriceSnapshot, Store } from "@/types/inventory";
import {
  filterProductsByQuery,
  findProductsByBarcode,
  findStoreMatchesByBarcode,
  productMatchesQuery,
} from "@/utils/productSearch";
import { DEFAULT_PRODUCT_UNIT } from "@/utils/productUnits";

const createSnapshot = (price: number): ProductPriceSnapshot => ({
  price,
  recordedAt: new Date().toISOString(),
});

const makeProduct = (overrides: Partial<Product>): Product => {
  const price = overrides.price ?? 100;
  return {
    id: overrides.id ?? "product-1",
    storeId: overrides.storeId ?? "store-1",
    categoryId: overrides.categoryId ?? "category-1",
    name: overrides.name ?? "Joy-Con Azul",
    unit: overrides.unit ?? DEFAULT_PRODUCT_UNIT,
    price,
    previousPrice: overrides.previousPrice,
    priceUpdatedAt: overrides.priceUpdatedAt ?? new Date().toISOString(),
    priceHistory: overrides.priceHistory ?? [createSnapshot(price)],
    stock: overrides.stock ?? 5,
    imageUrl: overrides.imageUrl,
    imageAsset: overrides.imageAsset,
    description: overrides.description,
    hasOffer: overrides.hasOffer ?? false,
    offerPrice: overrides.offerPrice,
    discountInfo: overrides.discountInfo,
    barcodes: overrides.barcodes,
    changeLog: overrides.changeLog ?? [],
  };
};

const makeStore = (overrides: Partial<Store>): Store => ({
  id: overrides.id ?? "store-1",
  name: overrides.name ?? "Nintendo Store CDMX",
  location: overrides.location ?? "CDMX",
  description: overrides.description,
  imageUrl: overrides.imageUrl,
  imageAsset: overrides.imageAsset,
});

describe("productSearch utils", () => {
  it("HU-11 filtra productos por nombre", () => {
    const products = [
      makeProduct({ id: "p-1", name: "Galletas de Vainilla" }),
      makeProduct({ id: "p-2", name: "Chocolate Amargo" }),
    ];

    const result = filterProductsByQuery(products, "vaini");
    expect(result.map((item) => item.id)).toEqual(["p-1"]);
  });

  it("HU-11 filtra productos por código de barras", () => {
    const products = [
      makeProduct({
        id: "p-1",
        name: "Control Pro",
        barcodes: { upc: "750100000001" },
      }),
      makeProduct({
        id: "p-2",
        name: "Funda Switch",
        barcodes: { box: "ABC-123" },
      }),
    ];

    const result = filterProductsByQuery(products, "750100000001");
    expect(result.map((item) => item.id)).toEqual(["p-1"]);
  });

  it("HU-11 retorna lista vacía cuando no hay coincidencias", () => {
    const products = [makeProduct({ id: "p-1", name: "Mario Kart" })];
    const result = filterProductsByQuery(products, "XYZ");
    expect(result).toHaveLength(0);
  });

  it("HU-11 encuentra productos exactos por código", () => {
    const products = [
      makeProduct({
        id: "p-1",
        name: "Nintendo Switch",
        barcodes: { upc: "123456789012" },
      }),
      makeProduct({
        id: "p-2",
        name: "Nintendo Switch Lite",
        barcodes: { box: "BOX-9988" },
      }),
    ];

    const matches = findProductsByBarcode(products, "box-9988");
    expect(matches.map((item) => item.id)).toEqual(["p-2"]);
  });

  it("HU-11 incluye datos de tienda en coincidencias por código", () => {
    const products = [
      makeProduct({
        id: "p-1",
        name: "Amiibo Pikachu",
        storeId: "store-a",
        barcodes: { upc: "750100000002" },
      }),
    ];
    const stores = [makeStore({ id: "store-a", name: "Nintendo Experience" })];

    const matches = findStoreMatchesByBarcode(products, stores, "750100000002");

    expect(matches).toHaveLength(1);
    expect(matches[0].store.name).toBe("Nintendo Experience");
    expect(matches[0].product.id).toBe("p-1");
  });

  it("HU-11 no considera consultas vacías", () => {
    const product = makeProduct({ id: "p-1" });
    expect(productMatchesQuery(product, "")).toBe(false);
    expect(filterProductsByQuery([product], "")).toEqual([product]);
  });
});
