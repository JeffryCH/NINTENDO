import { ProductUnit } from "@/types/inventory";

export const DEFAULT_PRODUCT_UNIT: ProductUnit = "unit";

const PRODUCT_UNIT_DEFINITIONS: Record<
  ProductUnit,
  { label: string; plural: string }
> = {
  unit: { label: "Unidad", plural: "Unidades" },
  piece: { label: "Pieza", plural: "Piezas" },
  box: { label: "Caja", plural: "Cajas" },
  pair: { label: "Par", plural: "Pares" },
  kilogram: { label: "Kilogramo", plural: "Kilogramos" },
  gram: { label: "Gramo", plural: "Gramos" },
  liter: { label: "Litro", plural: "Litros" },
  milliliter: { label: "Mililitro", plural: "Mililitros" },
};

export const PRODUCT_UNITS: Array<{ value: ProductUnit; label: string }> =
  Object.entries(PRODUCT_UNIT_DEFINITIONS).map(([value, meta]) => ({
    value: value as ProductUnit,
    label: meta.label,
  }));

export const isValidProductUnit = (value: string): value is ProductUnit => {
  return value in PRODUCT_UNIT_DEFINITIONS;
};

export const normalizeProductUnit = (value?: string): ProductUnit => {
  if (!value) {
    return DEFAULT_PRODUCT_UNIT;
  }
  const normalized = value.trim().toLowerCase();
  return isValidProductUnit(normalized)
    ? (normalized as ProductUnit)
    : DEFAULT_PRODUCT_UNIT;
};

export const resolveProductUnitLabel = (unit: ProductUnit): string => {
  return (
    PRODUCT_UNIT_DEFINITIONS[unit]?.label ??
    PRODUCT_UNIT_DEFINITIONS[DEFAULT_PRODUCT_UNIT].label
  );
};

export const resolveProductUnitPluralLabel = (unit: ProductUnit): string => {
  return (
    PRODUCT_UNIT_DEFINITIONS[unit]?.plural ??
    PRODUCT_UNIT_DEFINITIONS[DEFAULT_PRODUCT_UNIT].plural
  );
};

export const resolveProductUnitLabelForQuantity = (
  unit: ProductUnit,
  quantity: number
): string => {
  return quantity === 1
    ? resolveProductUnitLabel(unit)
    : resolveProductUnitPluralLabel(unit);
};
