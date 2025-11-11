import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INVENTORY_STORAGE_KEY,
  useInventoryStore,
} from "@/stores/useInventoryStore";

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

  it("HU-09 guarda ajustes de stock inmediatamente en almacenamiento local", async () => {
    await useInventoryStore.getState().load();
    const product = useInventoryStore.getState().products[0];
    const initialStock = product.stock;
    const setItemMock = AsyncStorage.setItem as jest.Mock;
    setItemMock.mockClear();

    await useInventoryStore
      .getState()
      .adjustProductStock(product.id, -2, { reason: "sale" });

    expect(setItemMock).toHaveBeenCalled();
    const lastPersistCall =
      setItemMock.mock.calls[setItemMock.mock.calls.length - 1];
    expect(lastPersistCall?.[0]).toBe(INVENTORY_STORAGE_KEY);
    const rawSnapshot =
      typeof lastPersistCall?.[1] === "string" ? lastPersistCall[1] : "{}";
    const snapshot = JSON.parse(rawSnapshot);
    const persistedProduct = (
      snapshot.products as Array<{ id: string; stock: number }> | undefined
    )?.find((item) => item.id === product.id);
    expect(persistedProduct).toBeDefined();
    expect(persistedProduct?.stock).toBe(initialStock - 2);
  });

  it("HU-09 mantiene precios modificados después de reiniciar sin conexión", async () => {
    await useInventoryStore.getState().load();
    const product = useInventoryStore.getState().products[0];
    const nextPrice = product.price + 500;

    await useInventoryStore.getState().updateProduct({
      productId: product.id,
      data: { price: nextPrice },
    });

    useInventoryStore.setState({
      stores: [],
      categories: [],
      products: [],
      productTemplates: [],
      inventoryMovements: [],
      isReady: false,
    });

    await useInventoryStore.getState().load();

    const rehydrated = useInventoryStore
      .getState()
      .products.find((item) => item.id === product.id);
    expect(rehydrated).toBeDefined();
    expect(rehydrated?.price).toBe(nextPrice);
  });

  it("HU-09 rehidrata tiendas, categorías y productos completos tras reinicio", async () => {
    await useInventoryStore.getState().load();

    await useInventoryStore.getState().addStore({
      name: "Nintendo Store Monterrey",
      location: "Plaza Fiesta San Agustín",
    });

    const baseStoreId = useInventoryStore.getState().stores[0].id;
    const category = await useInventoryStore.getState().addCategory({
      storeId: baseStoreId,
      name: "Coleccionables Retro",
    });

    await useInventoryStore.getState().addProduct({
      storeId: baseStoreId,
      categoryId: category.id,
      name: "Control NES Clásico",
      price: 1299,
      stock: 8,
    });

    useInventoryStore.setState({
      stores: [],
      categories: [],
      products: [],
      productTemplates: [],
      inventoryMovements: [],
      isReady: false,
    });

    await useInventoryStore.getState().load();

    const state = useInventoryStore.getState();
    expect(state.isReady).toBe(true);
    expect(state.stores.length).toBeGreaterThan(2);
    expect(
      state.categories.some((item) => item.name === "Coleccionables Retro")
    ).toBe(true);
    expect(
      state.products.some((item) => item.name === "Control NES Clásico")
    ).toBe(true);
  });

  it("HU-10 elimina una tienda sin movimientos pendientes", async () => {
    await useInventoryStore.getState().load();
    const storeId = useInventoryStore.getState().stores[0].id;
    const initialStoreCount = useInventoryStore.getState().stores.length;

    await useInventoryStore.getState().removeStore(storeId);

    const state = useInventoryStore.getState();
    expect(state.stores.length).toBe(initialStoreCount - 1);
    expect(state.categories.some((item) => item.storeId === storeId)).toBe(
      false
    );
    expect(state.products.some((item) => item.storeId === storeId)).toBe(false);
  });

  it("HU-10 bloquea eliminar tienda con movimientos pendientes", async () => {
    await useInventoryStore.getState().load();
    const storeId = useInventoryStore.getState().stores[0].id;
    const productId = useInventoryStore
      .getState()
      .products.find((item) => item.storeId === storeId)?.id;
    expect(productId).toBeDefined();

    await useInventoryStore.getState().adjustProductStock(productId!, -1, {
      reason: "sale",
      markPending: true,
    });

    await expect(
      useInventoryStore.getState().removeStore(storeId)
    ).rejects.toThrow(
      "Error: No se puede eliminar. Existen movimientos pendientes"
    );
  });

  it("HU-10 permite eliminar tienda tras sincronizar movimientos", async () => {
    await useInventoryStore.getState().load();
    const storeId = useInventoryStore.getState().stores[0].id;
    const productId = useInventoryStore
      .getState()
      .products.find((item) => item.storeId === storeId)?.id;
    expect(productId).toBeDefined();

    await useInventoryStore.getState().adjustProductStock(productId!, 2, {
      reason: "restock",
      markPending: true,
    });

    await useInventoryStore.getState().markStoreMovementsSynced(storeId);

    await expect(
      useInventoryStore.getState().removeStore(storeId)
    ).resolves.toBeUndefined();
  });

  it("HU-13 transfiere stock entre tiendas y registra movimientos", async () => {
    await useInventoryStore.getState().load();
    const state = useInventoryStore.getState();
    const originStore = state.stores[0];
    const destinationStore = state.stores.find(
      (store) => store.id !== originStore.id
    );
    expect(destinationStore).toBeDefined();

    const originProduct = state.products.find(
      (product) => product.storeId === originStore.id && product.stock >= 3
    );
    expect(originProduct).toBeDefined();

    const destinationCategory = state.categories.find(
      (category) => category.storeId === destinationStore!.id
    );
    expect(destinationCategory).toBeDefined();

    const destinationProduct = await useInventoryStore.getState().addProduct({
      storeId: destinationStore!.id,
      categoryId: destinationCategory!.id,
      name: originProduct!.name,
      price: originProduct!.price,
      stock: 2,
    });

    const result = await useInventoryStore.getState().transferProductStock({
      productId: originProduct!.id,
      targetProductId: destinationProduct.id,
      quantity: 3,
    });

    const updatedState = useInventoryStore.getState();
    const refreshedOrigin = updatedState.products.find(
      (product) => product.id === originProduct!.id
    );
    const refreshedDestination = updatedState.products.find(
      (product) => product.id === destinationProduct.id
    );

    expect(result.quantity).toBe(3);
    expect(refreshedOrigin?.stock).toBe(originProduct!.stock - 3);
    expect(refreshedDestination?.stock).toBe(5);

    const recentMovements = updatedState.inventoryMovements.slice(-2);
    expect(recentMovements).toHaveLength(2);
    expect(recentMovements[0].reason).toBe("transfer");
    expect(recentMovements[1].reason).toBe("transfer");
    expect(recentMovements[0].delta).toBe(-3);
    expect(recentMovements[1].delta).toBe(3);
    expect(recentMovements[0].synced).toBe(false);
    expect(recentMovements[1].synced).toBe(false);
  });

  it("HU-13 bloquea transferencia cuando falta stock suficiente", async () => {
    await useInventoryStore.getState().load();
    const state = useInventoryStore.getState();
    const originStore = state.stores[0];
    const destinationStore = state.stores.find(
      (store) => store.id !== originStore.id
    );
    expect(destinationStore).toBeDefined();

    const originProduct = state.products.find(
      (product) => product.storeId === originStore.id
    );
    expect(originProduct).toBeDefined();

    const destinationCategory = state.categories.find(
      (category) => category.storeId === destinationStore!.id
    );
    expect(destinationCategory).toBeDefined();

    const destinationProduct = await useInventoryStore.getState().addProduct({
      storeId: destinationStore!.id,
      categoryId: destinationCategory!.id,
      name: `${originProduct!.name} destino`,
      price: originProduct!.price,
      stock: 0,
    });

    const excessiveQuantity = originProduct!.stock + 5;

    await expect(
      useInventoryStore.getState().transferProductStock({
        productId: originProduct!.id,
        targetProductId: destinationProduct.id,
        quantity: excessiveQuantity,
      })
    ).rejects.toThrow(
      `Error: stock insuficiente en la tienda de origen. Máximo disponible: ${
        originProduct!.stock
      }.`
    );
  });
});
