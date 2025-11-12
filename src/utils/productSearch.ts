import type {
  Product,
  ProductTemplate,
  ProductTemplateStoreReference,
  Store,
} from "@/types/inventory";

interface ProductSearchOptions {
  templates?: ProductTemplate[];
  templateIndex?: Map<string, ProductTemplate>;
}

type ProductWithStore = {
  product: Product;
  store: Store;
};

const normalizeText = (value?: string | null): string =>
  (value ?? "").trim().toLowerCase();

const buildTemplateIndex = (
  options?: ProductSearchOptions
): Map<string, ProductTemplate> | undefined => {
  if (!options) {
    return undefined;
  }

  if (options.templateIndex) {
    return options.templateIndex;
  }

  if (!options.templates || options.templates.length === 0) {
    return undefined;
  }

  const index = new Map<string, ProductTemplate>();
  options.templates.forEach((template) => {
    index.set(template.id, template);
  });
  return index;
};

const collectReferenceCodes = (
  references: ProductTemplateStoreReference[]
): string[] => {
  const normalized = references
    .flatMap((reference) => [reference.box, reference.upc])
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
};

const collectTemplateCodes = (template?: ProductTemplate): string[] => {
  if (!template) {
    return [];
  }

  const pool: Array<string | undefined> = [
    template.masterSku,
    template.barcodes?.box,
    template.barcodes?.upc,
    ...template.associatedUpcCodes,
  ];

  const referenceCodes = collectReferenceCodes(template.storeReferences);
  referenceCodes.forEach((code) => {
    pool.push(code);
  });

  const normalized = pool
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
};

const collectProductCodes = (
  product: Product,
  template?: ProductTemplate
): string[] => {
  const pool: Array<string | undefined> = [
    product.barcodes?.box,
    product.barcodes?.upc,
  ];

  collectTemplateCodes(template).forEach((code) => {
    pool.push(code);
  });

  const normalized = pool
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
};

export const productMatchesQuery = (
  product: Product,
  query: string,
  options?: ProductSearchOptions
): boolean => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return false;
  }

  const templateIndex = buildTemplateIndex(options);
  const template = product.templateId
    ? templateIndex?.get(product.templateId)
    : undefined;

  const searchableFields = [
    product.name,
    product.description,
    ...collectProductCodes(product, template),
  ]
    .map((field) => normalizeText(field))
    .filter((field) => field.length > 0);

  return searchableFields.some((field) => field.includes(normalizedQuery));
};

export const filterProductsByQuery = (
  products: Product[],
  query: string,
  options?: ProductSearchOptions
): Product[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return products;
  }

  return products.filter((product) =>
    productMatchesQuery(product, query, options)
  );
};

export const findProductsByBarcode = (
  products: Product[],
  code: string,
  options?: ProductSearchOptions
): Product[] => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) {
    return [];
  }

  const templateIndex = buildTemplateIndex(options);

  return products.filter((product) => {
    const template = product.templateId
      ? templateIndex?.get(product.templateId)
      : undefined;
    const codes = collectProductCodes(product, template);
    return codes.includes(normalizedCode);
  });
};

export const findStoreMatchesByBarcode = (
  products: Product[],
  stores: Store[],
  code: string,
  options?: ProductSearchOptions
): ProductWithStore[] => {
  const normalizedCode = normalizeText(code);
  if (!normalizedCode) {
    return [];
  }

  const templateIndex = buildTemplateIndex(options);
  const matches: ProductWithStore[] = [];
  const seenProducts = new Set<string>();

  const appendProduct = (product: Product) => {
    if (seenProducts.has(product.id)) {
      return;
    }
    const store = stores.find((candidate) => candidate.id === product.storeId);
    if (!store) {
      return;
    }
    seenProducts.add(product.id);
    matches.push({ product, store });
  };

  products.forEach((product) => {
    const template = product.templateId
      ? templateIndex?.get(product.templateId)
      : undefined;
    const codes = collectProductCodes(product, template);
    if (!codes.includes(normalizedCode)) {
      return;
    }
    appendProduct(product);
  });

  if (templateIndex) {
    templateIndex.forEach((template) => {
      const templateCodes = collectTemplateCodes(template);
      if (!templateCodes.includes(normalizedCode)) {
        return;
      }

      products.forEach((product) => {
        if (product.templateId !== template.id) {
          return;
        }
        appendProduct(product);
      });
    });
  }

  return matches;
};
