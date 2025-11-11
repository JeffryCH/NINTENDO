import { useEffect, useMemo, useState } from "react";
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
  TextInput,
} from "react-native";
import {
  Category,
  InventoryMovement,
  InventoryMovementReason,
  Product,
  Store,
} from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";
import { formatCurrency } from "@/utils/formatCurrency";
import { PriceTrend } from "./PriceTrend";
import { BarcodePreviewModal } from "./BarcodePreviewModal";

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
  onAdjustStock: (
    productId: string,
    delta: number,
    metadata?: { note?: string; reason?: InventoryMovementReason }
  ) => Promise<void>;
  onToggleOffer: (
    productId: string,
    options: { enable: boolean; offerPrice?: number }
  ) => Promise<void>;
  onTransferStock: (payload: {
    productId: string;
    targetProductId: string;
    quantity: number;
    note?: string;
  }) => Promise<void>;
  availability: RelatedAvailability[];
  movements: InventoryMovement[];
}

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
  onTransferStock,
  availability,
  movements,
}: ProductDetailModalProps) => {
  const [pendingAction, setPendingAction] = useState<
    | { kind: "stock"; delta: number }
    | { kind: "offer" }
    | { kind: "transfer" }
    | null
  >(null);
  const [barcodePreview, setBarcodePreview] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<
    "increase" | "decrease" | null
  >(null);
  const [adjustmentValue, setAdjustmentValue] = useState("1");
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [offerModalMode, setOfferModalMode] = useState<
    "enable" | "disable" | null
  >(null);
  const [offerInput, setOfferInput] = useState("");
  const [offerError, setOfferError] = useState<string | null>(null);
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferDestinationId, setTransferDestinationId] = useState<
    string | null
  >(null);
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [transferNote, setTransferNote] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);

  const category = useMemo(() => {
    if (!product) return null;
    return categories.find((item) => item.id === product.categoryId) ?? null;
  }, [categories, product]);

  const previewUri = resolveMediaUri(product?.imageAsset, product?.imageUrl);
  const priceHistory = product?.priceHistory ?? [];
  const discountEntries = product ? discountInfoLabels(product) : [];
  const recentMovements = useMemo(() => {
    return movements
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 6);
  }, [movements]);

  useEffect(() => {
    if (!transferVisible) {
      return;
    }

    if (availability.length === 0) {
      setTransferDestinationId(null);
      return;
    }

    const fallback = availability[0]?.product.id ?? null;
    setTransferDestinationId((current) => {
      if (!current) {
        return fallback;
      }
      const exists = availability.some((entry) => entry.product.id === current);
      return exists ? current : fallback;
    });
  }, [availability, transferVisible]);

  const handleAdjustStock = async (
    delta: number,
    metadata: { reason: InventoryMovementReason; note: string }
  ): Promise<boolean> => {
    if (!product) return false;
    setPendingAction({ kind: "stock", delta });
    try {
      await onAdjustStock(product.id, delta, metadata);
      return true;
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el stock."
      );
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const openOfferModal = (mode: "enable" | "disable") => {
    if (!product) return;
    setOfferModalMode(mode);
    setOfferError(null);
    if (mode === "enable") {
      const baseline =
        product.offerPrice !== undefined
          ? product.offerPrice
          : Math.max(1, product.price * 0.9);
      const normalized = Math.round(baseline * 100) / 100;
      const displayValue = Number.isInteger(normalized)
        ? String(normalized)
        : normalized.toFixed(2);
      setOfferInput(displayValue);
    } else {
      setOfferInput("");
    }
  };

  const closeOfferModal = () => {
    setOfferModalMode(null);
    setOfferInput("");
    setOfferError(null);
  };

  const performOfferChange = async (
    enable: boolean,
    price?: number
  ): Promise<boolean> => {
    if (!product) return false;
    setPendingAction({ kind: "offer" });
    try {
      await onToggleOffer(product.id, { enable, offerPrice: price });
      return true;
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la oferta."
      );
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const confirmOfferChange = async () => {
    if (!offerModalMode || !product) return;
    if (offerModalMode === "enable") {
      const sanitized = offerInput.trim().replace(",", ".");
      const numeric = Number.parseFloat(sanitized);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setOfferError("Ingresa un precio válido mayor a cero.");
        return;
      }
      const normalized = Math.round(numeric * 100) / 100;
      if (normalized >= product.price) {
        setOfferError("El precio en oferta debe ser menor al precio base.");
        return;
      }
      const success = await performOfferChange(true, normalized);
      if (success) {
        closeOfferModal();
      }
    } else {
      const success = await performOfferChange(false);
      if (success) {
        closeOfferModal();
      }
    }
  };

  const openTransferModal = () => {
    if (availability.length === 0) {
      Alert.alert(
        "Transferencia no disponible",
        "No hay tiendas con este producto para recibir unidades."
      );
      return;
    }

    setTransferVisible(true);
    setTransferQuantity("1");
    setTransferNote("");
    setTransferError(null);
    setTransferDestinationId(availability[0].product.id);
  };

  const closeTransferModal = () => {
    setTransferVisible(false);
    setTransferQuantity("1");
    setTransferNote("");
    setTransferError(null);
  };

  const confirmTransfer = async () => {
    if (!product || !transferDestinationId) return;

    const sanitizedQuantity = transferQuantity.trim();
    const quantity = Number.parseInt(sanitizedQuantity, 10);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setTransferError("Ingresa una cantidad mayor a cero.");
      return;
    }

    if (quantity > product.stock) {
      setTransferError(
        `Stock insuficiente. Máximo disponible para transferir: ${product.stock}.`
      );
      setTransferQuantity(String(product.stock));
      return;
    }

    setPendingAction({ kind: "transfer" });
    try {
      await onTransferStock({
        productId: product.id,
        targetProductId: transferDestinationId,
        quantity,
        note: transferNote.trim() ? transferNote.trim() : undefined,
      });
      Alert.alert(
        "Transferencia registrada",
        `Se trasladaron ${quantity} unidades.`
      );
      closeTransferModal();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo completar la transferencia.";
      setTransferError(message);
    } finally {
      setPendingAction(null);
    }
  };

  const movementReasonLabel = (movement: InventoryMovement): string => {
    switch (movement.reason) {
      case "restock":
        return "Reposición";
      case "sale":
        return "Venta";
      case "transfer":
        return "Transferencia";
      case "initial-load":
        return "Stock inicial";
      default:
        return "Ajuste manual";
    }
  };

  if (!product) {
    return null;
  }

  const openAdjustment = (mode: "increase" | "decrease") => {
    setAdjustmentMode(mode);
    setAdjustmentValue("1");
    setAdjustmentError(null);
  };

  const closeAdjustment = () => {
    setAdjustmentMode(null);
    setAdjustmentValue("1");
    setAdjustmentError(null);
  };

  const confirmAdjustment = async () => {
    if (!adjustmentMode || !product) return;
    const sanitized = adjustmentValue.trim();
    const quantity = Number.parseInt(sanitized, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAdjustmentError("Ingresa una cantidad mayor a cero.");
      return;
    }

    const delta = adjustmentMode === "increase" ? quantity : -quantity;
    const metadata = {
      reason: adjustmentMode === "increase" ? "restock" : "sale",
      note:
        adjustmentMode === "increase"
          ? "Reposición manual desde detalle"
          : "Venta registrada desde detalle",
    } as { reason: InventoryMovementReason; note: string };

    const success = await handleAdjustStock(delta, metadata);
    if (success) {
      closeAdjustment();
    }
  };

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
                <View style={styles.codeValueRow}>
                  <Text style={styles.infoValue}>
                    {product.barcodes?.upc ?? "Sin especificar"}
                  </Text>
                  {product.barcodes?.upc ? (
                    <Pressable
                      style={styles.codeButton}
                      onPress={() =>
                        setBarcodePreview({
                          label: "Código UPC",
                          value: product.barcodes?.upc ?? "",
                        })
                      }
                    >
                      <Text style={styles.codeButtonLabel}>Ver</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Caja</Text>
                <View style={styles.codeValueRow}>
                  <Text style={styles.infoValue}>
                    {product.barcodes?.box ?? "Sin especificar"}
                  </Text>
                  {product.barcodes?.box ? (
                    <Pressable
                      style={styles.codeButton}
                      onPress={() =>
                        setBarcodePreview({
                          label: "Código de caja",
                          value: product.barcodes?.box ?? "",
                        })
                      }
                    >
                      <Text style={styles.codeButtonLabel}>Ver</Text>
                    </Pressable>
                  ) : null}
                </View>
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
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openAdjustment("increase")}
                  disabled={pendingAction !== null}
                >
                  <Text style={styles.secondaryLabel}>Sumar unidades</Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.dangerButton]}
                  onPress={() => openAdjustment("decrease")}
                  disabled={pendingAction !== null}
                >
                  <Text style={[styles.secondaryLabel, styles.dangerLabel]}>
                    Restar unidades
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    availability.length === 0 && styles.disabledButton,
                  ]}
                  onPress={openTransferModal}
                  disabled={pendingAction !== null || availability.length === 0}
                >
                  <Text style={styles.secondaryLabel}>Transferir</Text>
                </Pressable>
              </View>
              {recentMovements.length > 0 ? (
                <View style={styles.movementList}>
                  <Text style={styles.metaLabel}>Movimientos recientes</Text>
                  {recentMovements.map((movement) => (
                    <View style={styles.movementRow} key={movement.id}>
                      <View style={styles.movementHeader}>
                        <Text
                          style={[
                            styles.movementDelta,
                            movement.delta > 0
                              ? styles.movementIncrease
                              : movement.delta < 0
                              ? styles.movementDecrease
                              : null,
                          ]}
                        >
                          {movement.delta > 0
                            ? `+${movement.delta}`
                            : movement.delta}
                        </Text>
                        <Text style={styles.movementTimestamp}>
                          {new Date(movement.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.movementReason}>
                        {movementReasonLabel(movement)}
                      </Text>
                      <Text style={styles.movementStock}>
                        Stock: {movement.previousStock} →{" "}
                        {movement.resultingStock}
                      </Text>
                      {movement.note ? (
                        <Text style={styles.movementNote}>{movement.note}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
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
                  onPress={() =>
                    openOfferModal(product.hasOffer ? "disable" : "enable")
                  }
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
      <Modal
        visible={adjustmentMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeAdjustment}
      >
        <View style={styles.adjustBackdrop}>
          <View style={styles.adjustCard}>
            <Text style={styles.adjustTitle}>
              {adjustmentMode === "increase"
                ? "Sumar unidades"
                : "Restar unidades"}
            </Text>
            <TextInput
              style={styles.adjustInput}
              value={adjustmentValue}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, "");
                setAdjustmentValue(digits);
                if (adjustmentError) {
                  setAdjustmentError(null);
                }
              }}
              placeholder="Cantidad"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
            />
            {adjustmentError ? (
              <Text style={styles.adjustError}>{adjustmentError}</Text>
            ) : null}
            <View style={styles.adjustActions}>
              <Pressable
                style={[
                  styles.adjustCancelButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={closeAdjustment}
                disabled={pendingAction !== null}
              >
                <Text style={styles.adjustCancelLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryAdjustButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={confirmAdjustment}
                disabled={pendingAction !== null}
              >
                <Text style={styles.primaryAdjustLabel}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={offerModalMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeOfferModal}
      >
        <View style={styles.adjustBackdrop}>
          <View style={styles.adjustCard}>
            <Text style={styles.adjustTitle}>
              {offerModalMode === "enable"
                ? "Activar oferta"
                : "Desactivar oferta"}
            </Text>
            <Text style={styles.offerHint}>
              {offerModalMode === "enable"
                ? `Precio base: ${formatCurrency(product.price)}`
                : `El precio volverá a ${formatCurrency(product.price)}`}
            </Text>
            {offerModalMode === "enable" ? (
              <>
                <Text style={styles.offerSubHint}>
                  Define el precio promocional que se mostrará a los clientes.
                </Text>
                <TextInput
                  style={styles.adjustInput}
                  value={offerInput}
                  onChangeText={(text) => {
                    setOfferInput(text.replace(/[^0-9.,]/g, ""));
                    if (offerError) {
                      setOfferError(null);
                    }
                  }}
                  placeholder="Ej. 1499"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  autoFocus
                />
                {offerError ? (
                  <Text style={styles.adjustError}>{offerError}</Text>
                ) : null}
              </>
            ) : product.offerPrice !== undefined ? (
              <Text style={styles.offerSubHint}>
                Precio de oferta vigente: {formatCurrency(product.offerPrice)}
              </Text>
            ) : null}
            <View style={styles.adjustActions}>
              <Pressable
                style={[
                  styles.adjustCancelButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={closeOfferModal}
                disabled={pendingAction !== null}
              >
                <Text style={styles.adjustCancelLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryAdjustButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={confirmOfferChange}
                disabled={pendingAction !== null}
              >
                <Text style={styles.primaryAdjustLabel}>
                  {offerModalMode === "enable" ? "Guardar" : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <BarcodePreviewModal
        visible={barcodePreview !== null}
        label={barcodePreview?.label ?? ""}
        code={barcodePreview?.value ?? null}
        onClose={() => setBarcodePreview(null)}
      />
      <Modal
        visible={transferVisible}
        transparent
        animationType="fade"
        onRequestClose={closeTransferModal}
      >
        <View style={styles.adjustBackdrop}>
          <View style={styles.adjustCard}>
            <Text style={styles.adjustTitle}>Transferir stock</Text>
            <Text style={styles.offerSubHint}>
              Selecciona la tienda destino y las unidades a transferir.
            </Text>
            <View style={styles.transferList}>
              {availability.map((entry) => {
                const selected = entry.product.id === transferDestinationId;
                return (
                  <Pressable
                    key={entry.product.id}
                    style={[
                      styles.transferOption,
                      selected && styles.transferOptionSelected,
                    ]}
                    onPress={() => {
                      setTransferDestinationId(entry.product.id);
                      setTransferError(null);
                    }}
                  >
                    <Text style={styles.transferStore}>{entry.store.name}</Text>
                    <Text style={styles.transferMeta}>
                      Stock actual: {entry.product.stock}
                    </Text>
                    <Text style={styles.transferMeta}>
                      Precio{" "}
                      {formatCurrency(
                        entry.product.hasOffer &&
                          entry.product.offerPrice !== undefined
                          ? entry.product.offerPrice
                          : entry.product.price
                      )}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.adjustInput}
              value={transferQuantity}
              onChangeText={(text) => {
                setTransferQuantity(text.replace(/[^0-9]/g, ""));
                if (transferError) {
                  setTransferError(null);
                }
              }}
              placeholder="Cantidad a transferir"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="number-pad"
              autoFocus
              returnKeyType="done"
            />
            <TextInput
              style={styles.noteInput}
              value={transferNote}
              onChangeText={(text) => setTransferNote(text)}
              placeholder="Nota opcional"
              placeholderTextColor="rgba(255,255,255,0.45)"
              returnKeyType="done"
            />
            {transferError ? (
              <Text style={styles.adjustError}>{transferError}</Text>
            ) : null}
            <View style={styles.adjustActions}>
              <Pressable
                style={[
                  styles.adjustCancelButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={closeTransferModal}
                disabled={pendingAction !== null}
              >
                <Text style={styles.adjustCancelLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryAdjustButton,
                  pendingAction !== null && styles.adjustDisabled,
                ]}
                onPress={confirmTransfer}
                disabled={pendingAction !== null}
              >
                <Text style={styles.primaryAdjustLabel}>Transferir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  codeValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  codeButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(154,164,255,0.2)",
    marginLeft: 12,
  },
  codeButtonLabel: {
    color: "#9aa4ff",
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
  movementList: {
    marginTop: 16,
    gap: 12,
  },
  movementRow: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  movementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  movementDelta: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  movementIncrease: {
    color: "#4cc38a",
  },
  movementDecrease: {
    color: "#ff99b2",
  },
  movementTimestamp: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  movementReason: {
    color: "#ffffff",
    fontWeight: "600",
  },
  movementStock: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
  },
  movementNote: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
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
  disabledButton: {
    opacity: 0.5,
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
  offerHint: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },
  offerSubHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  adjustBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  adjustCard: {
    backgroundColor: "#10162b",
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  adjustTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  adjustInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  adjustError: {
    color: "#ff99b2",
    fontSize: 13,
  },
  adjustActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  adjustCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  adjustCancelLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  primaryAdjustButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#5668ff",
  },
  primaryAdjustLabel: {
    color: "#ffffff",
    fontWeight: "700",
  },
  adjustDisabled: {
    opacity: 0.6,
  },
  transferList: {
    gap: 10,
  },
  transferOption: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  transferOptionSelected: {
    borderColor: "rgba(86,104,255,0.6)",
    backgroundColor: "rgba(86,104,255,0.16)",
  },
  transferStore: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  transferMeta: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});
