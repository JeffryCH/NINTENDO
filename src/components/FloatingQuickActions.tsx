import { useMemo, useState } from "react";
import {
  Alert,
  Clipboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";
import Ionicons from "@expo/vector-icons/Ionicons";
import { formatCurrency } from "@/utils/formatCurrency";
import {
  buildGlobalListingReportHtml,
  buildStoreListingReportHtml,
  buildGlobalListingReportText,
  buildStoreListingReportText,
  buildStoreSalesReportText,
  type SimpleProductLine,
} from "@/utils/reporting";

interface FloatingQuickActionsProps {
  onScan?: () => void;
  onAddCategory?: () => void;
  onAddProduct?: () => void;
  onExportPdf?: () => void;
  onSyncMovements?: () => void;
}

export const FloatingQuickActions = ({
  onScan,
  onAddCategory,
  onAddProduct,
  onExportPdf,
  onSyncMovements,
}: FloatingQuickActionsProps = {}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const stores = useInventoryStore((s) => s.stores);
  const products = useInventoryStore((s) => s.products);
  const categories = useInventoryStore((s) => s.categories);
  const adjustProductStock = useInventoryStore((s) => s.adjustProductStock);
  const removeStore = useInventoryStore((s) => s.removeStore);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionsMode, setOptionsMode] = useState<"pdf" | "text">("pdf");
  const [exportComment, setExportComment] = useState("");
  const [exportArrivalNote, setExportArrivalNote] = useState("");
  const [textPreviewOpen, setTextPreviewOpen] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [salesWizardOpen, setSalesWizardOpen] = useState(false);
  const [salesStep, setSalesStep] = useState(0);
  const [selectedSales, setSelectedSales] = useState<
    Record<string, { quantity: string }>
  >({});
  const [selectedOutOfStock, setSelectedOutOfStock] = useState<
    Record<string, boolean>
  >({});
  const [attendedCount, setAttendedCount] = useState("");
  const [salesMade, setSalesMade] = useState("");
  const [extraItems, setExtraItems] = useState<
    {
      id: string;
      name: string;
      quantity: string;
      section: "consolas" | "juegos" | "accesorios" | "otros";
    }[]
  >([]);
  const [extraDraft, setExtraDraft] = useState<{
    name: string;
    quantity: string;
    section: "consolas" | "juegos" | "accesorios" | "otros";
  }>({ name: "", quantity: "1", section: "otros" });
  const [sectionCategories, setSectionCategories] = useState<{
    consolas: string[];
    juegos: string[];
    accesorios: string[];
  }>({ consolas: [], juegos: [], accesorios: [] });
  const [salesObservations, setSalesObservations] = useState("");
  const [salesPending, setSalesPending] = useState(false);

  const currentStoreId = useMemo(() => {
    if (!pathname) return null;
    const m = pathname.match(/^\/store\/(.+)$/);
    return m ? m[1] : null;
  }, [pathname]);

  const currentStore = useMemo(
    () => (currentStoreId ? stores.find((s) => s.id === currentStoreId) : null),
    [currentStoreId, stores]
  );

  const storeCategories = useMemo(
    () =>
      currentStoreId
        ? categories.filter((c) => c.storeId === currentStoreId)
        : [],
    [categories, currentStoreId]
  );

  const availableProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.storeId === currentStoreId &&
          typeof p.stock === "number" &&
          p.stock > 0
      ),
    [products, currentStoreId]
  );

  const generateSalesReport = async () => {
    if (!currentStore) return;

    const adjustments = Object.entries(selectedSales)
      .map(([productId, data]) => {
        const product = products.find(
          (p) => p.id === productId && p.storeId === currentStore.id
        );
        if (!product) return null;
        const qty = Math.max(1, Number.parseInt(data.quantity, 10) || 1);
        return { product, qty };
      })
      .filter(Boolean) as { product: (typeof products)[number]; qty: number }[];

    const insufficient = adjustments.find(
      ({ product, qty }) => product.stock < qty
    );
    if (insufficient) {
      Alert.alert(
        "Stock insuficiente",
        `${insufficient.product.name} solo tiene ${insufficient.product.stock} en inventario. Ajusta la cantidad antes de generar el reporte.`
      );
      return;
    }

    setSalesPending(true);
    try {
      for (const adj of adjustments) {
        await adjustProductStock(adj.product.id, -adj.qty, {
          reason: "sale",
          note: "Reporte de ventas",
        });
      }

      const buckets: Record<string, { name: string; quantity: number }[]> = {
        Consolas: [],
        Juegos: [],
        Accesorios: [],
        Otros: [],
      };

      adjustments.forEach(({ product, qty }) => {
        const section = resolveSectionForCategory(product.categoryId);
        buckets[section].push({ name: product.name, quantity: qty });
      });

      // Agregar productos agotados seleccionados a sus categorías
      Object.entries(selectedOutOfStock)
        .filter(([, selected]) => selected)
        .forEach(([productId]) => {
          const product =
            outOfStockProducts.find((p) => p.id === productId) ||
            products.find((p) => p.id === productId);
          if (product) {
            const section = resolveSectionForCategory(product.categoryId);
            buckets[section].push({ name: product.name, quantity: 0 }); // quantity 0 indica que es agotado
          }
        });

      extraItems.forEach((item) => {
        const qty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
        const sectionLabel =
          item.section === "consolas"
            ? "Consolas"
            : item.section === "juegos"
            ? "Juegos"
            : item.section === "accesorios"
            ? "Accesorios"
            : "Otros";
        buckets[sectionLabel].push({ name: item.name, quantity: qty });
      });

      const outNames = Object.entries(selectedOutOfStock)
        .filter(([, selected]) => selected)
        .map(([productId]) => {
          const product =
            outOfStockProducts.find((p) => p.id === productId) ||
            products.find((p) => p.id === productId);
          return product?.name;
        })
        .filter(Boolean) as string[];

      const totalUnitsSold = Object.values(buckets)
        .flat()
        .reduce((acc, item) => acc + item.quantity, 0);

      const salesCountValue = salesMade.trim()
        ? Number(salesMade) || 0
        : totalUnitsSold;
      const attendedValue = attendedCount.trim()
        ? Number(attendedCount) || 0
        : 0;

      const text = buildStoreSalesReportText({
        storeName: currentStore.name,
        storeLocation: currentStore.location,
        attended: attendedValue,
        salesCount: salesCountValue,
        sections: [
          { title: "Consolas", items: buckets.Consolas },
          { title: "Juegos", items: buckets.Juegos },
          { title: "Accesorios", items: buckets.Accesorios },
          { title: "Otros", items: buckets.Otros },
        ],
        outOfStock: outNames,
        observations: salesObservations.trim() || undefined,
      });

      setSalesWizardOpen(false);
      setTextContent(text);
      setTextPreviewOpen(true);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo ajustar el inventario"
      );
    } finally {
      setSalesPending(false);
    }
  };

  const outOfStockProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.storeId === currentStoreId &&
          typeof p.stock === "number" &&
          p.stock <= 0
      ),
    [products, currentStoreId]
  );

  const generateGlobalReport = async () => {
    const simpleStores = stores.map((store) => {
      const lines: SimpleProductLine[] = products
        .filter((p) => p.storeId === store.id)
        .map((p) => ({
          name: p.name,
          stock: p.stock,
          categoryName: p.categoryId
            ? useInventoryStore
                .getState()
                .categories.find((c) => c.id === p.categoryId)?.name ??
              "Sin categoría"
            : "Sin categoría",
          upc: p.barcodes?.upc ?? null,
          box: p.barcodes?.box ?? null,
        }));
      return {
        storeName: store.name,
        storeLocation: store.location,
        products: lines,
      };
    });

    const html = buildGlobalListingReportHtml({
      generatedAt: new Date(),
      stores: simpleStores,
    });

    const file = await printToFileAsync({ html, base64: false });
    const canShare = await isAvailableAsync();
    if (canShare) {
      await shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Compartir reporte general",
        UTI: "com.adobe.pdf",
      });
    }
  };

  const generateStoreReport = async (storeId: string) => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return;
    const timestamp = new Date().toLocaleString();
    const storeProducts = products.filter((p) => p.storeId === storeId);
    const productCount = storeProducts.length;
    const stockValue = storeProducts.reduce(
      (acc, p) =>
        acc + p.stock * (p.hasOffer && p.offerPrice ? p.offerPrice : p.price),
      0
    );
    const lowStock = storeProducts.filter((p) => p.stock <= 3).length;

    const lines: SimpleProductLine[] = storeProducts.map((p) => ({
      name: p.name,
      stock: p.stock,
      categoryName:
        useInventoryStore
          .getState()
          .categories.find((c) => c.id === p.categoryId)?.name ??
        "Sin categoría",
      upc: p.barcodes?.upc ?? null,
      box: p.barcodes?.box ?? null,
    }));

    const html = buildStoreListingReportHtml({
      title: `Inventario de ${store.name}`,
      comment: exportComment.trim() || undefined,
      arrivalNoteOut: exportArrivalNote.trim() || undefined,
      subtitle: store.location ?? undefined,
      generatedAt: new Date(),
      products: lines,
      groupByCategory: true,
    });

    const file = await printToFileAsync({ html, base64: false });
    const canShare = await isAvailableAsync();
    if (canShare) {
      await shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: `Compartir reporte de ${store.name}`,
        UTI: "com.adobe.pdf",
      });
    }
  };

  const generateStoreText = (storeId: string): string => {
    const store = stores.find((s) => s.id === storeId);
    if (!store) return "";

    const storeProducts = products.filter((p) => p.storeId === storeId);
    const groupedByCategory: Record<string, typeof storeProducts> = {};

    storeProducts.forEach((p) => {
      const categoryName =
        categories.find((c) => c.id === p.categoryId)?.name ?? "Sin categoría";
      if (!groupedByCategory[categoryName]) {
        groupedByCategory[categoryName] = [];
      }
      groupedByCategory[categoryName].push(p);
    });

    const lines: string[] = [];
    lines.push(
      `Inventario ${store.name}${store.location ? `(${store.location})` : ""}`
    );
    lines.push("");

    Object.entries(groupedByCategory).forEach(([categoryName, items]) => {
      const available = items.filter((p) => p.stock > 0);
      if (available.length > 0) {
        lines.push(categoryName);
        available.forEach((p) => {
          lines.push(`-${p.name} (${p.stock})`);
        });
        lines.push("");
      }
    });

    const outOfStock = storeProducts.filter((p) => p.stock <= 0);
    if (outOfStock.length > 0) {
      lines.push("________");
      lines.push("Agotados");
      outOfStock.forEach((p) => {
        lines.push(`-${p.name}`);
      });
    }

    return lines.join("\n");
  };

  const generateGlobalText = (): string => {
    const lines: string[] = [];

    stores.forEach((store, storeIndex) => {
      const storeProducts = products.filter((p) => p.storeId === store.id);
      const groupedByCategory: Record<string, typeof storeProducts> = {};

      storeProducts.forEach((p) => {
        const categoryName =
          categories.find((c) => c.id === p.categoryId)?.name ??
          "Sin categoría";
        if (!groupedByCategory[categoryName]) {
          groupedByCategory[categoryName] = [];
        }
        groupedByCategory[categoryName].push(p);
      });

      lines.push(
        `Inventario ${store.name}${store.location ? `(${store.location})` : ""}`
      );
      lines.push("");

      Object.entries(groupedByCategory).forEach(([categoryName, items]) => {
        const available = items.filter((p) => p.stock > 0);
        if (available.length > 0) {
          lines.push(categoryName);
          available.forEach((p) => {
            lines.push(`-${p.name} (${p.stock})`);
          });
          lines.push("");
        }
      });

      const outOfStock = storeProducts.filter((p) => p.stock <= 0);
      if (outOfStock.length > 0) {
        lines.push("________");
        lines.push("Agotados");
        outOfStock.forEach((p) => {
          lines.push(`-${p.name}`);
        });
      }

      if (storeIndex < stores.length - 1) {
        lines.push("\n");
      }
    });

    return lines.join("\n");
  };

  const handleReport = async () => {
    try {
      setPending(true);
      setOpen(false);
      if (currentStoreId) {
        await generateStoreReport(currentStoreId);
      } else {
        await generateGlobalReport();
      }
    } finally {
      setPending(false);
    }
  };

  const handleAddStore = () => {
    setOpen(false);
    router.push({ pathname: "/", params: { action: "create-store" } });
  };

  const handleScan = () => {
    if (!currentStoreId) return;
    setOpen(false);
    router.push({
      pathname: `/store/${currentStoreId}`,
      params: { action: "scan" },
    });
  };

  const handleAddCategory = () => {
    if (!currentStoreId) return;
    setOpen(false);
    router.push({
      pathname: `/store/${currentStoreId}`,
      params: { action: "add-category" },
    });
  };

  const handleAddProduct = () => {
    if (!currentStoreId) return;
    setOpen(false);
    router.push({
      pathname: `/store/${currentStoreId}`,
      params: { action: "add-product" },
    });
  };

  const handleExportPdf = () => {
    if (!currentStoreId) return;
    setOpen(false);
    setExportComment("");
    setExportArrivalNote("");
    setOptionsMode("pdf");
    setOptionsOpen(true);
  };

  const handleCopyText = () => {
    setOpen(false);
    setExportComment("");
    setExportArrivalNote("");
    setOptionsMode("text");
    setOptionsOpen(true);
  };

  const handleSyncMovements = () => {
    if (!currentStoreId) return;
    setOpen(false);
    router.push({
      pathname: `/store/${currentStoreId}`,
      params: { action: "sync-movements" },
    });
  };

  const handleEditStore = () => {
    if (!currentStoreId) return;
    setOpen(false);
    router.push({
      pathname: `/store/${currentStoreId}`,
      params: { action: "edit-store" },
    });
  };

  const handleDeleteStore = () => {
    if (!currentStore) return;
    setOpen(false);
    Alert.alert(
      "Eliminar tienda",
      `¿Eliminar ${currentStore.name}? Se borrarán categorías y productos asociados.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await removeStore(currentStore.id);
              router.replace("/");
            } catch (error) {
              Alert.alert(
                "Error",
                error instanceof Error
                  ? error.message
                  : "No se pudo eliminar la tienda."
              );
            }
          },
        },
      ]
    );
  };

  const resetSalesWizard = () => {
    setSalesStep(0);
    setSelectedSales({});
    setSelectedOutOfStock({});
    setAttendedCount("");
    setSalesMade("");
    setExtraItems([]);
    setExtraDraft({ name: "", quantity: "1", section: "otros" });
    setSectionCategories({ consolas: [], juegos: [], accesorios: [] });
    setSalesObservations("");
  };

  const handleOpenSalesWizard = () => {
    if (!currentStoreId) return;
    setOpen(false);
    resetSalesWizard();
    setSalesWizardOpen(true);
  };

  const toggleSaleSelection = (productId: string) => {
    setSelectedSales((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = { quantity: "1" };
      }
      return next;
    });
  };

  const updateSaleQuantity = (productId: string, quantity: string) => {
    setSelectedSales((prev) => ({
      ...prev,
      [productId]: { quantity: quantity || "1" },
    }));
  };

  const toggleOutOfStockSelection = (productId: string) => {
    setSelectedOutOfStock((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const toggleCategoryForSection = (
    section: "consolas" | "juegos" | "accesorios",
    categoryId: string
  ) => {
    setSectionCategories((prev) => {
      const list = prev[section];
      const exists = list.includes(categoryId);
      const nextList = exists
        ? list.filter((id) => id !== categoryId)
        : [...list, categoryId];
      return { ...prev, [section]: nextList };
    });
  };

  const addExtraItem = () => {
    if (!extraDraft.name.trim()) return;
    const qty = Math.max(1, Number.parseInt(extraDraft.quantity, 10) || 1);
    setExtraItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name: extraDraft.name.trim(),
        quantity: String(qty),
        section: extraDraft.section,
      },
    ]);
    setExtraDraft({ name: "", quantity: "1", section: "otros" });
  };

  const removeExtraItem = (id: string) => {
    setExtraItems((prev) => prev.filter((item) => item.id !== id));
  };

  const resolveSectionForCategory = (categoryId?: string | null) => {
    if (categoryId && sectionCategories.consolas.includes(categoryId)) {
      return "Consolas";
    }
    if (categoryId && sectionCategories.juegos.includes(categoryId)) {
      return "Juegos";
    }
    if (categoryId && sectionCategories.accesorios.includes(categoryId)) {
      return "Accesorios";
    }
    return "Otros";
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        onPress={() => setOpen((c) => !c)}
        style={[
          styles.fab,
          {
            bottom: Math.max(insets.bottom + 84, 84),
            right: Math.max(insets.right + 20, 20),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Acciones rápidas"
      >
        <Ionicons
          name={open ? "close" : "ellipsis-horizontal"}
          size={20}
          color="#ffffff"
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Pressable
              style={styles.actionRow}
              onPress={handleReport}
              disabled={pending}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#d8dcff"
              />
              <Text style={styles.actionLabel}>
                {pending ? "Generando..." : "Generar reporte"}
              </Text>
            </Pressable>
            {currentStore ? (
              <>
                <Pressable style={styles.actionRow} onPress={handleScan}>
                  <Ionicons name="scan-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Escanear código</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={handleAddCategory}>
                  <Ionicons name="folder-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Añadir categoría</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={handleAddProduct}>
                  <Ionicons name="cube-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Añadir producto</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={handleExportPdf}>
                  <Ionicons name="download-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Exportar PDF</Text>
                </Pressable>
                <Pressable style={styles.actionRow} onPress={handleCopyText}>
                  <Ionicons name="copy-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Copiar como texto</Text>
                </Pressable>
                <Pressable
                  style={styles.actionRow}
                  onPress={handleOpenSalesWizard}
                >
                  <Ionicons name="receipt-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Reporte de ventas</Text>
                </Pressable>
                {products.filter((p) => p.storeId === currentStoreId).length >
                  0 && (
                  <Pressable
                    style={styles.actionRow}
                    onPress={handleSyncMovements}
                  >
                    <Ionicons name="sync-outline" size={18} color="#d8dcff" />
                    <Text style={styles.actionLabel}>
                      Sincronizar movimientos
                    </Text>
                  </Pressable>
                )}
                <Pressable style={styles.actionRow} onPress={handleEditStore}>
                  <Ionicons name="create-outline" size={18} color="#d8dcff" />
                  <Text style={styles.actionLabel}>Editar tienda</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionRow, styles.dangerRow]}
                  onPress={handleDeleteStore}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff99b2" />
                  <Text style={[styles.actionLabel, styles.dangerLabel]}>
                    Eliminar tienda
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.actionRow} onPress={handleAddStore}>
                <Ionicons name="add-circle-outline" size={18} color="#d8dcff" />
                <Text style={styles.actionLabel}>Añadir tienda</Text>
              </Pressable>
            )}
            <Pressable style={styles.closeRow} onPress={() => setOpen(false)}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={salesWizardOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSalesWizardOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>Reporte de ventas</Text>
            <View style={styles.stepsRow}>
              {["Items", "Totales", "Categorías", "Observaciones"].map(
                (label, idx) => (
                  <View
                    key={label}
                    style={[
                      styles.stepItem,
                      salesStep === idx && styles.stepItemActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.stepDot,
                        salesStep === idx && styles.stepDotActive,
                      ]}
                    >
                      <Text style={styles.stepDotText}>{idx + 1}</Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        salesStep === idx && styles.stepLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                )
              )}
            </View>

            {salesStep === 0 && (
              <ScrollView style={styles.stepBlock}>
                <Text style={styles.optLabel}>Selecciona items vendidos</Text>
                {availableProducts.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay productos con stock disponible.
                  </Text>
                ) : (
                  availableProducts.map((p) => {
                    const selected = Boolean(selectedSales[p.id]);
                    const catName = p.categoryId
                      ? storeCategories.find((c) => c.id === p.categoryId)?.name
                      : undefined;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.selectRow,
                          selected && styles.selectRowActive,
                        ]}
                        onPress={() => toggleSaleSelection(p.id)}
                      >
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={18}
                          color={selected ? "#d8dcff" : "#9aa3c7"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.selectTitle}>{p.name}</Text>
                          <Text style={styles.selectMeta}>
                            {catName ?? "Sin categoría"} · Stock: {p.stock}
                          </Text>
                        </View>
                        {selected && (
                          <TextInput
                            style={styles.qtyInput}
                            value={selectedSales[p.id]?.quantity ?? "1"}
                            onChangeText={(value) =>
                              updateSaleQuantity(p.id, value)
                            }
                            keyboardType="numeric"
                            placeholder="1"
                            placeholderTextColor="#9aa3c7"
                          />
                        )}
                      </Pressable>
                    );
                  })
                )}

                <Text style={[styles.optLabel, { marginTop: 12 }]}>
                  Agotados
                </Text>
                {outOfStockProducts.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay productos agotados.
                  </Text>
                ) : (
                  outOfStockProducts.map((p) => {
                    const selected = Boolean(selectedOutOfStock[p.id]);
                    const catName = p.categoryId
                      ? storeCategories.find((c) => c.id === p.categoryId)?.name
                      : undefined;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.selectRow,
                          selected && styles.selectRowActive,
                        ]}
                        onPress={() => toggleOutOfStockSelection(p.id)}
                      >
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={18}
                          color={selected ? "#d8dcff" : "#9aa3c7"}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.selectTitle}>{p.name}</Text>
                          <Text style={styles.selectMeta}>
                            {catName ?? "Sin categoría"}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            )}

            {salesStep === 1 && (
              <View style={styles.stepBlock}>
                <Text style={styles.optLabel}>Totales del día</Text>
                <View style={styles.optRowInline}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inlineLabel}>Personas atendidas</Text>
                    <TextInput
                      value={attendedCount}
                      onChangeText={setAttendedCount}
                      placeholder="Ej: 29"
                      placeholderTextColor="#9aa3c7"
                      style={styles.optInput}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inlineLabel}>Ventas realizadas</Text>
                    <TextInput
                      value={salesMade}
                      onChangeText={setSalesMade}
                      placeholder="Se calcula por defecto"
                      placeholderTextColor="#9aa3c7"
                      style={styles.optInput}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={[styles.optLabel, { marginTop: 8 }]}>
                  Items fuera de inventario
                </Text>
                <View style={styles.optRowInline}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inlineLabel}>Nombre</Text>
                    <TextInput
                      value={extraDraft.name}
                      onChangeText={(v) =>
                        setExtraDraft((prev) => ({ ...prev, name: v }))
                      }
                      placeholder="Ej: Hitman Pack N2"
                      placeholderTextColor="#9aa3c7"
                      style={styles.optInput}
                    />
                  </View>
                  <View style={{ width: 96 }}>
                    <Text style={styles.inlineLabel}>Cantidad</Text>
                    <TextInput
                      value={extraDraft.quantity}
                      onChangeText={(v) =>
                        setExtraDraft((prev) => ({ ...prev, quantity: v }))
                      }
                      placeholder="1"
                      placeholderTextColor="#9aa3c7"
                      style={styles.optInput}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.chipRow}>
                  {["consolas", "juegos", "accesorios", "otros"].map((key) => (
                    <Pressable
                      key={key}
                      style={[
                        styles.chip,
                        extraDraft.section === key && styles.chipActive,
                      ]}
                      onPress={() =>
                        setExtraDraft((prev) => ({
                          ...prev,
                          section: key as typeof extraDraft.section,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          extraDraft.section === key && styles.chipLabelActive,
                        ]}
                      >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.addSmall} onPress={addExtraItem}>
                    <Ionicons name="add" size={18} color="#1e2438" />
                  </Pressable>
                </View>

                {extraItems.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    {extraItems.map((item) => (
                      <View key={item.id} style={styles.extraRow}>
                        <Text style={styles.selectTitle}>
                          {item.name} (x{item.quantity}) · {item.section}
                        </Text>
                        <Pressable onPress={() => removeExtraItem(item.id)}>
                          <Ionicons name="close" size={16} color="#5b6580" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {salesStep === 2 && (
              <View style={styles.stepBlock}>
                <Text style={styles.optLabel}>
                  Categorías por sección (las no seleccionadas van a "Otros")
                </Text>
                {["consolas", "juegos", "accesorios"].map((section) => (
                  <View key={section} style={{ marginTop: 10 }}>
                    <Text style={styles.inlineLabel}>
                      {section.charAt(0).toUpperCase() + section.slice(1)}
                    </Text>
                    {storeCategories.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No hay categorías en la tienda.
                      </Text>
                    ) : (
                      <View style={styles.chipRow}>
                        {storeCategories.map((cat) => {
                          const active = sectionCategories[
                            section as "consolas" | "juegos" | "accesorios"
                          ].includes(cat.id);
                          return (
                            <Pressable
                              key={cat.id}
                              style={[styles.chip, active && styles.chipActive]}
                              onPress={() =>
                                toggleCategoryForSection(
                                  section as
                                    | "consolas"
                                    | "juegos"
                                    | "accesorios",
                                  cat.id
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.chipLabel,
                                  active && styles.chipLabelActive,
                                ]}
                              >
                                {cat.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {salesStep === 3 && (
              <View style={styles.stepBlock}>
                <Text style={styles.optLabel}>Observaciones</Text>
                <TextInput
                  value={salesObservations}
                  onChangeText={setSalesObservations}
                  placeholder="Notas u observaciones"
                  placeholderTextColor="#9aa3c7"
                  style={[styles.optInput, { minHeight: 96 }]}
                  multiline
                />
              </View>
            )}

            <View style={styles.optActions}>
              <Pressable
                style={styles.optCancel}
                onPress={() => setSalesWizardOpen(false)}
              >
                <Text style={styles.optActionLabel}>Cerrar</Text>
              </Pressable>
              {salesStep > 0 && (
                <Pressable
                  style={styles.optCancel}
                  onPress={() => setSalesStep((s) => Math.max(0, s - 1))}
                >
                  <Text style={styles.optActionLabel}>Atrás</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.optConfirm}
                disabled={salesPending}
                onPress={async () => {
                  if (salesStep === 3) {
                    await generateSalesReport();
                  } else {
                    setSalesStep((s) => Math.min(3, s + 1));
                  }
                }}
              >
                <Text style={styles.optActionLabel}>
                  {salesPending
                    ? "Generando..."
                    : salesStep === 3
                    ? "Generar y descontar"
                    : "Siguiente"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={optionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>Opciones de exportación</Text>
            <View style={styles.optRow}>
              <Text style={styles.optLabel}>Comentario</Text>
              <TextInput
                value={exportComment}
                onChangeText={setExportComment}
                placeholder="Notas generales del reporte"
                placeholderTextColor="#9aa3c7"
                style={styles.optInput}
                multiline
              />
            </View>
            <View style={styles.optRow}>
              <Text style={styles.optLabel}>Nota para agotados</Text>
              <TextInput
                value={exportArrivalNote}
                onChangeText={setExportArrivalNote}
                placeholder="Ej: tiene entrada hasta el día 24 de Dic"
                placeholderTextColor="#9aa3c7"
                style={styles.optInput}
              />
            </View>
            <View style={styles.optActions}>
              <Pressable
                style={styles.optCancel}
                onPress={() => setOptionsOpen(false)}
              >
                <Text style={styles.optActionLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.optConfirm}
                onPress={async () => {
                  setOptionsOpen(false);
                  if (optionsMode === "pdf") {
                    await generateStoreReport(currentStoreId!);
                  } else {
                    const text = currentStoreId
                      ? generateStoreText(currentStoreId)
                      : generateGlobalText();
                    setTextContent(text);
                    setTextPreviewOpen(true);
                  }
                }}
              >
                <Text style={styles.optActionLabel}>
                  {optionsMode === "pdf" ? "Generar" : "Preparar texto"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={textPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTextPreviewOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.optionsSheet}>
            <Text style={styles.optionsTitle}>Texto del reporte</Text>
            <ScrollView
              style={styles.textPreviewScroll}
              nestedScrollEnabled
            >
              <Text style={styles.textPreviewContent}>{textContent}</Text>
            </ScrollView>
            <View style={styles.optActions}>
              <Pressable
                style={styles.optCancel}
                onPress={() => setTextPreviewOpen(false)}
              >
                <Text style={styles.optActionLabel}>Cerrar</Text>
              </Pressable>
              <Pressable
                style={styles.optConfirm}
                onPress={() => {
                  Clipboard.setString(textContent);
                  Alert.alert("Copiado", "El texto se copió al portapapeles.");
                }}
              >
                <Text style={styles.optActionLabel}>Copiar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    backgroundColor: "#343d72",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#10162b",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  actionLabel: {
    color: "#d8dcff",
    fontWeight: "600",
  },
  dangerRow: {
    backgroundColor: "rgba(255,99,132,0.12)",
  },
  dangerLabel: {
    color: "#ff99b2",
  },
  closeRow: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  closeLabel: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  optionsSheet: {
    backgroundColor: "#141726",
    borderRadius: 14,
    padding: 12,
    minWidth: 320,
  },
  optionsTitle: {
    color: "#e9ecff",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  textPreviewScroll: {
    maxHeight: 320,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2a2f49",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  textPreviewContent: {
    color: "#e9ecff",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "monospace",
  },
  optRow: { marginBottom: 10 },
  optLabel: { color: "#cbd1f3", fontSize: 12, marginBottom: 4 },
  optInput: {
    borderWidth: 1,
    borderColor: "#2a2f49",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#ffffff",
    minHeight: 40,
  },
  optActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
  },
  optCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderColor: "#2a2f49",
    borderWidth: 1,
  },
  optConfirm: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#4660ff",
  },
  optActionLabel: { color: "#ffffff" },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 10,
  },
  stepItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#0f1322",
    borderWidth: 1,
    borderColor: "#1f2740",
  },
  stepItemActive: {
    backgroundColor: "#1f2a4d",
    borderColor: "#4660ff",
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1f2740",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepDotActive: {
    backgroundColor: "#4660ff",
  },
  stepDotText: { color: "#e9ecff", fontWeight: "700", fontSize: 12 },
  stepLabel: { color: "#9aa3c7", fontSize: 11 },
  stepLabelActive: { color: "#e9ecff" },
  stepBlock: {
    backgroundColor: "#0f1322",
    borderWidth: 1,
    borderColor: "#1f2740",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 10,
    maxHeight: 300,
  },
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2740",
    backgroundColor: "#0c1020",
    marginBottom: 8,
  },
  selectRowActive: { borderColor: "#4660ff", backgroundColor: "#121a33" },
  selectTitle: { color: "#e9ecff", fontWeight: "600" },
  selectMeta: { color: "#9aa3c7", fontSize: 12 },
  qtyInput: {
    width: 64,
    borderWidth: 1,
    borderColor: "#2a2f49",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#ffffff",
    textAlign: "center",
  },
  optRowInline: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 6,
  },
  inlineLabel: { color: "#cbd1f3", fontSize: 12, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#2a2f49",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#0c1020",
  },
  chipActive: { borderColor: "#4660ff", backgroundColor: "#121a33" },
  chipLabel: { color: "#cbd1f3", fontSize: 12 },
  chipLabelActive: { color: "#e9ecff" },
  addSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#2a2f49",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9ecff",
  },
  extraRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  emptyText: { color: "#9aa3c7", fontStyle: "italic", marginVertical: 4 },
});
