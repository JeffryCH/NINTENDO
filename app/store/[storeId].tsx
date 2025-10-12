import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { ProductCard } from "@/components/ProductCard";
import { AddProductModal, ProductFormData } from "@/components/AddProductModal";
import { AddStoreModal } from "@/components/AddStoreModal";
import { CategoryModal } from "@/components/CategoryModal";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { formatCurrency } from "@/utils/formatCurrency";
import { buildStoreInventoryReportHtml } from "@/utils/reporting";
import { resolveMediaUri } from "@/utils/media";
import type { Category, MediaAsset, Product, Store } from "@/types/inventory";

export default function StoreDetailScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [categoryModalState, setCategoryModalState] = useState<{
    visible: boolean;
    mode: "create" | "edit";
    category: Category | null;
  }>({ visible: false, mode: "create", category: null });
  const [productModalState, setProductModalState] = useState<{
    visible: boolean;
    mode: "create" | "edit";
    product: Product | null;
  }>({ visible: false, mode: "create", product: null });
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  const store = useInventoryStore((state) =>
    state.stores.find((item) => item.id === storeId)
  );
  const storeCollection = useInventoryStore((state) => state.stores);
  const categories = useInventoryStore((state) =>
    state.categories.filter((category) => category.storeId === storeId)
  );
  const products = useInventoryStore((state) =>
    state.products.filter((product) => product.storeId === storeId)
  );
  const allProducts = useInventoryStore((state) => state.products);
  const addCategory = useInventoryStore((state) => state.addCategory);
  const addProduct = useInventoryStore((state) => state.addProduct);
  const updateStore = useInventoryStore((state) => state.updateStore);
  const removeStore = useInventoryStore((state) => state.removeStore);
  const updateCategory = useInventoryStore((state) => state.updateCategory);
  const removeCategory = useInventoryStore((state) => state.removeCategory);
  const updateProduct = useInventoryStore((state) => state.updateProduct);
  const removeProduct = useInventoryStore((state) => state.removeProduct);
  const setProductStock = useInventoryStore((state) => state.setProductStock);
  const toggleOffer = useInventoryStore((state) => state.toggleOffer);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [categories]);
  const storeMap = useMemo(() => {
    const map = new Map<string, Store>();
    storeCollection.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [storeCollection]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const category = categoryMap.get(product.categoryId);
      const fields = [
        product.name,
        product.description ?? "",
        category?.name ?? "",
        product.barcodes?.upc ?? "",
        product.barcodes?.box ?? "",
      ];

      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [products, categoryMap, searchQuery]);

  const groupedProducts = useMemo(() => {
    const map = new Map<string, typeof filteredProducts>();

    categories.forEach((category) => {
      map.set(category.id, []);
    });

    filteredProducts.forEach((product) => {
      const bucket = map.get(product.categoryId);
      if (bucket) {
        bucket.push(product);
      } else {
        map.set(product.categoryId, [product]);
      }
    });

    if (searchQuery.trim()) {
      for (const [key, value] of Array.from(map.entries())) {
        if (value.length === 0) {
          map.delete(key);
        }
      }
    }

    return map;
  }, [categories, filteredProducts, searchQuery]);

  const groupedEntries = useMemo(
    () => Array.from(groupedProducts.entries()),
    [groupedProducts]
  );

  const isSearching = searchQuery.trim().length > 0;

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
    const offerCount = products.filter((product) => product.hasOffer).length;

    return { totalStock, value, lowStock, offerCount };
  }, [products]);

  const availabilityByProductId = useMemo(() => {
    const availability = new Map<
      string,
      { store: Store; product: Product }[]
    >();
    if (!storeId) {
      return availability;
    }

    const toBarcodeSet = (value: Product): Set<string> => {
      const entries = [value.barcodes?.upc, value.barcodes?.box]
        .map((item) => (item ? item.trim().toLowerCase() : ""))
        .filter((item) => item.length > 0);
      return new Set(entries);
    };

    const storeProducts = products;

    storeProducts.forEach((product) => {
      const currentProductBarcodes = toBarcodeSet(product);
      const fallbackKey = product.name.trim().toLowerCase();
      const matches: { store: Store; product: Product }[] = [];

      allProducts.forEach((candidate) => {
        if (candidate.id === product.id) return;
        if (candidate.storeId === product.storeId) return;
        if (candidate.stock <= 0) return;

        const candidateStore = storeMap.get(candidate.storeId);
        if (!candidateStore) return;

        const candidateBarcodes = toBarcodeSet(candidate);
        let isRelated = false;

        if (currentProductBarcodes.size > 0 && candidateBarcodes.size > 0) {
          const hasCommonBarcode = Array.from(candidateBarcodes).some((code) =>
            currentProductBarcodes.has(code)
          );
          if (hasCommonBarcode) {
            isRelated = true;
          }
        }

        if (!isRelated) {
          const candidateKey = candidate.name.trim().toLowerCase();
          isRelated = candidateKey === fallbackKey;
        }

        if (isRelated) {
          matches.push({ store: candidateStore, product: candidate });
        }
      });

      availability.set(product.id, matches);
    });

    return availability;
  }, [allProducts, products, storeId, storeMap]);

  const detailAvailability = detailProduct
    ? availabilityByProductId.get(detailProduct.id) ?? []
    : [];

  const crossStoreSummary = useMemo(() => {
    const summary = new Map<
      string,
      {
        store: Store;
        overlapCount: number;
        totalStock: number;
        bestPrice: number;
        offerMatches: number;
      }
    >();

    availabilityByProductId.forEach((matches) => {
      matches.forEach(({ store: candidateStore, product }) => {
        if (!candidateStore || candidateStore.id === storeId) {
          return;
        }

        const current = summary.get(candidateStore.id) ?? {
          store: candidateStore,
          overlapCount: 0,
          totalStock: 0,
          bestPrice: Number.POSITIVE_INFINITY,
          offerMatches: 0,
        };

        current.overlapCount += 1;
        current.totalStock += product.stock;
        const effectivePrice =
          product.hasOffer && product.offerPrice !== undefined
            ? product.offerPrice
            : product.price;
        if (effectivePrice < current.bestPrice) {
          current.bestPrice = effectivePrice;
        }
        if (product.hasOffer) {
          current.offerMatches += 1;
        }

        summary.set(candidateStore.id, current);
      });
    });

    return Array.from(summary.values())
      .map((entry) => ({
        store: entry.store,
        overlapCount: entry.overlapCount,
        totalStock: entry.totalStock,
        bestPrice:
          entry.bestPrice === Number.POSITIVE_INFINITY ? null : entry.bestPrice,
        offerMatches: entry.offerMatches,
      }))
      .sort((a, b) => {
        if (b.overlapCount !== a.overlapCount) {
          return b.overlapCount - a.overlapCount;
        }
        return b.totalStock - a.totalStock;
      });
  }, [availabilityByProductId, storeId]);

  const resolveCategoryId = async (categoryName: string): Promise<string> => {
    if (!storeId) {
      throw new Error("No se pudo identificar la tienda actual.");
    }

    const existing = categories.find(
      (category) =>
        category.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
    );
    if (existing) {
      return existing.id;
    }

    const newCategory = await addCategory({
      storeId,
      name: categoryName,
    });
    return newCategory.id;
  };

  const handleSubmitProduct = async (data: ProductFormData) => {
    if (!storeId) return;

    try {
      const categoryId = await resolveCategoryId(data.categoryName);

      if (productModalState.mode === "edit" && productModalState.product) {
        await updateProduct({
          productId: productModalState.product.id,
          data: {
            name: data.name,
            price: data.price,
            stock: data.stock,
            imageUrl: data.imageUrl,
            imageAsset: data.imageAsset,
            description: data.description,
            hasOffer: data.hasOffer,
            offerPrice: data.hasOffer ? data.offerPrice : undefined,
            categoryId,
            barcodes: data.barcodes,
            discountInfo: data.discountInfo,
          },
        });
      } else {
        await addProduct({
          storeId,
          categoryId,
          name: data.name,
          price: data.price,
          stock: data.stock,
          imageUrl: data.imageUrl,
          imageAsset: data.imageAsset,
          description: data.description,
          hasOffer: data.hasOffer,
          offerPrice: data.hasOffer ? data.offerPrice : undefined,
          barcodes: data.barcodes,
          discountInfo: data.discountInfo,
        });
      }

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
    setError(null);
  };

  const handleToggleOffer = async (productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const enable = !product.hasOffer;
    const referencePrice =
      enable && product.offerPrice ? product.offerPrice : product.price * 0.9;
    const normalizedOffer = Math.max(1, Math.round(referencePrice));

    await toggleOffer(productId, enable, enable ? normalizedOffer : undefined);
    setError(null);
  };

  const handleExportPdf = useCallback(async () => {
    if (!store) return;

    try {
      setExportingReport(true);

      const categorySummaries = categories.map((category) => {
        const categoryProducts = products.filter(
          (product) => product.categoryId === category.id
        );
        const productCount = categoryProducts.length;
        const stock = categoryProducts.reduce(
          (acc, item) => acc + item.stock,
          0
        );
        const value = categoryProducts.reduce(
          (acc, item) =>
            acc +
            item.stock *
              (item.hasOffer && item.offerPrice !== undefined
                ? item.offerPrice
                : item.price),
          0
        );
        const offerCount = categoryProducts.filter(
          (item) => item.hasOffer
        ).length;

        return {
          name: category.name,
          productCount,
          stock,
          value,
          offerCount,
        };
      });

      const lowStockProducts = products
        .filter((product) => product.stock <= 3)
        .sort((a, b) => a.stock - b.stock)
        .map((product) => ({
          name: product.name,
          categoryName:
            categoryMap.get(product.categoryId)?.name ?? "Sin categoria",
          stock: product.stock,
          price:
            product.hasOffer && product.offerPrice !== undefined
              ? product.offerPrice
              : product.price,
        }));

      const offerProducts = products
        .filter((product) => product.hasOffer)
        .map((product) => ({
          name: product.name,
          categoryName:
            categoryMap.get(product.categoryId)?.name ?? "Sin categoria",
          stock: product.stock,
          price: product.price,
          offerPrice: product.offerPrice ?? product.price,
        }));

      const crossStoreReport = crossStoreSummary.map((entry) => ({
        storeName: entry.store.name,
        overlapCount: entry.overlapCount,
        totalStock: entry.totalStock,
        bestPrice: entry.bestPrice,
        offerMatches: entry.offerMatches,
      }));

      const html = buildStoreInventoryReportHtml({
        storeName: store.name,
        storeLocation: store.location,
        storeDescription: store.description,
        generatedAt: new Date(),
        metrics: {
          totalProducts: products.length,
          totalStock: stats.totalStock,
          inventoryValue: stats.value,
          offerCount: stats.offerCount,
          lowStock: stats.lowStock,
        },
        categorySummaries,
        lowStockProducts,
        offerProducts,
        crossStoreSummary: crossStoreReport,
      });

      const file = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          dialogTitle: `Reporte de inventario - ${store.name}`,
        });
      } else {
        Alert.alert("Reporte generado", file.uri);
      }
    } catch (exportError) {
      console.warn("Export PDF error", exportError);
      Alert.alert(
        "Error",
        exportError instanceof Error
          ? exportError.message
          : "No se pudo generar el reporte en PDF."
      );
    } finally {
      setExportingReport(false);
    }
  }, [store, categories, products, categoryMap, crossStoreSummary, stats]);

  const openProductModal = (
    mode: "create" | "edit",
    product: Product | null
  ) => {
    setProductModalState({ visible: true, mode, product });
  };

  const closeProductModal = () => {
    setProductModalState({ visible: false, mode: "create", product: null });
  };

  useEffect(() => {
    if (!detailProduct) return;
    const next = products.find((item) => item.id === detailProduct.id);
    if (!next) {
      setDetailProduct(null);
      return;
    }
    if (next !== detailProduct) {
      setDetailProduct(next);
    }
  }, [products, detailProduct]);

  const openProductDetail = (product: Product) => {
    setDetailProduct(product);
  };

  const closeProductDetail = () => {
    setDetailProduct(null);
  };

  const openCategoryModal = (
    mode: "create" | "edit",
    category: Category | null
  ) => {
    setCategoryModalState({ visible: true, mode, category });
  };

  const closeCategoryModal = () => {
    setCategoryModalState({ visible: false, mode: "create", category: null });
  };

  const handleSubmitCategory = async (data: {
    name: string;
    description?: string;
  }) => {
    if (!storeId) return;

    try {
      if (categoryModalState.mode === "edit" && categoryModalState.category) {
        await updateCategory({
          categoryId: categoryModalState.category.id,
          data,
        });
      } else {
        await addCategory({
          storeId,
          name: data.name,
          description: data.description,
        });
      }
      setError(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la categoría."
      );
      throw submitError;
    }
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      "Eliminar categoría",
      `¿Eliminar la categoría ${category.name}? Se eliminarán sus productos asociados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeCategory(category.id);
              setError(null);
            } catch (removeError) {
              setError(
                removeError instanceof Error
                  ? removeError.message
                  : "No se pudo eliminar la categoría."
              );
            }
          },
        },
      ]
    );
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      "Eliminar producto",
      `¿Eliminar ${product.name}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeProduct(product.id);
              setError(null);
              if (detailProduct?.id === product.id) {
                setDetailProduct(null);
              }
            } catch (removeError) {
              setError(
                removeError instanceof Error
                  ? removeError.message
                  : "No se pudo eliminar el producto."
              );
            }
          },
        },
      ]
    );
  };

  const handleUpdateStore = async (data: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
    imageAsset?: MediaAsset | null;
  }) => {
    if (!store) return;

    try {
      const { imageAsset, ...rest } = data;
      await updateStore({
        storeId: store.id,
        data: {
          ...rest,
          imageAsset: imageAsset ?? undefined,
        },
      });
      setError(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la tienda."
      );
      throw submitError;
    }
  };

  const handleRemoveStore = () => {
    if (!store) return;

    Alert.alert(
      "Eliminar tienda",
      "Eliminar la tienda también borrará categorías y productos asociados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeStore(store.id);
              setStoreModalVisible(false);
              router.replace("/");
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

  const heroImageUri = resolveMediaUri(store.imageAsset, store.imageUrl);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          {heroImageUri ? (
            <Image
              source={{ uri: heroImageUri }}
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
            <View style={styles.heroActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setError(null);
                  setStoreModalVisible(true);
                }}
              >
                <Text style={styles.secondaryLabel}>Editar tienda</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, styles.dangerButton]}
                onPress={handleRemoveStore}
              >
                <Text style={[styles.secondaryLabel, styles.dangerLabel]}>
                  Eliminar tienda
                </Text>
              </Pressable>
            </View>
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
            <Text style={styles.metricLabel}>Ofertas activas</Text>
            <Text style={styles.metricValue}>{stats.offerCount}</Text>
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

        {crossStoreSummary.length > 0 ? (
          <View style={styles.analyticsSection}>
            <Text style={styles.sectionTitle}>Cruces con otras tiendas</Text>
            <Text style={styles.analyticsSubtitle}>
              Coincidencias de stock y oportunidades de traslado.
            </Text>
            <View style={styles.crossStoreList}>
              {crossStoreSummary.slice(0, 3).map((entry) => (
                <View key={entry.store.id} style={styles.crossStoreCard}>
                  <Text style={styles.crossStoreTitle}>{entry.store.name}</Text>
                  <Text style={styles.crossStoreMeta}>
                    Coincidencias: {entry.overlapCount}
                  </Text>
                  <Text style={styles.crossStoreMeta}>
                    Stock combinado: {entry.totalStock}
                  </Text>
                  {entry.bestPrice !== null ? (
                    <Text style={styles.crossStoreMeta}>
                      Mejor precio: {formatCurrency(entry.bestPrice)}
                    </Text>
                  ) : null}
                  {entry.offerMatches > 0 ? (
                    <Text style={styles.crossStoreHighlight}>
                      Ofertas activas: {entry.offerMatches}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inventario</Text>
          <View style={styles.sectionActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setError(null);
                openCategoryModal("create", null);
              }}
            >
              <Text style={styles.secondaryLabel}>Añadir categoría</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setError(null);
                openProductModal("create", null);
              }}
            >
              <Text style={styles.secondaryLabel}>Añadir producto</Text>
            </Pressable>
            <Pressable
              style={[
                styles.secondaryButton,
                exportingReport && styles.disabledButton,
              ]}
              onPress={handleExportPdf}
              disabled={exportingReport}
            >
              <Text style={styles.secondaryLabel}>
                {exportingReport ? "Generando..." : "Exportar PDF"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, styles.searchField]}
              placeholder="Buscar por nombre, categoría, descripción o código"
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              selectionColor="#5668ff"
              keyboardAppearance="dark"
            />
            <Pressable
              style={styles.scanSearchButton}
              onPress={() => setBarcodeScannerVisible(true)}
            >
              <Text style={styles.scanSearchLabel}>Escanear</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {groupedEntries.length === 0 && isSearching && products.length > 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsTitle}>Sin coincidencias</Text>
            <Text style={styles.noResultsSubtitle}>
              Ajusta los términos de búsqueda o limpia el filtro para ver todo
              el inventario.
            </Text>
          </View>
        ) : null}

        {groupedEntries.map(([categoryId, categoryProducts]) => {
          const category = categoryMap.get(categoryId);
          return (
            <View key={categoryId} style={styles.categoryBlock}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>
                  {category ? category.name : "Sin categoría"}
                </Text>
                {category ? (
                  <View style={styles.categoryActions}>
                    <Pressable
                      style={styles.categoryActionButton}
                      onPress={() => {
                        setError(null);
                        openCategoryModal("edit", category);
                      }}
                    >
                      <Text style={styles.categoryActionLabel}>Editar</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.categoryActionButton,
                        styles.categoryDangerButton,
                      ]}
                      onPress={() => handleDeleteCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryActionLabel,
                          styles.categoryDangerLabel,
                        ]}
                      >
                        Eliminar
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
              <View style={styles.categoryList}>
                {categoryProducts.map((product) => (
                  <Pressable
                    key={product.id}
                    style={styles.productRow}
                    onPress={() => {
                      setError(null);
                      openProductDetail(product);
                    }}
                    onLongPress={() => {
                      setError(null);
                      openProductModal("edit", product);
                    }}
                  >
                    <ProductCard product={product} category={category} />
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}

        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sin productos todavía</Text>
            <Text style={styles.emptySubtitle}>
              Registra un producto para comenzar a organizar el inventario de
              esta tienda.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setError(null);
                openProductModal("create", null);
              }}
            >
              <Text style={styles.primaryButtonLabel}>Agregar producto</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <AddProductModal
        visible={productModalState.visible}
        mode={productModalState.mode}
        initialValues={
          productModalState.mode === "edit" && productModalState.product
            ? {
                name: productModalState.product.name,
                price: productModalState.product.price,
                stock: productModalState.product.stock,
                categoryName:
                  categoryMap.get(productModalState.product.categoryId)?.name ??
                  "",
                imageUrl: productModalState.product.imageUrl,
                imageAsset: productModalState.product.imageAsset,
                description: productModalState.product.description,
                hasOffer: productModalState.product.hasOffer,
                offerPrice: productModalState.product.offerPrice,
                barcodes: productModalState.product.barcodes,
                discountInfo: productModalState.product.discountInfo,
              }
            : undefined
        }
        onClose={closeProductModal}
        categories={categories}
        onSubmit={handleSubmitProduct}
      />
      <ProductDetailModal
        visible={detailProduct !== null}
        product={detailProduct}
        store={store}
        categories={categories}
        onClose={closeProductDetail}
        onEdit={(product) => {
          closeProductDetail();
          openProductModal("edit", product);
        }}
        onDelete={handleDeleteProduct}
        onAdjustStock={handleStockChange}
        onToggleOffer={handleToggleOffer}
        availability={detailAvailability}
      />
      <CategoryModal
        visible={categoryModalState.visible}
        mode={categoryModalState.mode}
        initialValues={
          categoryModalState.mode === "edit" && categoryModalState.category
            ? {
                name: categoryModalState.category.name,
                description: categoryModalState.category.description,
              }
            : undefined
        }
        onClose={closeCategoryModal}
        onSubmit={handleSubmitCategory}
      />
      <AddStoreModal
        visible={storeModalVisible}
        mode="edit"
        initialValues={
          store
            ? {
                name: store.name,
                location: store.location,
                description: store.description,
                imageUrl: store.imageUrl,
                imageAsset: store.imageAsset,
              }
            : undefined
        }
        onClose={() => setStoreModalVisible(false)}
        onSubmit={handleUpdateStore}
      />
      <BarcodeScannerModal
        visible={barcodeScannerVisible}
        onClose={() => setBarcodeScannerVisible(false)}
        onDetected={(value) => {
          setBarcodeScannerVisible(false);
          setSearchQuery(value.trim());
        }}
        title="Escanea para filtrar"
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
  heroActions: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 12,
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
  analyticsSection: {
    paddingHorizontal: 24,
    marginBottom: 12,
    gap: 8,
  },
  analyticsSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },
  crossStoreList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  crossStoreCard: {
    flexBasis: "47%",
    backgroundColor: "#10162b",
    borderRadius: 18,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  crossStoreTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  crossStoreMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  crossStoreHighlight: {
    color: "#4cc38a",
    fontSize: 13,
    fontWeight: "600",
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
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  sectionActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  searchField: {
    flex: 1,
  },
  scanSearchButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(86,104,255,0.16)",
  },
  scanSearchLabel: {
    color: "#b4bcff",
    fontWeight: "600",
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
  dangerButton: {
    backgroundColor: "rgba(255,99,132,0.16)",
  },
  dangerLabel: {
    color: "#ff99b2",
  },
  disabledButton: {
    opacity: 0.6,
  },
  error: {
    color: "#ff6384",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  noResults: {
    backgroundColor: "#10162b",
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 6,
  },
  noResultsTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  noResultsSubtitle: {
    color: "rgba(255,255,255,0.72)",
  },
  categoryBlock: {
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryActionButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  categoryActionLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  categoryDangerButton: {
    backgroundColor: "rgba(255,99,132,0.16)",
  },
  categoryDangerLabel: {
    color: "#ff99b2",
  },
  categoryList: {
    gap: 16,
  },
  productRow: {
    borderRadius: 20,
    overflow: "hidden",
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
