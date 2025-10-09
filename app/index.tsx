import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { StoreCard } from "@/components/StoreCard";
import { AddStoreModal } from "@/components/AddStoreModal";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { formatCurrency } from "@/utils/formatCurrency";

export default function HomeScreen() {
  const stores = useInventoryStore((state) => state.stores);
  const products = useInventoryStore((state) => state.products);
  const addStore = useInventoryStore((state) => state.addStore);

  const [newStoreVisible, setNewStoreVisible] = useState(false);
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

  const handleCreateStore = async (payload: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
  }) => {
    try {
      await addStore(payload);
      setError(null);
    } catch (storeError) {
      setError(
        storeError instanceof Error
          ? storeError.message
          : "No se pudo crear la tienda."
      );
      throw storeError;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.heading}>Inventario Nintendo</Text>
            <Text style={styles.subheading}>
              Gestiona tiendas, stock y ofertas en tiempo real.
            </Text>
          </View>
          <Pressable
            style={styles.primaryButton}
            onPress={() => setNewStoreVisible(true)}
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
              <StoreCard
                key={store.id}
                store={store}
                productCount={metrics.productCount}
                inventoryValue={metrics.stockValue}
                lowStockCount={metrics.lowStock}
              />
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
        visible={newStoreVisible}
        onClose={() => setNewStoreVisible(false)}
        onSubmit={handleCreateStore}
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
    alignItems: "center",
    gap: 16,
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
