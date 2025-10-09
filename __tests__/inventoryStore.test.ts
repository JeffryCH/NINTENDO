import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useInventoryStore } from "@/stores/useInventoryStore";

jest.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => memory.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      memory.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      memory.delete(key);
    }),
    clear: jest.fn(async () => {
      memory.clear();
    }),
  };
});

describe("useInventoryStore", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await useInventoryStore.getState().resetToDefaults();
  });

  it("carga datos iniciales correctamente", async () => {
    await useInventoryStore.getState().load();
    const state = useInventoryStore.getState();

    expect(state.isReady).toBe(true);
    expect(state.stores.length).toBeGreaterThan(0);
    expect(state.products.length).toBeGreaterThan(0);
  });

  it("agrega una nueva tienda", async () => {
    await useInventoryStore.getState().load();
    const initialCount = useInventoryStore.getState().stores.length;

    await useInventoryStore.getState().addStore({
      name: "Nintendo Store Monterrey",
      location: "Plaza Fiesta San Agustín",
      description: "Punto de distribución norte",
      imageUrl: "https://example.com/monterrey.jpg",
    });

    const state = useInventoryStore.getState();
    expect(state.stores.length).toBe(initialCount + 1);
  });

  it("crea una categoría nueva al registrar producto", async () => {
    await useInventoryStore.getState().load();
    const storeId = useInventoryStore.getState().stores[0].id;
    const initialCategories = useInventoryStore.getState().categories.length;

    const newCategory = await useInventoryStore.getState().addCategory({
      storeId,
      name: "Pruebas",
    });

    expect(useInventoryStore.getState().categories.length).toBe(
      initialCategories + 1
    );

    await useInventoryStore.getState().addProduct({
      storeId,
      categoryId: newCategory.id,
      name: "Nintendo Switch OLED Edición Zelda",
      price: 9499,
      stock: 5,
      hasOffer: true,
      offerPrice: 8999,
    });

    const products = useInventoryStore
      .getState()
      .products.filter((product) => product.categoryId === newCategory.id);
    expect(products.length).toBeGreaterThan(0);
  });
});
