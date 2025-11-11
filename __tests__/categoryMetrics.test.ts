import { describe, it, expect } from "@jest/globals";
import { summarizeCategoryProducts } from "@/utils/categoryMetrics";
import type { Product } from "@/types/inventory";

const buildProduct = (overrides: Partial<Product> = {}): Product => {
  return {
    id: `prod-${Math.random().toString(36).slice(2)}`,
    storeId: overrides.storeId ?? "store-1",
    categoryId: overrides.categoryId ?? "category-1",
    name: overrides.name ?? "Producto de prueba",
    price: overrides.price ?? 100,
    previousPrice: overrides.previousPrice,
    priceUpdatedAt: overrides.priceUpdatedAt ?? new Date().toISOString(),
    priceHistory: overrides.priceHistory ?? [],
    stock: overrides.stock ?? 1,
    imageUrl: overrides.imageUrl,
    imageAsset: overrides.imageAsset,
    description: overrides.description,
    hasOffer: overrides.hasOffer ?? false,
    offerPrice: overrides.offerPrice,
    discountInfo: overrides.discountInfo,
    barcodes: overrides.barcodes,
  };
};

describe("summarizeCategoryProducts", () => {
  it("retorna métricas vacías cuando no hay productos", () => {
    const summary = summarizeCategoryProducts([]);
    expect(summary).toEqual({
      productCount: 0,
      totalStock: 0,
      totalValue: 0,
      offerCount: 0,
      lowStockCount: 0,
    });
  });

  it("calcula métricas acumuladas incluyendo ofertas", () => {
    const products: Product[] = [
      buildProduct({ stock: 4, price: 200 }),
      buildProduct({ stock: 2, price: 150, hasOffer: true, offerPrice: 120 }),
      buildProduct({ stock: 1, price: 80, hasOffer: true, offerPrice: 70 }),
    ];

    const summary = summarizeCategoryProducts(products);

    expect(summary.productCount).toBe(3);
    expect(summary.totalStock).toBe(7);
    expect(summary.offerCount).toBe(2);
    expect(summary.lowStockCount).toBe(2);
    expect(summary.totalValue).toBe(4 * 200 + 2 * 120 + 1 * 70);
  });

  it("suma correctamente cuando los productos están sin oferta", () => {
    const products: Product[] = [
      buildProduct({ stock: 10, price: 99.99 }),
      buildProduct({ stock: 5, price: 49.5 }),
    ];

    const summary = summarizeCategoryProducts(products);

    expect(summary.offerCount).toBe(0);
    expect(summary.totalValue).toBeCloseTo(10 * 99.99 + 5 * 49.5, 2);
  });
});
