import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  Store,
  Category,
  Product,
  ProductBarcodes,
  ProductDiscountInfo,
  MediaAsset,
  ProductPriceSnapshot,
  ProductTemplate,
  ProductTemplateStoreReference,
  ProductUnit,
  ProductChangeLogEntry,
  InventoryMovement,
  InventoryMovementReason,
  InventoryMovementKind,
} from "@/types/inventory";
import { generateId } from "@/utils/id";
import {
  DEFAULT_PRODUCT_UNIT,
  normalizeProductUnit,
  resolveProductUnitLabel,
  resolveProductUnitLabelForQuantity,
} from "@/utils/productUnits";

const STORAGE_KEY = "nintendo-inventory-state";
export const INVENTORY_STORAGE_KEY = STORAGE_KEY;
const CURRENT_SCHEMA_VERSION = 7;
const MAX_PRICE_HISTORY = 120;
const MAX_CHANGE_LOG_ENTRIES = 50;

const formatCurrency = (value: number): string => `$${value.toFixed(2)}`;

const createSnapshot = (
  price: number,
  offerPrice?: number
): ProductPriceSnapshot[] => [
  {
    price,
    offerPrice,
    recordedAt: new Date().toISOString(),
  },
];

const normalizeMediaAsset = (asset?: MediaAsset): MediaAsset | undefined => {
  if (!asset || !asset.uri) {
    return undefined;
  }
  return {
    uri: asset.uri,
    type: asset.type,
    thumbnailUri: asset.thumbnailUri,
  };
};

const sanitizeCodeValue = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toUpperCase();
};

const dedupeCodes = (values: (string | undefined)[]): string[] => {
  const seen = new Set<string>();
  values.forEach((item) => {
    const normalized = sanitizeCodeValue(item);
    if (normalized) {
      seen.add(normalized);
    }
  });
  return Array.from(seen.values());
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return dedupeCodes(value as (string | undefined)[]);
};

const normalizeTemplateStoreReferences = (
  value: unknown
): ProductTemplateStoreReference[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const references: ProductTemplateStoreReference[] = [];

  value.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const raw = entry as Partial<ProductTemplateStoreReference> & {
      lastSeenAt?: string;
    };

    const storeId =
      typeof raw.storeId === "string" && raw.storeId.trim()
        ? raw.storeId.trim()
        : undefined;

    if (!storeId) {
      return;
    }

    const upc = sanitizeCodeValue(raw.upc);
    const box = sanitizeCodeValue(raw.box);
    const storeName =
      typeof raw.storeName === "string" && raw.storeName.trim()
        ? raw.storeName.trim()
        : undefined;

    const lastSeenAt =
      typeof raw.lastSeenAt === "string" && raw.lastSeenAt
        ? raw.lastSeenAt
        : new Date().toISOString();

    references.push({
      storeId,
      storeName,
      upc,
      box,
      lastSeenAt,
    });
  });

  return references;
};

const normalizeBarcodes = (
  value?: ProductBarcodes
): ProductBarcodes | undefined => {
  if (!value) return undefined;
  const box = sanitizeCodeValue(value.box);
  const upc = sanitizeCodeValue(value.upc);
  if (!box && !upc) return undefined;
  return { box, upc };
};

const normalizeDiscountInfo = (
  value?: ProductDiscountInfo
): ProductDiscountInfo | undefined => {
  if (!value) return undefined;

  const zeroInterestMonths =
    typeof value.zeroInterestMonths === "number" && value.zeroInterestMonths > 0
      ? value.zeroInterestMonths
      : undefined;

  const hasExpiration =
    value.hasExpiration !== undefined
      ? value.hasExpiration
      : value.expiresAt !== undefined && value.expiresAt !== null;

  const expiresAtCandidate = hasExpiration ? value.expiresAt ?? null : null;
  const expiresAt =
    typeof expiresAtCandidate === "string"
      ? expiresAtCandidate.trim() || null
      : expiresAtCandidate;

  return {
    zeroInterestMonths,
    cashOnly: Boolean(value.cashOnly),
    hasExpiration,
    expiresAt,
  };
};

const normalizeTemplate = (raw: any): ProductTemplate | null => {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : null;
  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "";
  const basePriceCandidate = Number(raw.basePrice ?? raw.price ?? 0);

  if (
    !id ||
    !name ||
    Number.isNaN(basePriceCandidate) ||
    basePriceCandidate <= 0
  ) {
    return null;
  }

  const categoryName =
    typeof raw.categoryName === "string" && raw.categoryName.trim()
      ? raw.categoryName.trim()
      : undefined;
  const sourceStoreId =
    typeof raw.sourceStoreId === "string" && raw.sourceStoreId.trim()
      ? raw.sourceStoreId.trim()
      : undefined;
  const sourceStoreName =
    typeof raw.sourceStoreName === "string" && raw.sourceStoreName.trim()
      ? raw.sourceStoreName.trim()
      : undefined;

  const unit = normalizeProductUnit(
    typeof raw.unit === "string" ? raw.unit : undefined
  );

  const normalizedBarcodes = normalizeBarcodes(raw.barcodes);
  const masterSkuCandidate = sanitizeCodeValue(
    typeof raw.masterSku === "string" ? raw.masterSku : undefined
  );
  const masterSku =
    masterSkuCandidate ??
    normalizedBarcodes?.box ??
    sanitizeCodeValue(
      typeof (raw as { catalogSku?: string }).catalogSku === "string"
        ? (raw as { catalogSku?: string }).catalogSku
        : undefined
    ) ??
    sanitizeCodeValue(normalizedBarcodes?.upc) ??
    id;

  let associatedUpcCodes = normalizeStringArray(raw.associatedUpcCodes);
  if (normalizedBarcodes?.upc) {
    associatedUpcCodes = dedupeCodes([
      ...associatedUpcCodes,
      normalizedBarcodes.upc,
    ]);
  }

  let storeReferences = normalizeTemplateStoreReferences(raw.storeReferences);
  if (
    storeReferences.length === 0 &&
    sourceStoreId &&
    (normalizedBarcodes?.upc || normalizedBarcodes?.box)
  ) {
    storeReferences = [
      {
        storeId: sourceStoreId,
        storeName: sourceStoreName,
        upc: normalizedBarcodes?.upc,
        box: normalizedBarcodes?.box ?? masterSku ?? undefined,
        lastSeenAt: new Date().toISOString(),
      },
    ];
  }

  const resolvedBarcodes = normalizedBarcodes
    ? {
        ...normalizedBarcodes,
        box: normalizeBarcodes({ box: masterSku, upc: normalizedBarcodes.upc })
          ?.box,
      }
    : masterSku
    ? { box: masterSku }
    : undefined;

  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt
      ? raw.updatedAt
      : createdAt;
  const lastUsedAt =
    typeof raw.lastUsedAt === "string" && raw.lastUsedAt
      ? raw.lastUsedAt
      : undefined;

  return {
    id,
    name,
    unit,
    categoryName,
    basePrice: basePriceCandidate,
    masterSku: masterSku ?? id,
    associatedUpcCodes,
    imageUrl:
      typeof raw.imageUrl === "string" && raw.imageUrl.trim()
        ? raw.imageUrl.trim()
        : undefined,
    imageAsset: normalizeMediaAsset(raw.imageAsset),
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : undefined,
    barcodes: resolvedBarcodes,
    sourceStoreId,
    sourceStoreName,
    storeReferences: storeReferences.map((reference) => ({
      ...reference,
      box: reference.box ?? masterSku ?? undefined,
    })),
    createdAt,
    updatedAt,
    lastUsedAt,
  };
};

