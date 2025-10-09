import { useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
} from "react-native";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { ProductCard } from "@/components/ProductCard";
import { AddProductModal, ProductFormData } from "@/components/AddProductModal";
import { formatCurrency } from "@/utils/formatCurrency";

export default function StoreDetailScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useInventoryStore((state) =>
    state.stores.find((item) => item.id === storeId)
  );
  const categories = useInventoryStore((state) =>
    state.categories.filter((category) => category.storeId === storeId)
  );
  const products = useInventoryStore((state) =>
    state.products.filter((product) => product.storeId === storeId)
  );
  const addCategory = useInventoryStore((state) => state.addCategory);
  const addProduct = useInventoryStore((state) => state.addProduct);
  const setProductStock = useInventoryStore((state) => state.setProductStock);
  const toggleOffer = useInventoryStore((state) => state.toggleOffer);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, typeof products>();

    categories.forEach((category) => {
      map.set(category.id, []);
    });

    products.forEach((product) => {
      const bucket = map.get(product.categoryId);
      if (bucket) {
        bucket.push(product);
      } else {
        map.set(product.categoryId, [product]);
      }
    });

    return map;
  }, [categories, products]);

  const stats = useMemo(() => {
    const totalStock = products.reduce(
      (acc, product) => acc + product.stock,
      0
    );
    const value = products.reduce(
      (acc, product) =>
        acc +
        product.stock *
          (product.hasOffer && product.offerPrice
            ? product.offerPrice
            : product.price),
      0
    );
    const lowStock = products.filter((product) => product.stock <= 3).length;

    return { totalStock, value, lowStock };
  }, [products]);

  const handleCreateProduct = async (data: ProductFormData) => {
    if (!storeId) return;

    try {
      let categoryId = categories.find(
        (category) =>
          category.name.toLowerCase() === data.categoryName.toLowerCase()
      )?.id;
      if (!categoryId) {
        const newCategory = await addCategory({
          storeId,
          name: data.categoryName,
        });
        categoryId = newCategory.id;
      }

      await addProduct({
        storeId,
        categoryId,
        name: data.name,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        description: data.description,
        hasOffer: data.hasOffer,
        offerPrice: data.offerPrice,
      });
      setError(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el producto."
      );
      throw submitError;
    }
  };

  const handleStockChange = async (productId: string, delta: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const nextStock = Math.max(0, product.stock + delta);
    await setProductStock(productId, nextStock);
  };

  const handleToggleOffer = async (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const enable = !product.hasOffer;
    const referencePrice =
      enable && product.offerPrice ? product.offerPrice : product.price * 0.9;
    const normalizedOffer = Math.max(1, Math.round(referencePrice));

    await toggleOffer(productId, enable, enable ? normalizedOffer : undefined);
  };

  if (!store) {
    return (
      <SafeAreaView style={styles.notFoundContainer}>
        <View style={styles.notFoundContent}>
          <Text style={styles.notFoundTitle}>Tienda no encontrada</Text>
          <Text style={styles.notFoundSubtitle}>
            La tienda no existe o fue eliminada.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace("/")}
          >
            <Text style={styles.primaryButtonLabel}>Volver a listado</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {store.imageUrl ? (
            <Image
              source={{ uri: store.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.heroOverlay}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backLabel}>Regresar</Text>
            </Pressable>
            <Text style={styles.heroTitle}>{store.name}</Text>
            <Text style={styles.heroSubtitle}>{store.location}</Text>
            {store.description ? (
              <Text style={styles.heroDescription}>{store.description}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Productos</Text>
            <Text style={styles.metricValue}>{products.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Stock total</Text>
            <Text style={styles.metricValue}>{stats.totalStock}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Valor</Text>
            <Text style={styles.metricValue}>
              {formatCurrency(stats.value)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Bajo stock</Text>
            <Text
              style={[
                styles.metricValue,
                stats.lowStock > 0 && styles.lowStockValue,
              ]}
            >
              {stats.lowStock}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inventario</Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.secondaryLabel}>Añadir producto</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {Array.from(groupedProducts.entries()).map(
          ([categoryId, categoryProducts]) => {
            const category = categories.find((item) => item.id === categoryId);
            return (
              <View key={categoryId} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>
                  {category ? category.name : "Sin categoría"}
                </Text>
                <View style={styles.categoryList}>
                  {categoryProducts.map((product) => (
                    <View key={product.id} style={styles.productRow}>
                      <ProductCard product={product} category={category} />
                      <View style={styles.actionsRow}>
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleStockChange(product.id, -1)}
                        >
                          <Text style={styles.actionLabel}>-1</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleStockChange(product.id, +1)}
                        >
                          <Text style={styles.actionLabel}>+1</Text>
                        </Pressable>
                        <Pressable
                          style={styles.actionButton}
                          onPress={() => handleStockChange(product.id, +5)}
                        >
                          <Text style={styles.actionLabel}>+5</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.offerButton,
                            product.hasOffer && styles.offerButtonActive,
                          ]}
                          onPress={() => handleToggleOffer(product.id)}
                        >
                          <Text
                            style={[
                              styles.offerLabel,
                              product.hasOffer && styles.offerLabelActive,
                            ]}
                          >
                            {product.hasOffer
                              ? "Oferta activa"
                              : "Activar oferta"}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
        )}

        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sin productos todavía</Text>
            <Text style={styles.emptySubtitle}>
              Registra un producto para comenzar a organizar el inventario de
              esta tienda.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.primaryButtonLabel}>Agregar producto</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <AddProductModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        categories={categories}
        onSubmit={handleCreateProduct}
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
    paddingBottom: 48,
  },
  hero: {
    position: "relative",
    height: 260,
    backgroundColor: "#10162b",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 24,
    gap: 8,
    backgroundColor: "rgba(8,11,22,0.4)",
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    backgroundColor: "rgba(8,11,22,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  backLabel: {
    color: "#ffffff",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 16,
  },
  heroDescription: {
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 24,
  },
  metricCard: {
    flexBasis: "47%",
    backgroundColor: "#10162b",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 6,
  },
  metricLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  lowStockValue: {
    color: "#ff6384",
  },
  sectionHeader: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "rgba(86,104,255,0.18)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  secondaryLabel: {
    color: "#b4bcff",
    fontWeight: "600",
  },
  error: {
    color: "#ff6384",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  categoryBlock: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  categoryTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  categoryList: {
    gap: 16,
  },
  productRow: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  actionLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  offerButton: {
    marginLeft: "auto",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(86,104,255,0.16)",
  },
  offerButtonActive: {
    backgroundColor: "rgba(76,195,138,0.18)",
  },
  offerLabel: {
    color: "#b4bcff",
    fontWeight: "600",
  },
  offerLabelActive: {
    color: "#4cc38a",
  },
  emptyState: {
    backgroundColor: "#10162b",
    margin: 24,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
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
  notFoundContainer: {
    flex: 1,
    backgroundColor: "#080b16",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  notFoundContent: {
    alignItems: "center",
    gap: 12,
  },
  notFoundTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  notFoundSubtitle: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
});
