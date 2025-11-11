import type { Product } from "@/types/inventory";

export interface CategoryMetricsSummary {
  productCount: number;
  totalStock: number;
  totalValue: number;
  offerCount: number;
  lowStockCount: number;
}

const initialMetrics: CategoryMetricsSummary = {
  productCount: 0,
  totalStock: 0,
  totalValue: 0,
  offerCount: 0,
  lowStockCount: 0,
};

export const summarizeCategoryProducts = (
  products: Product[]
): CategoryMetricsSummary => {
  if (products.length === 0) {
    return { ...initialMetrics };
  }

  return products.reduce<CategoryMetricsSummary>(
    (acc, product) => {
      const hasOffer = Boolean(
        product.hasOffer && product.offerPrice !== undefined
      );
      const effectivePrice =
        hasOffer && product.offerPrice !== undefined
          ? product.offerPrice
          : product.price;

      const lowStock = product.stock <= 3 ? 1 : 0;

      return {
        productCount: acc.productCount + 1,
        totalStock: acc.totalStock + product.stock,
        totalValue: acc.totalValue + product.stock * effectivePrice,
        offerCount: acc.offerCount + (hasOffer ? 1 : 0),
        lowStockCount: acc.lowStockCount + lowStock,
      };
    },
    { ...initialMetrics }
  );
};
