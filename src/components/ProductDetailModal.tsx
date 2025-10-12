import { useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import { Category, Product, Store } from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";
import { formatCurrency } from "@/utils/formatCurrency";
import { PriceTrend } from "./PriceTrend";

interface RelatedAvailability {
  store: Store;
  product: Product;
}

interface ProductDetailModalProps {
  visible: boolean;
  product: Product | null;
  store: Store;
  categories: Category[];
  onClose: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAdjustStock: (productId: string, delta: number) => Promise<void>;
  onToggleOffer: (productId: string) => Promise<void>;
  availability: RelatedAvailability[];
}

const discountInfoLabels = (
  product: Product
): Array<{ label: string; value: string }> => {
  if (!product.discountInfo) {
    return [];
  }

  const entries: Array<{ label: string; value: string }> = [];
  const { discountInfo } = product;

  if (discountInfo.zeroInterestMonths) {
    entries.push({
      label: "Meses tasa 0",
      value: `${discountInfo.zeroInterestMonths}`,
    });
  }

  entries.push({
    label: "¿Pago en efectivo?",
    value: discountInfo.cashOnly ? "Sí" : "No",
  });

  entries.push({
    label: "¿Vence?",
    value: discountInfo.hasExpiration ? "Sí" : "No",
  });

  if (discountInfo.hasExpiration && discountInfo.expiresAt) {
    entries.push({
      label: "Fecha límite",
      value: discountInfo.expiresAt,
    });
  }

  return entries;
};

export const ProductDetailModal = ({
  visible,
  product,
  store,
  categories,
  onClose,
  onEdit,
  onDelete,
  onAdjustStock,
  onToggleOffer,
  availability,
}: ProductDetailModalProps) => {
  const [pendingAction, setPendingAction] = useState<
    { kind: "stock"; delta: number } | { kind: "offer" } | null
  >(null);

  const category = useMemo(() => {
    if (!product) return null;
    return categories.find((item) => item.id === product.categoryId) ?? null;
  }, [categories, product]);

  const previewUri = resolveMediaUri(product?.imageAsset, product?.imageUrl);
  const priceHistory = product?.priceHistory ?? [];
  const discountEntries = product ? discountInfoLabels(product) : [];

  const handleAdjustStock = async (delta: number) => {
    if (!product) return;
    setPendingAction({ kind: "stock", delta });
    try {
      await onAdjustStock(product.id, delta);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el stock."
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleToggleOffer = async () => {
    if (!product) return;
    setPendingAction({ kind: "offer" });
    try {
      await onToggleOffer(product.id);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la oferta."
      );
    } finally {
      setPendingAction(null);
    }
  };

  if (!product) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{product.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {previewUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: previewUri }} style={styles.image} />
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Datos generales</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tienda</Text>
                <Text style={styles.infoValue}>{store.name}</Text>
              </View>
              {category ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Categoría</Text>
                  <Text style={styles.infoValue}>{category.name}</Text>
                </View>
              ) : null}
              {product.description ? (
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText}>
                    {product.description}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Precios</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceColumn}>
                  <Text style={styles.infoLabel}>Actual</Text>
                  <Text style={styles.priceValue}>
                    {formatCurrency(product.price)}
                  </Text>
                </View>
                {product.previousPrice !== undefined ? (
                  <View style={styles.priceColumn}>
                    <Text style={styles.infoLabel}>Anterior</Text>
                    <Text style={styles.pricePrevious}>
                      {formatCurrency(product.previousPrice)}
                    </Text>
                  </View>
                ) : null}
                {product.hasOffer && product.offerPrice !== undefined ? (
                  <View style={styles.priceColumn}>
                    <Text style={styles.infoLabel}>Oferta</Text>
                    <Text style={styles.priceOffer}>
                      {formatCurrency(product.offerPrice)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.metaLabel}>
                Actualizado el{" "}
                {new Date(product.priceUpdatedAt).toLocaleString()}
              </Text>

              {priceHistory.length > 1 ? (
                <PriceTrend history={priceHistory} />
              ) : null}

              {priceHistory.length > 0 ? (
                <View style={styles.historyList}>
                  {priceHistory
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <View
                        style={styles.historyRow}
                        key={`${entry.recordedAt}-${index}`}
                      >
                        <View>
                          <Text style={styles.historyDate}>
                            {new Date(entry.recordedAt).toLocaleString()}
                          </Text>
                          <Text style={styles.historyPrice}>
                            {formatCurrency(entry.price)}
                          </Text>
                        </View>
                        {entry.offerPrice !== undefined ? (
                          <Text style={styles.historyOffer}>
                            Oferta: {formatCurrency(entry.offerPrice)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Códigos</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>UPC</Text>
                <Text style={styles.infoValue}>
                  {product.barcodes?.upc ?? "Sin especificar"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Caja</Text>
                <Text style={styles.infoValue}>
                  {product.barcodes?.box ?? "Sin especificar"}
                </Text>
              </View>
            </View>

            {discountEntries.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Promoción</Text>
                {discountEntries.map((entry) => (
                  <View style={styles.infoRow} key={entry.label}>
                    <Text style={styles.infoLabel}>{entry.label}</Text>
                    <Text style={styles.infoValue}>{entry.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stock</Text>
              <View style={styles.stockRow}>
                <Text style={styles.stockValue}>{product.stock}</Text>
                <Text style={styles.stockLabel}>unidades disponibles</Text>
              </View>
              <View style={styles.actionRow}>
                {[-1, +1, +5].map((delta) => (
                  <Pressable
                    key={delta}
                    style={styles.actionButton}
                    onPress={() => handleAdjustStock(delta)}
                    disabled={pendingAction !== null}
                  >
                    <Text style={styles.actionLabel}>
                      {delta > 0 ? `+${delta}` : delta}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acciones</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => onEdit(product)}
                  disabled={pendingAction !== null}
                >
                  <Text style={styles.secondaryLabel}>Editar</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.offerButton]}
                  onPress={handleToggleOffer}
                  disabled={pendingAction !== null}
                >
                  <Text style={styles.offerLabel}>
                    {product.hasOffer ? "Desactivar oferta" : "Activar oferta"}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.dangerButton]}
                  onPress={() => onDelete(product)}
                  disabled={pendingAction !== null}
                >
                  <Text style={styles.dangerLabel}>Eliminar</Text>
                </Pressable>
              </View>
            </View>

            {availability.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Disponible en otras tiendas
                </Text>
                {availability.map((entry) => (
                  <View style={styles.availabilityRow} key={entry.product.id}>
                    <View style={styles.availabilityHeader}>
                      <Text style={styles.availabilityStore}>
                        {entry.store.name}
                      </Text>
                      <Text style={styles.availabilityStock}>
                        {entry.product.stock} en stock
                      </Text>
                    </View>
                    <Text style={styles.availabilityPrice}>
                      {formatCurrency(
                        entry.product.hasOffer &&
                          entry.product.offerPrice !== undefined
                          ? entry.product.offerPrice
                          : entry.product.price
                      )}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {pendingAction ? (
              <View style={styles.pendingWrapper}>
                <ActivityIndicator color="#b4bcff" />
                <Text style={styles.pendingLabel}>Actualizando…</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#080b16",
    borderRadius: 28,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8,
  },
  closeLabel: {
    color: "rgba(255,255,255,0.7)",
  },
  content: {
    padding: 24,
    gap: 20,
    paddingBottom: 48,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#11162a",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  infoValue: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  descriptionBox: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 14,
  },
  descriptionText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
  },
  priceRow: {
    flexDirection: "row",
    gap: 18,
  },
  priceColumn: {
    gap: 4,
  },
  priceValue: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  pricePrevious: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 18,
    textDecorationLine: "line-through",
  },
  priceOffer: {
    color: "#4cc38a",
    fontSize: 20,
    fontWeight: "700",
  },
  metaLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  historyList: {
    gap: 10,
  },
  historyRow: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyDate: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  historyPrice: {
    color: "#ffffff",
    fontWeight: "600",
    marginTop: 4,
  },
  historyOffer: {
    color: "#4cc38a",
    fontWeight: "600",
  },
  stockRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  stockValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "800",
  },
  stockLabel: {
    color: "rgba(255,255,255,0.6)",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "rgba(86,104,255,0.18)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryLabel: {
    color: "#b4bcff",
    fontWeight: "600",
  },
  offerButton: {
    backgroundColor: "rgba(76,195,138,0.2)",
  },
  offerLabel: {
    color: "#4cc38a",
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "rgba(255,99,132,0.16)",
  },
  dangerLabel: {
    color: "#ff99b2",
    fontWeight: "700",
  },
  availabilityRow: {
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  availabilityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  availabilityStore: {
    color: "#ffffff",
    fontWeight: "600",
  },
  availabilityStock: {
    color: "rgba(255,255,255,0.65)",
  },
  availabilityPrice: {
    color: "#ffffff",
    fontWeight: "700",
  },
  pendingWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  pendingLabel: {
    color: "rgba(255,255,255,0.7)",
  },
});