const createTemplateFromProduct = (
  product: Product,
  category?: Category | null,
  store?: Store | null
): ProductTemplate => {
  const now = new Date().toISOString();
  const masterSku =
    sanitizeCodeValue(product.barcodes?.box) ??
    sanitizeCodeValue(product.barcodes?.upc) ??
    product.id;
  const associatedUpcCodes = product.barcodes?.upc
    ? [sanitizeCodeValue(product.barcodes.upc)!]
    : [];
  const storeReferences: ProductTemplateStoreReference[] = store
    ? [
        {
          storeId: store.id,
          storeName: store.name,
          upc: sanitizeCodeValue(product.barcodes?.upc),
          box: masterSku,
          lastSeenAt: now,
        },
      ]
    : [];
  return {
    id: generateId("template"),
    name: product.name,
    unit: product.unit,
    categoryName: category?.name,
    basePrice: product.price,
    masterSku,
    associatedUpcCodes,
    imageUrl: product.imageUrl,
    imageAsset: product.imageAsset,
    description: product.description,
    barcodes: normalizeBarcodes({ box: masterSku, upc: product.barcodes?.upc }),
    sourceStoreId: store?.id,
    sourceStoreName: store?.name,
    storeReferences,
    createdAt: now,
    updatedAt: now,
  };
};

const inferMovementKind = (delta: number): InventoryMovementKind => {
  if (delta > 0) return "increase";
  if (delta < 0) return "decrease";
  return "initial";
};

const deriveMovementReason = (
  delta: number,
  provided?: InventoryMovementReason
): InventoryMovementReason => {
  if (provided) return provided;
  if (delta > 0) return "restock";
  if (delta < 0) return "sale";
  return "manual-adjust";
};

const createMovementRecord = (params: {
  product: Product;
  delta: number;
  previousStock: number;
  reason?: InventoryMovementReason;
  note?: string;
  kind?: InventoryMovementKind;
  synced?: boolean;
}): InventoryMovement => {
  const delta = Math.trunc(params.delta);
  const quantity = Math.abs(delta);
  const previousStock = Math.max(0, Math.trunc(params.previousStock));
  const resultingStock = previousStock + delta;
  const kind = params.kind ?? inferMovementKind(delta);
  const reason = deriveMovementReason(delta, params.reason);
  const note = params.note?.trim() || undefined;

  return {
    id: generateId("movement"),
    productId: params.product.id,
    storeId: params.product.storeId,
    delta,
    quantity,
    kind,
    reason,
    previousStock,
    resultingStock,
    note,
    createdAt: new Date().toISOString(),
    synced: params.synced ?? false,
  };
};

const createInitialMovementRecord = (
  product: Product,
  synced = true
): InventoryMovement | null => {
  if (product.stock <= 0) {
    return null;
  }

  return createMovementRecord({
    product,
    delta: product.stock,
    previousStock: 0,
    reason: "initial-load",
    note: "Stock inicial al registrar producto",
    kind: "increase",
    synced,
  });
};

const createProductCreationChangeLogEntry = (
  product: Product
): ProductChangeLogEntry => {
  const unitLabel = resolveProductUnitLabelForQuantity(
    product.unit,
    product.stock
  ).toLowerCase();
  const changes: string[] = [
    `Precio base: ${formatCurrency(product.price)}`,
    `Stock inicial: ${product.stock} ${unitLabel}`,
  ];

  if (product.hasOffer && product.offerPrice !== undefined) {
    changes.push(`Oferta inicial: ${formatCurrency(product.offerPrice)}`);
  }

  return {
    id: generateId("chg"),
    productId: product.id,
    performedAt: new Date().toISOString(),
    summary: "Producto registrado en inventario",
    changes,
  };
};

const toTemplateKey = (input: {
  name: string;
  barcodes?: ProductBarcodes;
  masterSku?: string;
}): string => {
  const master = sanitizeCodeValue(
    input.masterSku ?? input.barcodes?.box ?? undefined
  );
  if (master) {
    return master;
  }
  const upc = sanitizeCodeValue(input.barcodes?.upc);
  if (upc) {
    return `${input.name.trim().toLowerCase()}|${upc}`;
  }
  return input.name.trim().toLowerCase();
};

const appendSnapshot = (
  history: ProductPriceSnapshot[],
  snapshot: ProductPriceSnapshot
): ProductPriceSnapshot[] => {
  const next = [...history, snapshot];
  if (next.length > MAX_PRICE_HISTORY) {
    return next.slice(next.length - MAX_PRICE_HISTORY);
  }
  return next;
};

const normalizeStore = (raw: any): Store | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? "");
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const location = typeof raw.location === "string" ? raw.location.trim() : "";

  if (!id || !name || !location) {
    return null;
  }

  return {
    id,
    name,
    location,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : undefined,
    imageUrl:
      typeof raw.imageUrl === "string" && raw.imageUrl.trim()
        ? raw.imageUrl.trim()
        : undefined,
    imageAsset: normalizeMediaAsset(raw.imageAsset),
  };
};

const normalizeCategory = (raw: any): Category | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? "");
  const storeId =
    typeof raw.storeId === "string" ? raw.storeId : String(raw.storeId ?? "");
  const name = typeof raw.name === "string" ? raw.name.trim() : "";

  if (!id || !storeId || !name) {
    return null;
  }

  return {
    id,
    storeId,
    name,
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : undefined,
  };
};

const normalizeChangeLogEntry = (
  raw: any,
  productId: string
): ProductChangeLogEntry | null => {
  if (!raw || typeof raw !== "object") return null;

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : "";

  if (!summary) {
    return null;
  }

  const changes = Array.isArray(raw.changes)
    ? raw.changes
        .map((change: any) =>
          typeof change === "string" && change.trim() ? change.trim() : null
        )
        .filter((item: string | null): item is string => Boolean(item))
    : [];

  const performedAt =
    typeof raw.performedAt === "string" && raw.performedAt
      ? raw.performedAt
      : new Date().toISOString();

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : generateId("chg");

  return {
    id,
    productId,
    performedAt,
    summary,
    changes,
  };
};

const trimChangeLogEntries = (
  entries: ProductChangeLogEntry[]
): ProductChangeLogEntry[] =>
  entries.length > MAX_CHANGE_LOG_ENTRIES
    ? entries.slice(entries.length - MAX_CHANGE_LOG_ENTRIES)
    : entries;

