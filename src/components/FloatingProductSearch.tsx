import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { useInventoryStore } from "@/stores/useInventoryStore";
import {
  filterProductsByQuery,
  findStoreMatchesByBarcode,
} from "@/utils/productSearch";
import type { Product, Store } from "@/types/inventory";

interface SearchResult {
  product: Product;
  store: Store;
}

interface StoreSelectionState {
  code: string;
  productName: string;
  matches: Array<{
    product: Product;
    store: Store;
  }>;
}

export const FloatingProductSearch = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stores = useInventoryStore((state) => state.stores);
  const products = useInventoryStore((state) => state.products);
  const productTemplates = useInventoryStore((state) => state.productTemplates);

  const [searchVisible, setSearchVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [selectionState, setSelectionState] =
    useState<StoreSelectionState | null>(null);

  const suggestions = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return [] as SearchResult[];
    }

    const matches: SearchResult[] = [];
    const filtered = filterProductsByQuery(products, trimmed, {
      templates: productTemplates,
    });
    for (const product of filtered) {
      const store = stores.find((item) => item.id === product.storeId);
      if (!store) {
        continue;
      }
      matches.push({
        product,
        store,
      });
      if (matches.length >= 30) {
        break;
      }
    }
    return matches;
  }, [products, stores, query]);

  const closeSearch = useCallback(() => {
    setSearchVisible(false);
    setQuery("");
  }, []);

  const navigateToProduct = useCallback(
    (product: Product, store: Store) => {
      closeSearch();
      setScannerVisible(false);
      setSelectionState(null);
      router.push({
        pathname: "/store/[storeId]",
        params: { storeId: store.id, productId: product.id },
      });
    },
    [router, closeSearch]
  );

  const handleSelectSuggestion = useCallback(
    (item: SearchResult) => {
      navigateToProduct(item.product, item.store);
    },
    [navigateToProduct]
  );

  const handleScanDetected = useCallback(
    (value: string) => {
      const matches = findStoreMatchesByBarcode(products, stores, value, {
        templates: productTemplates,
      });
      if (matches.length === 0) {
        Alert.alert(
          "Sin coincidencias",
          "No encontramos productos asociados a este código."
        );
        return;
      }

      if (matches.length === 1) {
        navigateToProduct(matches[0].product, matches[0].store);
        return;
      }

      setSearchVisible(false);
      setScannerVisible(false);
      setSelectionState({
        code: value,
        productName: matches[0].product.name,
        matches,
      });
    },
    [navigateToProduct, products, stores, productTemplates]
  );

  const renderSuggestion = ({ item }: { item: SearchResult }) => {
    return (
      <Pressable
        style={styles.resultRow}
        onPress={() => handleSelectSuggestion(item)}
      >
        <View style={styles.resultContent}>
          <Text style={styles.resultName}>{item.product.name}</Text>
          <Text style={styles.resultMeta}>
            {item.store.name} · Stock: {item.product.stock}
          </Text>
          {item.product.barcodes?.upc ? (
            <Text style={styles.resultBarcode}>
              UPC: {item.product.barcodes.upc}
            </Text>
          ) : null}
          {item.product.barcodes?.box ? (
            <Text style={styles.resultBarcode}>
              Caja: {item.product.barcodes.box}
            </Text>
          ) : null}
        </View>
        <Text style={styles.resultNavigate}>Abrir</Text>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={() => {
          setSearchVisible(true);
        }}
        style={[
          styles.fab,
          {
            bottom: Math.max(insets.bottom + 24, 24),
            right: Math.max(insets.right + 20, 20),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Buscar productos"
      >
        <Text style={styles.fabLabel}>Buscar</Text>
      </Pressable>

      <Modal
        visible={searchVisible}
        transparent
        animationType="fade"
        onRequestClose={closeSearch}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: undefined })}
            style={styles.sheet}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Buscar producto</Text>
              <Pressable onPress={closeSearch} style={styles.closeButton}>
                <Text style={styles.closeLabel}>Cerrar</Text>
              </Pressable>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Nombre o código de barras"
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={styles.input}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                selectionColor="#5668ff"
                keyboardAppearance="dark"
              />
              <Pressable
                style={styles.scanButton}
                onPress={() => {
                  setScannerVisible(true);
                  setSearchVisible(false);
                }}
              >
                <Text style={styles.scanLabel}>Escanear</Text>
              </Pressable>
            </View>
            {query.trim().length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Empieza a escribir</Text>
                <Text style={styles.emptySubtitle}>
                  Busca por nombre, descripción o códigos de barras.
                </Text>
              </View>
            ) : suggestions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>
                  No se encontraron productos
                </Text>
                <Text style={styles.emptySubtitle}>
                  Intenta con otro término o escanea un código.
                </Text>
              </View>
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.product.id}
                renderItem={renderSuggestion}
                style={styles.resultList}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => {
          setScannerVisible(false);
        }}
        onDetected={handleScanDetected}
        title="Escanear producto"
      />

      <Modal
        visible={selectionState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectionState(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.selectionSheet}>
            <Text style={styles.sheetTitle}>Selecciona una tienda</Text>
            {selectionState ? (
              <Text style={styles.selectionSubtitle}>
                {selectionState.productName} · Código {selectionState.code}
              </Text>
            ) : null}
            <FlatList
              data={selectionState?.matches ?? []}
              keyExtractor={(item) => `${item.store.id}-${item.product.id}`}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.selectionRow}
                  onPress={() => navigateToProduct(item.product, item.store)}
                >
                  <View style={styles.resultContent}>
                    <Text style={styles.resultName}>{item.store.name}</Text>
                    <Text style={styles.resultMeta}>
                      Stock disponible: {item.product.stock}
                    </Text>
                    <Text style={styles.resultMeta}>{item.store.location}</Text>
                  </View>
                  <Text style={styles.resultNavigate}>Ir</Text>
                </Pressable>
              )}
            />
            <Pressable
              style={styles.selectionClose}
              onPress={() => setSelectionState(null)}
            >
              <Text style={styles.closeLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    backgroundColor: "#5668ff",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabLabel: {
    color: "#ffffff",
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#10162b",
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 6,
  },
  closeLabel: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  scanButton: {
    backgroundColor: "rgba(86,104,255,0.18)",
    borderRadius: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scanLabel: {
    color: "#d8dcff",
    fontWeight: "600",
  },
  emptyState: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: 13,
  },
  resultList: {
    maxHeight: 320,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  resultContent: {
    flex: 1,
    gap: 4,
  },
  resultName: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  resultMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  resultBarcode: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
  },
  resultNavigate: {
    color: "#9aa4ff",
    fontWeight: "700",
  },
  selectionSheet: {
    backgroundColor: "#10162b",
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  selectionSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  selectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  selectionClose: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
