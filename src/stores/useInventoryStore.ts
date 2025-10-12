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
} from "@/types/inventory";
import { generateId } from "@/utils/id";

const STORAGE_KEY = "nintendo-inventory-state";
const CURRENT_SCHEMA_VERSION = 2;
const MAX_PRICE_HISTORY = 120;

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

const normalizeBarcodes = (
  value?: ProductBarcodes
): ProductBarcodes | undefined => {
  if (!value) return undefined;
  const box = value.box?.trim() || undefined;
  const upc = value.upc?.trim() || undefined;
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

  return {
    id,
    storeId,
    categoryId,
    name,
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

  return {
    version: CURRENT_SCHEMA_VERSION,
    stores,
    categories,
    products,
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

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-switch-oled",
    storeId: "store-cdmx",
    categoryId: "cat-consoles",
    name: "Nintendo Switch OLED (Neón)",
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
  },
  {
    id: "prod-totk",
    storeId: "store-cdmx",
    categoryId: "cat-games",
    name: "The Legend of Zelda: Tears of the Kingdom",
    price: 1899,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(1899),
    stock: 15,
    imageUrl:
      "https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=900&q=80",
    description: "Aventura épica exclusiva de Nintendo Switch.",
    hasOffer: false,
  },
  {
    id: "prod-amiibo-link",
    storeId: "store-cdmx",
    categoryId: "cat-merch",
    name: "Amiibo Link (Skyward Sword)",
    price: 699,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(699, 599),
    stock: 12,
    imageUrl:
      "https://assets.nintendo.com/image/upload/ar_16:9,b_auto:border,c_lpad/b_white/f_auto/q_auto/dpr_1.5/c_scale,w_600/amiibo/The%20Legend%20of%20Zelda/link-skyward-sword-amiibo-the-legend-of-zelda-series-box",
    hasOffer: true,
    offerPrice: 599,
  },
  {
    id: "prod-switch-lite",
    storeId: "store-gdl",
    categoryId: "cat-collectibles",
    name: "Nintendo Switch Lite Zacian & Zamazenta",
    price: 6499,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(6499),
    stock: 4,
    imageUrl:
      "https://saimaya.es/wp-content/uploads/2021/01/products-12088.jpg",
    description: "Edición limitada inspirada en Pokémon Sword & Shield.",
    hasOffer: false,
  },
  {
    id: "prod-pro-controller",
    storeId: "store-gdl",
    categoryId: "cat-accessories",
    name: "Nintendo Switch Pro Controller Splatoon 3",
    price: 2499,
    previousPrice: undefined,
    priceUpdatedAt: new Date().toISOString(),
    priceHistory: createSnapshot(2499, 2299),
    stock: 9,
    imageUrl:
      "https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_656/b_white/f_auto/q_auto/ncom/My%20Nintendo%20Store/EN-US/Nintendo%20Switch%202/Controllers/Pro%20Controllers/123674-nintendo-switch-2-pro-controller-package-front-2000x2000",
    hasOffer: true,
    offerPrice: 2299,
  },
];

interface PersistedInventory {
  version: number;
  stores: Store[];
  categories: Category[];
  products: Product[];
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
  imageUrl?: string;
  imageAsset?: MediaAsset;
  description?: string;
  hasOffer?: boolean;
  offerPrice?: number;
  barcodes?: ProductBarcodes;
  discountInfo?: ProductDiscountInfo;
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

interface InventoryStore {
  stores: Store[];
  categories: Category[];
  products: Product[];
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
}

const defaultState: PersistedInventory = {
  version: CURRENT_SCHEMA_VERSION,
  stores: INITIAL_STORES,
  categories: INITIAL_CATEGORIES,
  products: INITIAL_PRODUCTS,
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
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  return {
    stores: [],
    categories: [],
    products: [],
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
      const stores = get().stores.filter((store) => store.id !== storeId);
      if (stores.length === get().stores.length) {
        return;
      }

      const categories = get().categories.filter(
        (category) => category.storeId !== storeId
      );
      const products = get().products.filter(
        (product) => product.storeId !== storeId
      );

      set({ stores, categories, products });
      await persistState({ stores, categories, products });
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
      const categories = get().categories.filter(
        (category) => category.id !== categoryId
      );
      if (categories.length === get().categories.length) {
        return;
      }

      const products = get().products.filter(
        (product) => product.categoryId !== categoryId
      );

      set({ categories, products });
      await persistState({ categories, products });
    },
    addProduct: async ({
      storeId,
      categoryId,
      name,
      price,
      stock,
      imageUrl,
      imageAsset,
      description,
      hasOffer,
      offerPrice,
      barcodes,
      discountInfo,
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
      const priceHistory = createSnapshot(
        price,
        normalizedHasOffer && offerPrice !== undefined ? offerPrice : undefined
      );
      const priceUpdatedAt =
        priceHistory[priceHistory.length - 1]?.recordedAt ??
        new Date().toISOString();

      const newProduct: Product = {
        id: generateId("product"),
        storeId,
        categoryId,
        name: name.trim(),
        price,
        previousPrice: undefined,
        priceUpdatedAt,
        priceHistory,
        stock,
        imageUrl: trimmedImageUrl,
        imageAsset: normalizedImageAsset,
        description,
        hasOffer: normalizedHasOffer,
        offerPrice:
          normalizedHasOffer && offerPrice !== undefined
            ? offerPrice
            : undefined,
        discountInfo: normalizedDiscount,
        barcodes: normalizedBarcodes,
      };

      const products = [...get().products, newProduct];
      set({ products });
      await persistState({ products });
      return newProduct;
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

      const nextStock = data.stock !== undefined ? data.stock : current.stock;

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
      };

      const nextProducts = [...products];
      nextProducts[index] = next;
      set({ products: nextProducts });
      await persistState({ products: nextProducts });
      return next;
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
      if (hasOffer && offerPrice === undefined) {
        throw new Error("Debes especificar el precio en oferta.");
      }

      return get().updateProduct({
        productId,
        data: {
          hasOffer,
          offerPrice: hasOffer ? offerPrice : undefined,
        },
      });
    },
    removeProduct: async (productId: string): Promise<void> => {
      const products = get().products.filter(
        (product) => product.id !== productId
      );
      if (products.length === get().products.length) {
        return;
      }

      set({ products });
      await persistState({ products });
    },
  };
});