const normalizeProductRecord = (raw: any): Product | null => {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? "");
  const storeId =
    typeof raw.storeId === "string" ? raw.storeId : String(raw.storeId ?? "");
  const categoryId =
    typeof raw.categoryId === "string"
      ? raw.categoryId
      : String(raw.categoryId ?? "");
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const price = Number(raw.price ?? 0);
  const stock = Math.max(0, Math.floor(Number(raw.stock ?? 0)));

  if (!id || !storeId || !categoryId || !name || Number.isNaN(price)) {
    return null;
  }

  const baseHistory: ProductPriceSnapshot[] = Array.isArray(raw.priceHistory)
    ? raw.priceHistory
        .map((entry: any): ProductPriceSnapshot | null => {
          if (!entry || typeof entry !== "object") return null;
          const recordPrice = Number(entry.price ?? price);
          if (Number.isNaN(recordPrice)) return null;
          const offer =
            entry.offerPrice !== undefined && entry.offerPrice !== null
              ? Number(entry.offerPrice)
              : undefined;
          return {
            price: recordPrice,
            offerPrice:
              offer !== undefined && !Number.isNaN(offer) ? offer : undefined,
            recordedAt:
              typeof entry.recordedAt === "string"
                ? entry.recordedAt
                : new Date().toISOString(),
          };
        })
        .filter(
          (item: ProductPriceSnapshot | null): item is ProductPriceSnapshot =>
            Boolean(item)
        )
    : [];

  const hasOfferInput = Boolean(raw.hasOffer && raw.offerPrice !== undefined);
  const offerPriceCandidate =
    hasOfferInput && raw.offerPrice !== undefined
      ? Number(raw.offerPrice)
      : undefined;
  const offerPrice =
    offerPriceCandidate !== undefined && !Number.isNaN(offerPriceCandidate)
      ? offerPriceCandidate
      : undefined;
  const hasOffer = Boolean(offerPrice !== undefined && hasOfferInput);

  const fallbackSnapshot: ProductPriceSnapshot = {
    price,
    offerPrice: hasOffer ? offerPrice : undefined,
    recordedAt:
      typeof raw.priceUpdatedAt === "string"
        ? raw.priceUpdatedAt
        : new Date().toISOString(),
  };

  const history = baseHistory.length > 0 ? baseHistory : [fallbackSnapshot];

  const priceUpdatedAt =
    typeof raw.priceUpdatedAt === "string"
      ? raw.priceUpdatedAt
      : history[history.length - 1].recordedAt;

  const previousPriceRaw = Number(raw.previousPrice);
  const previousPrice = !Number.isNaN(previousPriceRaw)
    ? previousPriceRaw
    : history.length > 1
    ? history[history.length - 2].price
    : undefined;

  const unit = normalizeProductUnit(
    typeof raw.unit === "string" ? raw.unit : undefined
  );

  const changeLogEntries = Array.isArray(raw.changeLog)
    ? raw.changeLog
        .map((entry: any) => normalizeChangeLogEntry(entry, id))
        .filter(
          (
            entry: ProductChangeLogEntry | null
          ): entry is ProductChangeLogEntry => entry !== null
        )
    : [];

  const changeLog = trimChangeLogEntries(changeLogEntries);
  const templateId =
    typeof raw.templateId === "string" && raw.templateId.trim()
      ? raw.templateId.trim()
      : undefined;

  return {
    id,
    storeId,
    categoryId,
    name,
    unit,
    templateId,
    price,
    previousPrice,
    priceUpdatedAt,
    priceHistory: history.slice(-MAX_PRICE_HISTORY),
    stock,
    imageUrl:
      typeof raw.imageUrl === "string" && raw.imageUrl.trim()
        ? raw.imageUrl.trim()
        : undefined,
    imageAsset: normalizeMediaAsset(raw.imageAsset),
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : undefined,
    hasOffer,
    offerPrice: hasOffer ? offerPrice : undefined,
    discountInfo: normalizeDiscountInfo(raw.discountInfo),
    barcodes: normalizeBarcodes(raw.barcodes),
    changeLog,
  };
};

const normalizeInventoryMovement = (raw: any): InventoryMovement | null => {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : String(raw.id ?? "");
  const productId =
    typeof raw.productId === "string"
      ? raw.productId
      : String(raw.productId ?? "");
  const storeId =
    typeof raw.storeId === "string" ? raw.storeId : String(raw.storeId ?? "");

  if (!id || !productId || !storeId) {
    return null;
  }

  const delta = Number(raw.delta ?? 0);
  if (!Number.isFinite(delta)) {
    return null;
  }

  const quantityCandidate = Number(raw.quantity ?? Math.abs(delta));
  const quantity = Math.max(0, Math.abs(Math.trunc(quantityCandidate)));

  const previousStockCandidate = Number(raw.previousStock ?? 0);
  const previousStock = Number.isFinite(previousStockCandidate)
    ? Math.trunc(previousStockCandidate)
    : 0;
  const resultingCandidate = Number(
    raw.resultingStock ?? previousStock + delta
  );
  const resultingStock = Number.isFinite(resultingCandidate)
    ? Math.trunc(resultingCandidate)
    : previousStock + delta;

  const kindCandidate = typeof raw.kind === "string" ? raw.kind : "";
  const kind: InventoryMovementKind =
    kindCandidate === "increase" ||
    kindCandidate === "decrease" ||
    kindCandidate === "initial"
      ? (kindCandidate as InventoryMovementKind)
      : inferMovementKind(delta);

  const reasonCandidate = typeof raw.reason === "string" ? raw.reason : "";
  const validReasons: InventoryMovementReason[] = [
    "restock",
    "sale",
    "manual-adjust",
    "transfer",
    "initial-load",
  ];
  const reason = validReasons.includes(
    reasonCandidate as InventoryMovementReason
  )
    ? (reasonCandidate as InventoryMovementReason)
    : deriveMovementReason(delta);

  const note =
    typeof raw.note === "string" && raw.note.trim()
      ? raw.note.trim()
      : undefined;
  const createdAt =
    typeof raw.createdAt === "string" && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString();
  const synced = typeof raw.synced === "boolean" ? raw.synced : true;

  return {
    id,
    productId,
    storeId,
    delta,
    quantity,
    kind,
    reason,
    previousStock,
    resultingStock,
    note,
    createdAt,
    synced,
  };
};

const upgradePersistedInventory = (
  input: unknown
): PersistedInventory | null => {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Partial<PersistedInventory> & {
    stores?: unknown;
    categories?: unknown;
    products?: unknown;
    productTemplates?: unknown;
    inventoryMovements?: unknown;
  };

  const normalizeCollection = <T>(
    source: unknown,
    normalizer: (value: any) => T | null,
    fallback: T[]
  ): T[] => {
    if (!Array.isArray(source)) {
      return fallback;
    }
    const next = source
      .map((item) => normalizer(item))
      .filter((item: T | null): item is T => item !== null);
    if (source.length > 0 && next.length === 0) {
      return fallback;
    }
    return next;
  };

  const stores = normalizeCollection(
    raw.stores,
    normalizeStore,
    INITIAL_STORES
  );
  const categories = normalizeCollection(
    raw.categories,
    normalizeCategory,
    INITIAL_CATEGORIES
  );
  const products = normalizeCollection(
    raw.products,
    normalizeProductRecord,
    INITIAL_PRODUCTS
  );

  let productTemplates = normalizeCollection(
    raw.productTemplates,
    normalizeTemplate,
    []
  );

  if (productTemplates.length === 0) {
    const derived = products.map((product) =>
      createTemplateFromProduct(
        product,
        categories.find((category) => category.id === product.categoryId) ??
          null,
        stores.find((store) => store.id === product.storeId) ?? null
      )
    );
    productTemplates = derived.length > 0 ? derived : INITIAL_PRODUCT_TEMPLATES;
  }

  let inventoryMovements = normalizeCollection(
    raw.inventoryMovements,
    normalizeInventoryMovement,
    INITIAL_INVENTORY_MOVEMENTS
  );

  if (inventoryMovements.length === 0) {
    const derivedMovements = products
      .map((product) => createInitialMovementRecord(product))
      .filter((movement): movement is InventoryMovement => movement !== null);
    inventoryMovements =
      derivedMovements.length > 0
        ? derivedMovements
        : INITIAL_INVENTORY_MOVEMENTS;
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    stores,
    categories,
    products,
    productTemplates,
    inventoryMovements,
  };
};

const INITIAL_STORES: Store[] = [
  {
    id: "store-cdmx",
    name: "Nintendo Store CDMX",
    location: "Centro Comercial Miyana, CDMX",
    description:
      "Tienda insignia con lanzamientos exclusivos y experiencias de fans.",
    imageUrl: "https://cms.blumewebsites.com/vertigo/website/logo.png",
  },
  {
    id: "store-gdl",
    name: "Nintendo Experience Guadalajara",
    location: "Andares, Zapopan",
    description:
      "Inventario enfocado en consolas y accesorios edición limitada.",
    imageUrl: "https://www.vjcoquitv.com/upload/banner/hEDCep9hHZYnHQe.png",
  },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: "cat-consoles", storeId: "store-cdmx", name: "Consolas" },
  { id: "cat-games", storeId: "store-cdmx", name: "Videojuegos" },
  { id: "cat-merch", storeId: "store-cdmx", name: "Merchandising" },
  { id: "cat-collectibles", storeId: "store-gdl", name: "Coleccionables" },
  { id: "cat-accessories", storeId: "store-gdl", name: "Accesorios" },
];

