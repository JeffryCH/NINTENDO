import { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
} from "react-native";
import { Button, Chip, Surface } from "heroui-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import { StoreCard } from "@/components/StoreCard";
import { AddStoreModal } from "@/components/AddStoreModal";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { formatCurrency } from "@/utils/formatCurrency";
import type { MediaAsset, Store } from "@/types/inventory";

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string }>();
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
  const [reportPending, setReportPending] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [onlyAlertStores, setOnlyAlertStores] = useState(false);
  const [storeSortOption, setStoreSortOption] = useState<
    "name-asc" | "value-desc" | "products-desc"
  >("name-asc");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const metricsByStore = useMemo(() => {
    const storeMetrics = new Map<
      string,
      {
        productCount: number;
        stockValue: number;
        lowStock: number;
      }
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

  const storeEntries = useMemo(
    () =>
      stores.map((store) => ({
        store,
        metrics: metricsByStore.get(store.id) ?? {
          productCount: 0,
          stockValue: 0,
          lowStock: 0,
        },
      })),
    [stores, metricsByStore]
  );

  const normalizedStoreQuery = storeSearchQuery.trim().toLowerCase();

  const filteredStores = useMemo(() => {
    return storeEntries.filter((entry) => {
      if (normalizedStoreQuery) {
        const nameMatch = entry.store.name
          .trim()
          .toLowerCase()
          .includes(normalizedStoreQuery);
        const locationMatch = entry.store.location
          ?.trim()
          .toLowerCase()
          .includes(normalizedStoreQuery);
        if (!nameMatch && !locationMatch) {
          return false;
        }
      }

      if (onlyAlertStores && entry.metrics.lowStock === 0) {
        return false;
      }

      return true;
    });
  }, [storeEntries, normalizedStoreQuery, onlyAlertStores]);

  const sortedStores = useMemo(() => {
    const sorted = [...filteredStores];
    sorted.sort((a, b) => {
      switch (storeSortOption) {
        case "value-desc":
          if (b.metrics.stockValue !== a.metrics.stockValue) {
            return b.metrics.stockValue - a.metrics.stockValue;
          }
          break;
        case "products-desc":
          if (b.metrics.productCount !== a.metrics.productCount) {
            return b.metrics.productCount - a.metrics.productCount;
          }
          break;
        default:
          return a.store.name.localeCompare(b.store.name);
      }
      return a.store.name.localeCompare(b.store.name);
    });
    return sorted;
  }, [filteredStores, storeSortOption]);

  const storeSearchActive = normalizedStoreQuery.length > 0;
  const storeFiltersActive = onlyAlertStores;
  const canResetStoreFilters =
    storeSearchActive || storeFiltersActive || storeSortOption !== "name-asc";
  const filteredStoresEmpty = stores.length > 0 && sortedStores.length === 0;

  const handleSubmitStore = async (payload: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
    imageAsset?: MediaAsset;
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
              const message =
                removeError instanceof Error
                  ? removeError.message
                  : "No se pudo eliminar la tienda.";
              setError(message);
              Alert.alert("Eliminar tienda", message);
            }
          },
        },
      ]
    );
  };

  const handleGenerateReport = async () => {
    if (stores.length === 0) {
      Alert.alert(
        "Reporte de tiendas",
        "Agrega al menos una tienda para generar el reporte."
      );
      return;
    }

    setReportPending(true);
    try {
      const timestamp = new Date().toLocaleString();
      const rows = stores
        .map((store) => {
          const metrics = metricsByStore.get(store.id) ?? {
            productCount: 0,
            stockValue: 0,
            lowStock: 0,
          };
          return `
            <tr>
              <td>${store.name}</td>
              <td>${store.location}</td>
              <td>${metrics.productCount}</td>
              <td>${formatCurrency(metrics.stockValue)}</td>
              <td>${metrics.lowStock}</td>
            </tr>
          `;
        })
        .join("");

      const html = `<!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Roboto', sans-serif; padding: 24px; color: #1b1d2a; }
              h1 { font-size: 24px; margin-bottom: 4px; }
              p { margin: 0 0 16px 0; color: #4b4e65; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #d9dbe8; padding: 12px; text-align: left; font-size: 13px; }
              th { background-color: #eef1ff; font-weight: 700; }
              tbody tr:nth-child(even) { background-color: #f7f8ff; }
            </style>
          </head>
          <body>
            <h1>Reporte de tiendas</h1>
            <p>Generado el ${timestamp}</p>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ubicación</th>
                  <th>Productos</th>
                  <th>Valor inventario</th>
                  <th>Bajo stock</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </body>
        </html>`;

      const file = await printToFileAsync({ html, base64: false });
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Compartir reporte de tiendas",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Reporte de tiendas", `Reporte generado en: ${file.uri}`);
      }
    } catch (reportError) {
      console.error("generate-report-error", reportError);
      Alert.alert(
        "Reporte de tiendas",
        "No se pudo generar el reporte. Intenta nuevamente."
      );
    } finally {
      setReportPending(false);
    }
  };

  const handleGenerateStoreReport = async (store: Store) => {
    try {
      const timestamp = new Date().toLocaleString();
      const storeProducts = products.filter((p) => p.storeId === store.id);
      const productCount = storeProducts.length;
      const stockValue = storeProducts.reduce(
        (acc, p) =>
          acc + p.stock * (p.hasOffer && p.offerPrice ? p.offerPrice : p.price),
        0
      );
      const lowStock = storeProducts.filter((p) => p.stock <= 3).length;

      const html = `<!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <style>
              body { font-family: 'Roboto', sans-serif; padding: 24px; color: #1b1d2a; }
              h1 { font-size: 24px; margin-bottom: 4px; }
              p { margin: 0 0 16px 0; color: #4b4e65; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #d9dbe8; padding: 12px; text-align: left; font-size: 13px; }
              th { background-color: #eef1ff; font-weight: 700; }
              tbody tr:nth-child(even) { background-color: #f7f8ff; }
            </style>
          </head>
          <body>
            <h1>Reporte de tienda: ${store.name}</h1>
            <p>Generado el ${timestamp}</p>
            <table>
              <thead>
                <tr>
                  <th>Ubicación</th>
                  <th>Productos</th>
                  <th>Valor inventario</th>
                  <th>Bajo stock</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${store.location ?? "-"}</td>
                  <td>${productCount}</td>
                  <td>${formatCurrency(stockValue)}</td>
                  <td>${lowStock}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>`;

      const file = await printToFileAsync({ html, base64: false });
      const canShare = await isAvailableAsync();
      if (canShare) {
        await shareAsync(file.uri, {
          mimeType: "application/pdf",
          dialogTitle: `Compartir reporte de ${store.name}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Reporte de tienda", `Reporte generado en: ${file.uri}`);
      }
    } catch (error) {
      Alert.alert(
        "Reporte de tienda",
        "No se pudo generar el reporte. Intenta nuevamente."
      );
    }
  };

  const clearStoreFilters = () => {
    setStoreSearchQuery("");
    setOnlyAlertStores(false);
    setStoreSortOption("name-asc");
  };

  const handleToggleQuickActions = () => {
    setQuickActionsOpen((current) => !current);
  };

  const handleQuickReport = async () => {
    setQuickActionsOpen(false);
    await handleGenerateReport();
  };

  const handleQuickCreate = () => {
    setQuickActionsOpen(false);
    handleOpenCreateModal();
  };

  useEffect(() => {
    if (params.action === "create-store") {
      handleOpenCreateModal();
      // limpia el parámetro para evitar reabrir en back
      router.setParams({});
    }
  }, [params, router]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.heading}>Inventario Nintendo</Text>
            <Pressable
              style={styles.iconButton}
              onPress={handleToggleQuickActions}
              accessibilityLabel="Abrir menú de acciones"
            >
              <Ionicons
                name={quickActionsOpen ? "close" : "ellipsis-horizontal"}
                size={20}
                color="#d8dcff"
              />
            </Pressable>
          </View>

          {quickActionsOpen ? (
            <Surface style={styles.quickActionsSheet}>
              <Pressable
                style={styles.quickAction}
                onPress={handleQuickReport}
                disabled={reportPending || stores.length === 0}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="rgba(216,220,255,0.92)"
                />
                <Text style={styles.quickActionLabel}>
                  {reportPending ? "Generando..." : "Generar reporte"}
                </Text>
              </Pressable>
              <Pressable style={styles.quickAction} onPress={handleQuickCreate}>
                <Ionicons
                  name="add-circle-outline"
                  size={18}
                  color="rgba(216,220,255,0.92)"
                />
                <Text style={styles.quickActionLabel}>Añadir tienda</Text>
              </Pressable>
            </Surface>
          ) : null}

          {/* Botones del header eliminados: ahora vive en menú y FAB global */}
        </View>

        <Surface style={styles.storeControls}>
          <View style={styles.filterHeader}>
            <Pressable
              style={styles.filterTitleRow}
              onPress={() => setShowAdvancedFilters((c) => !c)}
            >
              <Ionicons
                name={showAdvancedFilters ? "filter" : "options-outline"}
                size={16}
                color="#8fa2ff"
              />
              <Text style={styles.filterTitle}>
                {showAdvancedFilters ? "Filtros rápidos" : "Opciones"}
              </Text>
            </Pressable>
            <Pressable
              onPress={clearStoreFilters}
              disabled={!canResetStoreFilters}
              style={({ pressed }) => [
                styles.filterClear,
                pressed && styles.filterClearPressed,
                !canResetStoreFilters && styles.filterClearDisabled,
              ]}
              accessibilityLabel="Limpiar filtros"
            >
              <Text
                style={
                  !canResetStoreFilters
                    ? styles.filterClearTextDisabled
                    : styles.filterClearText
                }
              >
                Limpiar
              </Text>
            </Pressable>
          </View>

          <View style={styles.storeSearchRow}>
            <TextInput
              style={[styles.storeSearchInput, styles.storeSearchField]}
              placeholder="Buscar tienda por nombre o ubicación"
              placeholderTextColor="rgba(255,255,255,0.55)"
              value={storeSearchQuery}
              onChangeText={setStoreSearchQuery}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="search"
            />
          </View>

          {showAdvancedFilters ? (
            <View style={styles.storeFilterRow}>
              <Chip
                variant={onlyAlertStores ? "primary" : "secondary"}
                onPress={() => setOnlyAlertStores((current) => !current)}
              >
                <Chip.Label>Solo con alerta de stock</Chip.Label>
              </Chip>
            </View>
          ) : null}

          {showAdvancedFilters ? (
            <View style={styles.storeSortRow}>
              {[
                { key: "name-asc" as const, label: "Nombre A-Z" },
                { key: "value-desc" as const, label: "Valor inventario" },
                { key: "products-desc" as const, label: "Productos" },
              ].map((option) => (
                <Chip
                  key={option.key}
                  variant={
                    storeSortOption === option.key ? "primary" : "secondary"
                  }
                  onPress={() => setStoreSortOption(option.key)}
                >
                  <Chip.Label>{option.label}</Chip.Label>
                </Chip>
              ))}
            </View>
          ) : null}
        </Surface>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="home-outline" size={16} color="#8fa2ff" />
              <Text style={styles.metricLabel}>Tiendas</Text>
            </View>
            <Text style={styles.metricValue}>{stores.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cube-outline" size={16} color="#8fa2ff" />
              <Text style={styles.metricLabel}>Productos</Text>
            </View>
            <Text style={styles.metricValue}>
              {globalMetrics.totalProducts}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="stats-chart-outline" size={16} color="#8fa2ff" />
              <Text style={styles.metricLabel}>Stock total</Text>
            </View>
            <Text style={styles.metricValue}>{globalMetrics.totalStock}</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cash-outline" size={16} color="#8fa2ff" />
              <Text style={styles.metricLabel}>Valor inventario</Text>
            </View>
            <Text style={styles.metricValueSmall}>
              {formatCurrency(globalMetrics.inventoryValue)}
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiendas activas</Text>
        </View>

        <View style={styles.list}>
          {sortedStores.length > 0
            ? sortedStores.map(({ store, metrics }) => (
                <View key={store.id} style={styles.storeBlock}>
                  <StoreCard
                    store={store}
                    productCount={metrics.productCount}
                    inventoryValue={metrics.stockValue}
                    lowStockCount={metrics.lowStock}
                    onEdit={() => handleEditStore(store)}
                    onDelete={() => handleDeleteStore(store)}
                    onReport={() => handleGenerateStoreReport(store)}
                  />
                </View>
              ))
            : null}
          {stores.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin tiendas registradas</Text>
              <Text style={styles.emptySubtitle}>
                Agrega la primera tienda para comenzar a catalogar productos,
                categorías y ofertas.
              </Text>
            </View>
          ) : null}
          {filteredStoresEmpty ? (
            <View style={styles.filteredEmpty}>
              <Text style={styles.filteredEmptyTitle}>
                No hay coincidencias
              </Text>
              <Text style={styles.filteredEmptySubtitle}>
                Ajusta la búsqueda o desactiva los filtros para ver nuevamente
                las tiendas.
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
                imageAsset: selectedStore.imageAsset,
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
    flexDirection: "column",
    gap: 12,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  headerActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  headerActionButton: {
    minWidth: 150,
  },
  actionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  quickActionsSheet: {
    backgroundColor: "rgba(16,22,43,0.95)",
    borderRadius: 14,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  quickActionLabel: {
    color: "#d8dcff",
    fontWeight: "600",
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
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  storeControls: {
    backgroundColor: "rgba(16,22,43,0.85)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterTitle: {
    color: "#e6e9ff",
    fontWeight: "700",
  },
  filterClear: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterClearPressed: {
    opacity: 0.9,
  },
  filterClearDisabled: {
    opacity: 0.5,
  },
  filterClearText: {
    color: "#b7c4ff",
    fontWeight: "600",
  },
  filterClearTextDisabled: {
    color: "rgba(183,196,255,0.5)",
    fontWeight: "600",
  },
  storeSearchRow: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  storeSearchInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  storeSearchField: {
    flex: 1,
  },
  storeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  storeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  storeFilterChipActive: {
    backgroundColor: "rgba(86,104,255,0.26)",
    borderWidth: 1,
    borderColor: "rgba(86,104,255,0.75)",
  },
  storeFilterChipLabel: {
    color: "rgba(216,220,255,0.88)",
    fontWeight: "600",
  },
  storeFilterChipLabelActive: {
    color: "#ffffff",
  },
  storeSortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  list: {
    gap: 16,
    paddingBottom: 24,
  },
  storeBlock: {
    gap: 10,
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
  filteredEmpty: {
    backgroundColor: "rgba(16,22,43,0.8)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 6,
  },
  filteredEmptyTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  filteredEmptySubtitle: {
    color: "rgba(255,255,255,0.7)",
  },
});
