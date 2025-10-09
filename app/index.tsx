import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { StoreCard } from "@/components/StoreCard";
import { AddStoreModal } from "@/components/AddStoreModal";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { formatCurrency } from "@/utils/formatCurrency";
import type { Store } from "@/types/inventory";

export default function HomeScreen() {
  const stores = useInventoryStore((state) => state.stores);
  const products = useInventoryStore((state) => state.products);
  const addStore = useInventoryStore((state) => state.addStore);
  const updateStore = useInventoryStore((state) => state.updateStore);
  const removeStore = useInventoryStore((state) => state.removeStore);

  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [storeModalMode, setStoreModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metricsByStore = useMemo(() => {
    const storeMetrics = new Map<
      string,
      { productCount: number; stockValue: number; lowStock: number }
    >();

    stores.forEach((store) => {
      storeMetrics.set(store.id, {
        productCount: 0,
        stockValue: 0,
        lowStock: 0,
      });
    });

    products.forEach((product) => {
      const metrics = storeMetrics.get(product.storeId);
      if (!metrics) return;

      metrics.productCount += 1;
      metrics.stockValue +=
        product.stock *
        (product.hasOffer && product.offerPrice
          ? product.offerPrice
          : product.price);
      if (product.stock <= 3) {
        metrics.lowStock += 1;
      }
    });

    return storeMetrics;
  }, [stores, products]);

  const globalMetrics = useMemo(() => {
    const totalProducts = products.length;
    const totalStock = products.reduce(
      (acc, product) => acc + product.stock,
      0
    );
    const inventoryValue = products.reduce(
      (acc, product) =>
        acc +
        product.stock *
          (product.hasOffer && product.offerPrice
            ? product.offerPrice
            : product.price),
      0
    );
    const lowStock = products.filter((product) => product.stock <= 3).length;

    return { totalProducts, totalStock, inventoryValue, lowStock };
  }, [products]);

  const handleSubmitStore = async (payload: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
  }) => {
    try {
      if (storeModalMode === "edit" && selectedStore) {
        await updateStore({ storeId: selectedStore.id, data: payload });
      } else {
        await addStore(payload);
      }
      setError(null);
    } catch (storeError) {
      setError(
        storeError instanceof Error
          ? storeError.message
          : storeModalMode === "edit"
          ? "No se pudo actualizar la tienda."
          : "No se pudo crear la tienda."
      );
      throw storeError;
    }
  };

  const handleOpenCreateModal = () => {
    setError(null);
    setSelectedStore(null);
    setStoreModalMode("create");
    setStoreModalVisible(true);
  };

  const handleEditStore = (store: Store) => {
    setError(null);
    setSelectedStore(store);
    setStoreModalMode("edit");
    setStoreModalVisible(true);
  };

  const handleDeleteStore = (store: Store) => {
    Alert.alert(
      "Eliminar tienda",
      `¿Seguro que deseas eliminar ${store.name}? También se eliminarán sus categorías y productos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeStore(store.id);
              setError(null);
              if (selectedStore?.id === store.id) {
                setStoreModalVisible(false);
                setSelectedStore(null);
                setStoreModalMode("create");
              }
            } catch (removeError) {
              setError(
                removeError instanceof Error
                  ? removeError.message
                  : "No se pudo eliminar la tienda."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.heading}>Inventario Nintendo</Text>
            <Text style={styles.subheading}>
              Gestiona tiendas, stock y ofertas en tiempo real.
            </Text>
          </View>
          <Pressable
            style={[styles.primaryButton, styles.headerButton]}
            onPress={handleOpenCreateModal}
          >
            <Text style={styles.primaryButtonLabel}>Añadir tienda</Text>
          </Pressable>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tiendas</Text>
            <Text style={styles.metricValue}>{stores.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Productos</Text>
            <Text style={styles.metricValue}>
              {globalMetrics.totalProducts}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Stock total</Text>
            <Text style={styles.metricValue}>{globalMetrics.totalStock}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Valor inventario</Text>
            <Text style={styles.metricValueSmall}>
              {formatCurrency(globalMetrics.inventoryValue)}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiendas activas</Text>
          <Text style={styles.sectionSubtitle}>
            Consulta disponibilidad, ofertas y bajo stock por tienda.
          </Text>
        </View>

        <View style={styles.list}>
          {stores.map((store) => {
            const metrics = metricsByStore.get(store.id) ?? {
              productCount: 0,
              stockValue: 0,
              lowStock: 0,
            };
            return (
              <View key={store.id} style={styles.storeBlock}>
                <StoreCard
                  store={store}
                  productCount={metrics.productCount}
                  inventoryValue={metrics.stockValue}
                  lowStockCount={metrics.lowStock}
                />
                <View style={styles.storeActions}>
                  <Pressable
                    style={styles.storeActionButton}
                    onPress={() => handleEditStore(store)}
                  >
                    <Text style={styles.storeActionLabel}>Editar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.storeActionButton, styles.storeDeleteButton]}
                    onPress={() => handleDeleteStore(store)}
                  >
                    <Text
                      style={[styles.storeActionLabel, styles.storeDeleteLabel]}
                    >
                      Eliminar
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {stores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin tiendas registradas</Text>
              <Text style={styles.emptySubtitle}>
                Agrega la primera tienda para comenzar a catalogar productos,
                categorías y ofertas.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <AddStoreModal
        visible={storeModalVisible}
        mode={storeModalMode}
        initialValues={
          storeModalMode === "edit" && selectedStore
            ? {
                name: selectedStore.name,
                location: selectedStore.location,
                description: selectedStore.description,
                imageUrl: selectedStore.imageUrl,
              }
            : undefined
        }
        onClose={() => {
          setStoreModalVisible(false);
          setSelectedStore(null);
          setStoreModalMode("create");
        }}
        onSubmit={handleSubmitStore}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080b16",
  },
  scrollContent: {
    padding: 24,
    gap: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  headerContent: {
    flexShrink: 1,
    gap: 6,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },
  subheading: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    maxWidth: 260,
  },
  primaryButton: {
    backgroundColor: "#5668ff",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  headerButton: {
    alignSelf: "flex-start",
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flexBasis: "47%",
    backgroundColor: "#10162b",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  metricValueSmall: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "rgba(255,255,255,0.6)",
  },
  list: {
    gap: 16,
    paddingBottom: 24,
  },
  storeBlock: {
    gap: 10,
  },
  storeActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
  },
  storeActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(86,104,255,0.16)",
  },
  storeActionLabel: {
    color: "#d8dcff",
    fontWeight: "600",
  },
  storeDeleteButton: {
    backgroundColor: "rgba(255,99,132,0.18)",
  },
  storeDeleteLabel: {
    color: "#ff6384",
  },
  error: {
    color: "#ff6384",
    fontSize: 13,
  },
  emptyState: {
    backgroundColor: "#10162b",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
});