const INITIAL_PRODUCTS_BASE: Product[] = [
  {
    id: "prod-switch-oled",
    storeId: "store-cdmx",
    categoryId: "cat-consoles",
    name: "Nintendo Switch OLED (Neón)",
    unit: DEFAULT_PRODUCT_UNIT,
    templateId: undefined,
    price: 8999,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(8999, 8299),
    stock: 7,
    imageUrl:
      "https://assets.nintendo.com/image/upload/f_auto/q_auto/dpr_1.5/c_scale,w_800/ncom/en_US/switch/videos/heg001-07060600/posters/oled-model",
    description: "Edición OLED con mejoras en pantalla y kickstand.",
    hasOffer: true,
    offerPrice: 8299,
    barcodes: {
      upc: "0045496882490",
      box: "SKU-SWITCH-OLED",
    },
    changeLog: [],
  },
  {
    id: "prod-totk",
    storeId: "store-cdmx",
    categoryId: "cat-games",
    name: "The Legend of Zelda: Tears of the Kingdom",
    unit: DEFAULT_PRODUCT_UNIT,
    templateId: undefined,
    price: 1899,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(1899),
    stock: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=900&q=80",
    description: "Aventura épica exclusiva de Nintendo Switch.",
    hasOffer: false,
    barcodes: {
      upc: "0045496429643",
      box: "SKU-TOTK-STD",
    },
    changeLog: [],
  },
  {
    id: "prod-amiibo-link",
    storeId: "store-cdmx",
    categoryId: "cat-merch",
    name: "Amiibo Link (Skyward Sword)",
    unit: DEFAULT_PRODUCT_UNIT,
    templateId: undefined,
    price: 699,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(699, 599),
    stock: 12,
    imageUrl:
      "https://assets.nintendo.com/image/upload/ar_16:9,b_auto:border,c_lpad/b_white/f_auto/q_auto/dpr_1.5/c_scale,w_600/amiibo/The%20Legend%20of%20Zelda/link-skyward-sword-amiibo-the-legend-of-zelda-series-box",
    hasOffer: true,
    offerPrice: 599,
    barcodes: {
      upc: "0045496426433",
      box: "SKU-AMIIBO-LINK",
    },
    changeLog: [],
  },
  {
    id: "prod-switch-lite",
    storeId: "store-gdl",
    categoryId: "cat-collectibles",
    name: "Nintendo Switch Lite Zacian & Zamazenta",
    unit: DEFAULT_PRODUCT_UNIT,
    templateId: undefined,
    price: 6499,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(6499),
    stock: 4,
    imageUrl:
      "https://saimaya.es/wp-content/uploads/2021/01/products-12088.jpg",
    description: "Edición limitada inspirada en Pokémon Sword & Shield.",
    hasOffer: false,
    barcodes: {
      upc: "0045496882872",
      box: "SKU-SWITCH-LITE-ZAC",
    },
    changeLog: [],
  },
  {
    id: "prod-pro-controller",
    storeId: "store-gdl",
    categoryId: "cat-accessories",
    name: "Nintendo Switch Pro Controller Splatoon 3",
    unit: DEFAULT_PRODUCT_UNIT,
    templateId: undefined,
    price: 2499,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(2499, 2299),
    stock: 9,
    imageUrl:
      "https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_656/b_white/f_auto/q_auto/ncom/My%20Nintendo%20Store/EN-US/Nintendo%20Switch%202/Controllers/Pro%20Controllers/123674-nintendo-switch-2-pro-controller-package-front-2000x2000",
    hasOffer: true,
    offerPrice: 2299,
    barcodes: {
      upc: "0045496881462",
      box: "SKU-PROCTRL-SPLAT3",
    },
    changeLog: [],
  },
];

const INITIAL_PRODUCT_TEMPLATES: ProductTemplate[] = INITIAL_PRODUCTS_BASE.map(
  (product) =>
    createTemplateFromProduct(
      product,
      INITIAL_CATEGORIES.find((category) => category.id === product.categoryId),
      INITIAL_STORES.find((store) => store.id === product.storeId)
    )
);

INITIAL_PRODUCT_TEMPLATES.forEach((template) => {
  const product = INITIAL_PRODUCTS_BASE.find((item) => {
    const masterSku = sanitizeCodeValue(item.barcodes?.box) ?? item.id;
    return masterSku === sanitizeCodeValue(template.masterSku);
  });
  if (product) {
    product.templateId = template.id;
  }
});

const INITIAL_PRODUCTS: Product[] = INITIAL_PRODUCTS_BASE;

const INITIAL_INVENTORY_MOVEMENTS: InventoryMovement[] = INITIAL_PRODUCTS.map(
  (product) => createInitialMovementRecord(product)
).filter((movement): movement is InventoryMovement => movement !== null);

interface PersistedInventory {
  version: number;
  stores: Store[];
  categories: Category[];
  products: Product[];
  productTemplates: ProductTemplate[];
  inventoryMovements: InventoryMovement[];
}

interface AddStorePayload {
  name: string;
  location: string;
  description?: string;
  imageUrl?: string;
  imageAsset?: MediaAsset;
}

interface AddCategoryPayload {
  storeId: string;
  name: string;
  description?: string;
}

interface AddProductPayload {
  storeId: string;
  categoryId: string;
  name: string;
  price: number;
  stock: number;
  unit?: ProductUnit;
  imageUrl?: string;
  imageAsset?: MediaAsset;
  description?: string;
  hasOffer?: boolean;
  offerPrice?: number;
  barcodes?: ProductBarcodes;
  discountInfo?: ProductDiscountInfo;
  templateIdUsed?: string;
}

interface UpdateProductPayload {
  productId: string;
  data: Partial<
    Pick<
      Product,
      | "name"
      | "price"
      | "stock"
      | "imageUrl"
      | "imageAsset"
      | "description"
      | "unit"
      | "hasOffer"
      | "offerPrice"
      | "categoryId"
      | "barcodes"
      | "discountInfo"
      | "previousPrice"
      | "priceUpdatedAt"
      | "priceHistory"
    >
  >;
}

interface UpdateStorePayload {
  storeId: string;
  data: Partial<
    Pick<Store, "name" | "location" | "description" | "imageUrl" | "imageAsset">
  >;
}

interface UpdateCategoryPayload {
  categoryId: string;
  data: Partial<Pick<Category, "name" | "description">>;
}

interface TransferStockPayload {
  productId: string;
  targetProductId: string;
  quantity: number;
  note?: string;
}

interface InventoryStore {
  stores: Store[];
  categories: Category[];
  products: Product[];
  productTemplates: ProductTemplate[];
  inventoryMovements: InventoryMovement[];
  isReady: boolean;
  load: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  addStore: (payload: AddStorePayload) => Promise<Store>;
  updateStore: (payload: UpdateStorePayload) => Promise<Store | undefined>;
  removeStore: (storeId: string) => Promise<void>;
  addCategory: (payload: AddCategoryPayload) => Promise<Category>;
  updateCategory: (
    payload: UpdateCategoryPayload
  ) => Promise<Category | undefined>;
  removeCategory: (categoryId: string) => Promise<void>;
  addProduct: (payload: AddProductPayload) => Promise<Product>;
  updateProduct: (
    payload: UpdateProductPayload
  ) => Promise<Product | undefined>;
  setProductStock: (
    productId: string,
    stock: number
  ) => Promise<Product | undefined>;
  toggleOffer: (
    productId: string,
    hasOffer: boolean,
    offerPrice?: number
  ) => Promise<Product | undefined>;
  removeProduct: (productId: string) => Promise<void>;
  markTemplateUsed: (
    templateId: string
  ) => Promise<ProductTemplate | undefined>;
  markStoreMovementsSynced: (storeId: string) => Promise<number>;
  adjustProductStock: (
    productId: string,
    delta: number,
    options?: AdjustStockOptions
  ) => Promise<{ product: Product; movement: InventoryMovement } | undefined>;
  transferProductStock: (payload: TransferStockPayload) => Promise<{
    originProduct: Product;
    destinationProduct: Product;
    quantity: number;
  }>;
}

interface AdjustStockOptions {
  reason?: InventoryMovementReason;
  note?: string;
  markPending?: boolean;
}

const defaultState: PersistedInventory = {
  version: CURRENT_SCHEMA_VERSION,
  stores: INITIAL_STORES,
  categories: INITIAL_CATEGORIES,
  products: INITIAL_PRODUCTS,
  productTemplates: INITIAL_PRODUCT_TEMPLATES,
  inventoryMovements: INITIAL_INVENTORY_MOVEMENTS,
};

const readPersistedState = async (): Promise<PersistedInventory | null> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const upgraded = upgradePersistedInventory(parsed);
    if (!upgraded) {
      return null;
    }

    const previousVersion =
      typeof (parsed as { version?: number }).version === "number"
        ? (parsed as { version?: number }).version
        : 0;

    if (previousVersion !== CURRENT_SCHEMA_VERSION) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
    }

    return upgraded;
  } catch (error) {
    console.warn(
      "No se pudo interpretar el estado guardado, se reiniciará.",
      error
    );
    return null;
  }
};

export const useInventoryStore = create<InventoryStore>((set, get) => {
  const persistState = async (
    next?: Partial<PersistedInventory>
  ): Promise<void> => {
    const state = get();
    const payload: PersistedInventory = {
      version: CURRENT_SCHEMA_VERSION,
      stores: next?.stores ?? state.stores,
      categories: next?.categories ?? state.categories,
      products: next?.products ?? state.products,
      productTemplates: next?.productTemplates ?? state.productTemplates,
      inventoryMovements: next?.inventoryMovements ?? state.inventoryMovements,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const registerTemplateFromProduct = async (
    product: Product,
    options: {
      category?: Category | null;
      store?: Store | null;
      templateIdUsed?: string;
    } = {}
  ): Promise<ProductTemplate | undefined> => {
    const templates = get().productTemplates;
    const now = new Date().toISOString();
    const category = options.category ?? null;
    const store = options.store ?? null;

    const masterSku =
      sanitizeCodeValue(product.barcodes?.box) ??
      sanitizeCodeValue(product.barcodes?.upc) ??
      (product.templateId
        ? sanitizeCodeValue(product.templateId)
        : undefined) ??
      product.id;
    const upcCode = sanitizeCodeValue(product.barcodes?.upc);

    const mergeTemplate = (current: ProductTemplate): ProductTemplate => {
      const master = sanitizeCodeValue(current.masterSku) ?? masterSku;
      const barcodes =
        normalizeBarcodes({
          box: master,
          upc: upcCode ?? current.barcodes?.upc,
        }) ?? current.barcodes;

      const associatedUpcCodes = dedupeCodes([
        ...current.associatedUpcCodes,
        upcCode,
      ]);

      const storeReferences = (() => {
        if (!store) {
          return current.storeReferences;
        }
        const index = current.storeReferences.findIndex(
          (reference) => reference.storeId === store.id
        );
        const reference: ProductTemplateStoreReference = {
          storeId: store.id,
          storeName: store.name,
          upc: upcCode ?? current.storeReferences[index]?.upc,
          box: master,
          lastSeenAt: now,
        };
        if (index === -1) {
          return [...current.storeReferences, reference];
        }
        const next = [...current.storeReferences];
        next[index] = reference;
        return next;
      })();

      return {
        ...current,
        masterSku: master,
        basePrice: product.price,
        unit: product.unit,
        categoryName: category?.name ?? current.categoryName,
        imageUrl: product.imageUrl ?? current.imageUrl,
        imageAsset: product.imageAsset ?? current.imageAsset,
        description: product.description ?? current.description,
        barcodes,
        associatedUpcCodes,
        sourceStoreId: store?.id ?? current.sourceStoreId,
        sourceStoreName: store?.name ?? current.sourceStoreName,
        storeReferences,
        updatedAt: now,
      };
    };

    const persistTemplates = async (list: ProductTemplate[]): Promise<void> => {
      set({ productTemplates: list });
      await persistState({ productTemplates: list });
    };

    if (options.templateIdUsed) {
      const indexById = templates.findIndex(
        (template) => template.id === options.templateIdUsed
      );
      if (indexById !== -1) {
        const nextTemplate = mergeTemplate(templates[indexById]);
        const nextTemplates = [...templates];
        nextTemplates[indexById] = nextTemplate;
        await persistTemplates(nextTemplates);
        return nextTemplate;
      }
    }

    const key = toTemplateKey({
      name: product.name,
      barcodes: product.barcodes,
      masterSku,
    });

    const existingIndex = templates.findIndex((template) => {
      const templateKey = toTemplateKey({
        name: template.name,
        barcodes: template.barcodes,
        masterSku: template.masterSku,
      });
      if (templateKey === key) {
        return true;
      }
      const templateMaster = sanitizeCodeValue(template.masterSku);
      return templateMaster === masterSku;
    });

    if (existingIndex !== -1) {
      const nextTemplate = mergeTemplate(templates[existingIndex]);
      const nextTemplates = [...templates];
      nextTemplates[existingIndex] = nextTemplate;
      await persistTemplates(nextTemplates);
      return nextTemplate;
    }

    const template = createTemplateFromProduct(product, category, store);
    const normalizedTemplate: ProductTemplate = {
      ...template,
      masterSku: sanitizeCodeValue(template.masterSku) ?? masterSku,
      associatedUpcCodes: dedupeCodes([
        ...template.associatedUpcCodes,
        upcCode,
      ]),
      barcodes:
        normalizeBarcodes({
          box: template.masterSku,
          upc: upcCode ?? template.barcodes?.upc,
        }) ?? template.barcodes,
      storeReferences:
        store && template.storeReferences.length === 0
          ? [
              {
                storeId: store.id,
                storeName: store.name,
                upc: upcCode,
                box: template.masterSku,
                lastSeenAt: now,
              },
            ]
          : template.storeReferences,
    };

    const nextTemplates = [...templates, normalizedTemplate];
    await persistTemplates(nextTemplates);
    return normalizedTemplate;
  };

  return {
    stores: [],
    categories: [],
    products: [],
    productTemplates: [],
    inventoryMovements: [],
    isReady: false,
    load: async (): Promise<void> => {
      if (get().isReady) return;

      try {
        const persisted = await readPersistedState();
        if (persisted) {
          set({ ...persisted, isReady: true });
        } else {
          set({ ...defaultState, isReady: true });
          await persistState(defaultState);
        }
      } catch (error) {
        console.warn(
          "Error al cargar inventario, se usarán datos de ejemplo.",
          error
        );
        set({ ...defaultState, isReady: true });
        await persistState(defaultState);
      }
    },
    resetToDefaults: async (): Promise<void> => {
      set({ ...defaultState, isReady: true });
      await persistState(defaultState);
    },
    addStore: async (payload: AddStorePayload): Promise<Store> => {
      const newStore: Store = {
        id: generateId("store"),
        name: payload.name.trim(),
        location: payload.location.trim(),
        description: payload.description?.trim() || undefined,
        imageUrl: payload.imageUrl?.trim() || undefined,
        imageAsset: normalizeMediaAsset(payload.imageAsset),
      };
      const stores = [...get().stores, newStore];
      set({ stores });
      await persistState({ stores });
      return newStore;
    },
    updateStore: async ({
      storeId,
      data,
    }: UpdateStorePayload): Promise<Store | undefined> => {
      const stores = get().stores;
      const index = stores.findIndex((store) => store.id === storeId);
      if (index === -1) return undefined;

      const current = stores[index];
      const next: Store = {
        ...current,
        ...data,
        name: data.name !== undefined ? data.name.trim() : current.name,
        location:
          data.location !== undefined ? data.location.trim() : current.location,
        description:
          data.description !== undefined
            ? data.description.trim() || undefined
            : current.description,
        imageUrl:
          data.imageUrl !== undefined
            ? data.imageUrl.trim() || undefined
            : current.imageUrl,
        imageAsset:
          data.imageAsset !== undefined
            ? normalizeMediaAsset(data.imageAsset)
            : current.imageAsset,
      };

      const nextStores = [...stores];
      nextStores[index] = next;
      set({ stores: nextStores });
      await persistState({ stores: nextStores });
      return next;
    },
    removeStore: async (storeId: string): Promise<void> => {
      const state = get();
      const hasPendingMovements = state.inventoryMovements.some(
        (movement) => movement.storeId === storeId && !movement.synced
      );
      if (hasPendingMovements) {
        throw new Error(
          "Error: No se puede eliminar. Existen movimientos pendientes"
        );
      }

      const stores = state.stores.filter((store) => store.id !== storeId);
      if (stores.length === state.stores.length) {
        return;
      }

      const categories = state.categories.filter(
        (category) => category.storeId !== storeId
      );
      const products = state.products.filter(
        (product) => product.storeId !== storeId
      );
      const inventoryMovements = state.inventoryMovements.filter(
        (movement) => movement.storeId !== storeId
      );

      set({ stores, categories, products, inventoryMovements });
      await persistState({ stores, categories, products, inventoryMovements });
    },
    addCategory: async ({
      storeId,
      name,
      description,
    }: AddCategoryPayload): Promise<Category> => {
      const categories = get().categories;
      const exists = categories.some(
        (category) =>
          category.storeId === storeId &&
          category.name.trim().toLowerCase() === name.trim().toLowerCase()
      );

      if (exists) {
        throw new Error("La categoría ya existe en esta tienda.");
      }

      const newCategory: Category = {
        id: generateId("category"),
        storeId,
        name: name.trim(),
        description,
      };

      const nextCategories = [...categories, newCategory];
      set({ categories: nextCategories });
      await persistState({ categories: nextCategories });
      return newCategory;
    },
    updateCategory: async ({
      categoryId,
      data,
    }: UpdateCategoryPayload): Promise<Category | undefined> => {
      const categories = get().categories;
      const index = categories.findIndex(
        (category) => category.id === categoryId
      );
      if (index === -1) return undefined;

      const current = categories[index];
      const nextName = data.name?.trim();

      if (nextName) {
        const duplicate = categories.some(
          (category) =>
            category.id !== categoryId &&
            category.storeId === current.storeId &&
            category.name.trim().toLowerCase() === nextName.toLowerCase()
        );

        if (duplicate) {
          throw new Error("Ya existe una categoría con ese nombre.");
        }
      }

      const nextCategory: Category = {
        ...current,
        ...data,
        name: nextName ?? current.name,
        description:
          data.description !== undefined
            ? data.description.trim() || undefined
            : current.description,
      };

      const nextCategories = [...categories];
      nextCategories[index] = nextCategory;
      set({ categories: nextCategories });
      await persistState({ categories: nextCategories });
      return nextCategory;
    },
    removeCategory: async (categoryId: string): Promise<void> => {
      const state = get();
      const categories = state.categories.filter(
        (category) => category.id !== categoryId
      );
      if (categories.length === state.categories.length) {
        return;
      }

      const removedProductIds = new Set(
        state.products
          .filter((product) => product.categoryId === categoryId)
          .map((product) => product.id)
      );

      const products = state.products.filter(
        (product) => product.categoryId !== categoryId
      );

      const inventoryMovements =
        removedProductIds.size > 0
          ? state.inventoryMovements.filter(
              (movement) => !removedProductIds.has(movement.productId)
            )
          : state.inventoryMovements;

      set({ categories, products, inventoryMovements });
      await persistState({ categories, products, inventoryMovements });
    },
    addProduct: async ({
      storeId,
      categoryId,
      name,
      price,
      stock,
      unit,
      imageUrl,
      imageAsset,
      description,
      hasOffer,
      offerPrice,
      barcodes,
      discountInfo,
      templateIdUsed,
    }: AddProductPayload): Promise<Product> => {
      const categories = get().categories;
      const store = get().stores.find((item) => item.id === storeId);
      if (!store) {
        throw new Error("La tienda seleccionada no existe.");
      }

      const category = categories.find(
        (item) => item.id === categoryId && item.storeId === storeId
      );
      if (!category) {
        throw new Error(
          "La categoría seleccionada no pertenece a esta tienda."
        );
      }

      const trimmedImageUrl = imageUrl?.trim() || undefined;
      const normalizedImageAsset = normalizeMediaAsset(imageAsset);
      const normalizedBarcodes = normalizeBarcodes(barcodes);
      const normalizedDiscount = normalizeDiscountInfo(discountInfo);
      const normalizedHasOffer = Boolean(hasOffer && offerPrice !== undefined);
      if (!templateIdUsed && (!normalizedBarcodes || !normalizedBarcodes.box)) {
        throw new Error(
          "Debes ingresar el Código Único de Caja (SKU Maestro) para registrar este producto en el Catálogo Maestro."
        );
      }

      const normalizedUnit = normalizeProductUnit(unit);
      const trimmedDescription = description?.trim() || undefined;
      const priceHistory = createSnapshot(
        price,
        normalizedHasOffer && offerPrice !== undefined ? offerPrice : undefined
      );
      const priceUpdatedAt =
        priceHistory[priceHistory.length - 1]?.recordedAt ??
        new Date().toISOString();

      const baseProduct: Product = {
        id: generateId("product"),
        storeId,
        categoryId,
        name: name.trim(),
        unit: normalizedUnit,
        templateId: templateIdUsed,
        price,
        previousPrice: undefined,
        priceUpdatedAt,
        priceHistory,
        stock,
        imageUrl: trimmedImageUrl,
        imageAsset: normalizedImageAsset,
        description: trimmedDescription,
        hasOffer: normalizedHasOffer,
        offerPrice:
          normalizedHasOffer && offerPrice !== undefined
            ? offerPrice
            : undefined,
        discountInfo: normalizedDiscount,
        barcodes: normalizedBarcodes,
        changeLog: [],
      };

      const creationLogEntry = createProductCreationChangeLogEntry(baseProduct);
      const newProduct: Product = {
        ...baseProduct,
        changeLog: trimChangeLogEntries([
          creationLogEntry,
          ...baseProduct.changeLog,
        ]),
      };

      const template = await registerTemplateFromProduct(newProduct, {
        category,
        store,
        templateIdUsed,
      });

      const resolvedTemplateId = template?.id ?? templateIdUsed;
      const productToPersist =
        resolvedTemplateId && resolvedTemplateId !== newProduct.templateId
          ? { ...newProduct, templateId: resolvedTemplateId }
          : newProduct;

      const currentMovements = get().inventoryMovements;
      const products = [...get().products, productToPersist];
      const initialMovement = createInitialMovementRecord(
        productToPersist,
        false
      );
      const nextMovements =
        initialMovement !== null
          ? [...currentMovements, initialMovement]
          : null;

      if (nextMovements) {
        set({ products, inventoryMovements: nextMovements });
        await persistState({ products, inventoryMovements: nextMovements });
      } else {
        set({ products });
        await persistState({ products });
      }
      return productToPersist;
    },
    updateProduct: async ({
      productId,
      data,
    }: UpdateProductPayload): Promise<Product | undefined> => {
      const products = get().products;
      const index = products.findIndex((product) => product.id === productId);
      if (index === -1) return undefined;

      const current = products[index];
      const categories = get().categories;
      const stores = get().stores;
      const store =
        stores.find((candidate) => candidate.id === current.storeId) ?? null;

      if (data.categoryId) {
        const category = categories.find(
          (candidate) => candidate.id === data.categoryId
        );

        if (!category || category.storeId !== current.storeId) {
          throw new Error(
            "La categoría seleccionada no pertenece a esta tienda."
          );
        }
      }
      const hasOwn = (key: keyof UpdateProductPayload["data"]) =>
        Object.prototype.hasOwnProperty.call(data, key);

      const nextCategoryId = data.categoryId ?? current.categoryId;
      const nextCategory =
        categories.find((candidate) => candidate.id === nextCategoryId) ?? null;
      const nextName =
        data.name !== undefined ? data.name.trim() : current.name;
      const nextDescription =
        data.description !== undefined
          ? data.description.trim() || undefined
          : current.description;

      let nextImageUrl = current.imageUrl;
      if (hasOwn("imageUrl")) {
        const candidate = data.imageUrl;
        nextImageUrl =
          candidate !== undefined ? candidate.trim() || undefined : undefined;
      }

      const nextImageAsset = hasOwn("imageAsset")
        ? normalizeMediaAsset(data.imageAsset)
        : current.imageAsset;

      const nextBarcodes = hasOwn("barcodes")
        ? normalizeBarcodes(data.barcodes)
        : current.barcodes;

      const nextDiscountInfo = hasOwn("discountInfo")
        ? normalizeDiscountInfo(data.discountInfo)
        : current.discountInfo;

      const nextPrice = data.price !== undefined ? data.price : current.price;
      const priceChanged = nextPrice !== current.price;

      const requestedHasOffer =
        data.hasOffer !== undefined ? data.hasOffer : current.hasOffer;

      let provisionalOffer = data.offerPrice ?? current.offerPrice;
      if (requestedHasOffer && provisionalOffer === undefined) {
        provisionalOffer =
          current.offerPrice ?? Math.max(1, Math.round(nextPrice * 0.9));
      }
      const nextHasOffer = Boolean(
        requestedHasOffer && provisionalOffer !== undefined
      );
      const nextOfferPrice = nextHasOffer ? provisionalOffer : undefined;
      const offerChanged =
        nextHasOffer !== current.hasOffer ||
        nextOfferPrice !== current.offerPrice;

      const baseHistory =
        Array.isArray(current.priceHistory) && current.priceHistory.length > 0
          ? current.priceHistory
          : createSnapshot(
              current.price,
              current.hasOffer ? current.offerPrice : undefined
            );

      let nextHistory = baseHistory;
      let nextPriceUpdatedAt = current.priceUpdatedAt;
      let nextPreviousPrice = current.previousPrice;

      if (priceChanged || offerChanged) {
        const snapshot: ProductPriceSnapshot = {
          price: nextPrice,
          offerPrice: nextHasOffer ? nextOfferPrice : undefined,
          recordedAt: new Date().toISOString(),
        };
        nextHistory = appendSnapshot(baseHistory, snapshot);
        nextPriceUpdatedAt = snapshot.recordedAt;
        if (priceChanged) {
          nextPreviousPrice = current.price;
        }
      }

      const nextUnit = hasOwn("unit")
        ? normalizeProductUnit(data.unit)
        : current.unit;
      const nextStock = data.stock !== undefined ? data.stock : current.stock;

      const stockChanged = nextStock !== current.stock;
      const unitChanged = nextUnit !== current.unit;
      const categoryChanged = nextCategoryId !== current.categoryId;
      const nameChanged = nextName !== current.name;
      const descriptionChanged = nextDescription !== current.description;
      const imageChanged =
        nextImageUrl !== current.imageUrl ||
        (nextImageAsset?.uri ?? null) !== (current.imageAsset?.uri ?? null);
      const barcodesChanged =
        JSON.stringify(nextBarcodes ?? null) !==
        JSON.stringify(current.barcodes ?? null);
      const discountChanged =
        JSON.stringify(nextDiscountInfo ?? null) !==
        JSON.stringify(current.discountInfo ?? null);

      const changes: string[] = [];

      if (nameChanged) {
        changes.push(`Nombre: "${current.name}" -> "${nextName}"`);
      }

      if (unitChanged) {
        changes.push(
          `Unidad: ${resolveProductUnitLabel(
            current.unit
          )} -> ${resolveProductUnitLabel(nextUnit)}`
        );
      }

      if (priceChanged) {
        changes.push(
          `Precio: ${formatCurrency(current.price)} -> ${formatCurrency(
            nextPrice
          )}`
        );
      }

      const formatOffer = (active: boolean, value?: number): string =>
        active && value !== undefined ? formatCurrency(value) : "sin oferta";

      if (offerChanged) {
        const previousOffer = formatOffer(current.hasOffer, current.offerPrice);
        const nextOffer = formatOffer(
          nextHasOffer,
          nextOfferPrice ?? undefined
        );

        if (!current.hasOffer && nextHasOffer) {
          changes.push(`Oferta activada: ${nextOffer}`);
        } else if (current.hasOffer && !nextHasOffer) {
          changes.push(`Oferta desactivada (antes: ${previousOffer})`);
        } else {
          changes.push(`Oferta: ${previousOffer} -> ${nextOffer}`);
        }
      }

      if (stockChanged) {
        changes.push(`Stock: ${current.stock} -> ${nextStock}`);
      }

      if (categoryChanged) {
        const currentCategory = categories.find(
          (candidate) => candidate.id === current.categoryId
        );
        changes.push(
          `Categoría: ${currentCategory?.name ?? "Sin categoría"} -> ${
            nextCategory?.name ?? "Sin categoría"
          }`
        );
      }

      if (descriptionChanged) {
        if (!current.description && nextDescription) {
          changes.push("Descripción agregada.");
        } else if (current.description && !nextDescription) {
          changes.push("Descripción eliminada.");
        } else {
          changes.push("Descripción actualizada.");
        }
      }

      if (imageChanged) {
        if (
          !current.imageUrl &&
          !current.imageAsset &&
          (nextImageUrl || nextImageAsset)
        ) {
          changes.push("Imagen agregada.");
        } else if (current.imageUrl || current.imageAsset) {
          changes.push(
            nextImageUrl || nextImageAsset
              ? "Imagen actualizada."
              : "Imagen eliminada."
          );
        }
      }

      if (barcodesChanged) {
        changes.push("Códigos de barra actualizados.");
      }

      if (discountChanged) {
        changes.push("Condiciones de descuento actualizadas.");
      }

      let summary: string | undefined;
      if (priceChanged && stockChanged) {
        summary = "Precio y stock actualizados";
      } else if (priceChanged) {
        summary = "Precio actualizado";
      } else if (stockChanged) {
        summary = "Stock ajustado";
      } else if (offerChanged) {
        summary = nextHasOffer ? "Oferta activada" : "Oferta desactivada";
      } else if (unitChanged) {
        summary = "Unidad actualizada";
      } else if (categoryChanged) {
        summary = "Categoría actualizada";
      } else if (nameChanged) {
        summary = "Nombre actualizado";
      } else if (descriptionChanged) {
        summary = "Descripción actualizada";
      } else if (imageChanged) {
        summary = "Imagen actualizada";
      } else if (barcodesChanged) {
        summary = "Códigos de barra actualizados";
      } else if (discountChanged) {
        summary = "Condiciones de descuento actualizadas";
      }

      if (!summary && changes.length > 1) {
        summary = "Actualización general del producto";
      }

      if (!summary && changes.length === 1) {
        summary = changes[0];
      }

      if (!summary && changes.length > 0) {
        summary = "Producto actualizado";
      }

      const nextChangeLog =
        changes.length > 0
          ? trimChangeLogEntries([
              ...current.changeLog,
              {
                id: generateId("chg"),
                productId: current.id,
                performedAt: new Date().toISOString(),
                summary: summary ?? "Producto actualizado",
                changes,
              },
            ])
          : current.changeLog;

      const next: Product = {
        ...current,
        categoryId: nextCategoryId,
        name: nextName,
        description: nextDescription,
        imageUrl: nextImageUrl,
        imageAsset: nextImageAsset,
        barcodes: nextBarcodes,
        discountInfo: nextDiscountInfo,
        price: nextPrice,
        previousPrice: nextPreviousPrice,
        priceUpdatedAt: nextPriceUpdatedAt,
        priceHistory: nextHistory,
        stock: nextStock,
        hasOffer: nextHasOffer,
        offerPrice: nextOfferPrice,
        unit: nextUnit,
        changeLog: nextChangeLog,
      };

      const nextProducts = [...products];
      nextProducts[index] = next;
      set({ products: nextProducts });
      await persistState({ products: nextProducts });

      const template = await registerTemplateFromProduct(next, {
        category: nextCategory,
        store,
        templateIdUsed: next.templateId,
      });

      if (!next.templateId && template?.id) {
        const updatedProduct: Product = { ...next, templateId: template.id };
        const refreshedProducts = [...nextProducts];
        refreshedProducts[index] = updatedProduct;
        set({ products: refreshedProducts });
        await persistState({ products: refreshedProducts });
        return updatedProduct;
      }

      return next;
    },
    adjustProductStock: async (
      productId: string,
      delta: number,
      options: AdjustStockOptions = {}
    ): Promise<
      { product: Product; movement: InventoryMovement } | undefined
    > => {
      const amount = Math.trunc(delta);
      if (!Number.isFinite(amount) || amount === 0) {
        throw new Error("Debes ingresar una cantidad distinta de cero.");
      }

      const state = get();
      const index = state.products.findIndex(
        (product) => product.id === productId
      );
      if (index === -1) {
        return undefined;
      }

      const product = state.products[index];
      const nextStock = product.stock + amount;
      if (nextStock < 0) {
        throw new Error("No hay stock suficiente para registrar la salida.");
      }

      const markPending = options?.markPending ?? true;

      const updatedProduct: Product = {
        ...product,
        stock: nextStock,
      };

      const movement = createMovementRecord({
        product,
        delta: amount,
        previousStock: product.stock,
        reason: options.reason,
        note: options.note,
        synced: !markPending,
      });

      const products = [...state.products];
      products[index] = updatedProduct;
      const inventoryMovements = [...state.inventoryMovements, movement];

      try {
        set({ products, inventoryMovements });
        await persistState({ products, inventoryMovements });
        return { product: updatedProduct, movement };
      } catch (error) {
        set({
          products: state.products,
          inventoryMovements: state.inventoryMovements,
        });
        console.warn("Error al persistir ajuste de stock", error);
        throw new Error("Error: no se pudo guardar el ajuste");
      }
    },
    setProductStock: async (
      productId: string,
      stock: number
    ): Promise<Product | undefined> => {
      if (stock < 0) {
        throw new Error("El stock no puede ser negativo.");
      }

      return get().updateProduct({ productId, data: { stock } });
    },
    toggleOffer: async (
      productId: string,
      hasOffer: boolean,
      offerPrice?: number
    ): Promise<Product | undefined> => {
      const product = get().products.find((item) => item.id === productId);
      if (!product) {
        throw new Error("El producto no existe en el inventario actual.");
      }

      if (hasOffer) {
        if (offerPrice === undefined) {
          throw new Error("Debes especificar el precio en oferta.");
        }

        if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
          throw new Error("El precio en oferta debe ser mayor a cero.");
        }

        if (offerPrice >= product.price) {
          throw new Error(
            "El precio en oferta debe ser menor al precio base actual."
          );
        }
      }

      const normalizedOffer =
        hasOffer && offerPrice !== undefined
          ? Math.round(offerPrice * 100) / 100
          : undefined;

      return get().updateProduct({
        productId,
        data: {
          hasOffer,
          offerPrice: hasOffer ? normalizedOffer : undefined,
        },
      });
    },
    removeProduct: async (productId: string): Promise<void> => {
      const state = get();
      const products = state.products.filter(
        (product) => product.id !== productId
      );
      if (products.length === state.products.length) {
        return;
      }

      const inventoryMovements = state.inventoryMovements.filter(
        (movement) => movement.productId !== productId
      );

      set({ products, inventoryMovements });
      await persistState({ products, inventoryMovements });
    },
    markTemplateUsed: async (
      templateId: string
    ): Promise<ProductTemplate | undefined> => {
      const templates = get().productTemplates;
      const index = templates.findIndex(
        (template) => template.id === templateId
      );
      if (index === -1) {
        return undefined;
      }

      const now = new Date().toISOString();
      const current = templates[index];
      const nextTemplate: ProductTemplate = {
        ...current,
        lastUsedAt: now,
        updatedAt: now,
      };

      const nextTemplates = [...templates];
      nextTemplates[index] = nextTemplate;
      set({ productTemplates: nextTemplates });
      await persistState({ productTemplates: nextTemplates });
      return nextTemplate;
    },
    markStoreMovementsSynced: async (storeId: string): Promise<number> => {
      const movements = get().inventoryMovements;
      let updated = 0;
      const nextMovements = movements.map((movement) => {
        if (movement.storeId !== storeId || movement.synced) {
          return movement;
        }
        updated += 1;
        return { ...movement, synced: true };
      });

      if (updated === 0) {
        return 0;
      }

      set({ inventoryMovements: nextMovements });
      await persistState({ inventoryMovements: nextMovements });
      return updated;
    },
    transferProductStock: async ({
      productId,
      targetProductId,
      quantity,
      note,
    }: TransferStockPayload): Promise<{
      originProduct: Product;
      destinationProduct: Product;
      quantity: number;
    }> => {
      const amount = Math.trunc(quantity);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(
          "Debes ingresar una cantidad mayor a cero para transferir."
        );
      }

      if (productId === targetProductId) {
        throw new Error(
          "Selecciona una tienda de destino diferente para la transferencia."
        );
      }

      const state = get();
      const originIndex = state.products.findIndex(
        (product) => product.id === productId
      );
      if (originIndex === -1) {
        throw new Error("El producto de origen no existe en el inventario.");
      }

      const destinationIndex = state.products.findIndex(
        (product) => product.id === targetProductId
      );
      if (destinationIndex === -1) {
        throw new Error(
          "El producto de destino no existe en la tienda seleccionada."
        );
      }

      const originProduct = state.products[originIndex];
      const destinationProduct = state.products[destinationIndex];

      if (originProduct.storeId === destinationProduct.storeId) {
        throw new Error(
          "La tienda de destino debe ser diferente a la tienda de origen."
        );
      }

      if (amount > originProduct.stock) {
        throw new Error(
          `Error: stock insuficiente en la tienda de origen. Máximo disponible: ${originProduct.stock}.`
        );
      }

      const stores = state.stores;
      const originStore = stores.find(
        (store) => store.id === originProduct.storeId
      );
      const destinationStore = stores.find(
        (store) => store.id === destinationProduct.storeId
      );

      const sanitizedNote = note?.trim() || undefined;
      const originNote = sanitizedNote
        ? `${sanitizedNote} → ${destinationStore?.name ?? "Destino"}`
        : destinationStore
        ? `Transferencia a ${destinationStore.name}`
        : undefined;
      const destinationNote = sanitizedNote
        ? `${sanitizedNote} ← ${originStore?.name ?? "Origen"}`
        : originStore
        ? `Transferencia desde ${originStore.name}`
        : undefined;

      const updatedOrigin: Product = {
        ...originProduct,
        stock: originProduct.stock - amount,
      };

      const updatedDestination: Product = {
        ...destinationProduct,
        stock: destinationProduct.stock + amount,
      };

      const originMovement = createMovementRecord({
        product: originProduct,
        delta: -amount,
        previousStock: originProduct.stock,
        reason: "transfer",
        note: originNote,
        synced: false,
        kind: "decrease",
      });

      const destinationMovement = createMovementRecord({
        product: destinationProduct,
        delta: amount,
        previousStock: destinationProduct.stock,
        reason: "transfer",
        note: destinationNote,
        synced: false,
        kind: "increase",
      });

      const products = [...state.products];
      products[originIndex] = updatedOrigin;
      products[destinationIndex] = updatedDestination;
      const inventoryMovements = [
        ...state.inventoryMovements,
        originMovement,
        destinationMovement,
      ];

      try {
        set({ products, inventoryMovements });
        await persistState({ products, inventoryMovements });
        return {
          originProduct: updatedOrigin,
          destinationProduct: updatedDestination,
          quantity: amount,
        };
      } catch (error) {
        set({
          products: state.products,
          inventoryMovements: state.inventoryMovements,
        });
        console.warn("Error al persistir transferencia de stock", error);
        throw new Error("Error: no se pudo completar la transferencia.");
      }
    },
  };
});
