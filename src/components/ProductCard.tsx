import {
  StyleSheet,
  Text,
  View,
  Image,
  Pressable,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Product, Category } from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";
import { formatCurrency } from "@/utils/formatCurrency";
import { useState, useMemo } from "react";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { BarcodePreviewModal } from "@/components/BarcodePreviewModal";

interface ProductCardProps {
  product: Product;
  category?: Category;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenQuick?: () => void;
}

export const ProductCard = ({
  product,
  category,
  onEdit,
  onDelete,
  onOpenQuick,
}: ProductCardProps) => {
  const adjustProductStock = useInventoryStore(
    (state) => state.adjustProductStock
  );
  const [quickOpen, setQuickOpen] = useState(false);
  const [qty, setQty] = useState<string>("1");
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeTarget, setBarcodeTarget] = useState<"upc" | "box" | null>(
    null
  );

  const upc = product.barcodes?.upc?.trim() || null;
  const box = product.barcodes?.box?.trim() || null;
  const barcodeLabel = useMemo(() => {
    if (barcodeTarget === "upc") return "UPC";
    if (barcodeTarget === "box") return "Caja";
    if (upc) return "UPC";
    if (box) return "Caja";
    return "Código";
  }, [upc, box, barcodeTarget]);
  const barcodeValue = useMemo(() => {
    if (barcodeTarget === "upc") return upc;
    if (barcodeTarget === "box") return box;
    return upc || box || null;
  }, [upc, box, barcodeTarget]);

  const hasOffer = product.hasOffer && product.offerPrice !== undefined;
  const previewUri = resolveMediaUri(product.imageAsset, product.imageUrl);
  return (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderText}>
              {product.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.overlayActions}>
          <Pressable
            style={[styles.actionButton, styles.primaryAction]}
            onPress={() => (onOpenQuick ? onOpenQuick() : setQuickOpen(true))}
          >
            <Ionicons name="flash" size={16} color="#ffffff" />
          </Pressable>
          {onEdit && (
            <Pressable style={styles.actionButton} onPress={onEdit}>
              <Ionicons name="create" size={16} color="#ffffff" />
            </Pressable>
          )}
          {onDelete && (
            <Pressable
              style={[styles.actionButton, styles.dangerAction]}
              onPress={onDelete}
            >
              <Ionicons name="trash" size={16} color="#ffffff" />
            </Pressable>
          )}
        </View>
        <View style={styles.stockBadge}>
          <Ionicons name="albums-outline" size={12} color="#ffffff" />
          <Text
            style={[
              styles.stockText,
              product.stock <= 3 && styles.lowStockText,
            ]}
          >
            {product.stock}
          </Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          {hasOffer ? (
            <>
              <Text style={styles.offerPrice}>
                {formatCurrency(product.offerPrice ?? product.price)}
              </Text>
              <Text style={styles.originalPrice}>
                {formatCurrency(product.price)}
              </Text>
            </>
          ) : (
            <Text style={styles.price}>{formatCurrency(product.price)}</Text>
          )}
        </View>
      </View>

      {/* Quick actions modal */}
      <Modal
        visible={quickOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setQuickOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setQuickOpen(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.sheet}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>Acción rápida</Text>
                  <Pressable onPress={() => setQuickOpen(false)}>
                    <Ionicons name="close" size={20} color="#ffffff" />
                  </Pressable>
                </View>
                <View style={styles.sheetContent}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.currentRow}>
                    <Ionicons name="albums-outline" size={16} color="#9aa4ff" />
                    <Text style={styles.currentLabel}>Stock actual:</Text>
                    <Text style={styles.currentValue}>{product.stock}</Text>
                  </View>

                  <View style={styles.stepperRow}>
                    <Pressable
                      style={[styles.stepperBtn, styles.ghostBtn]}
                      onPress={() => {
                        const n = Number(qty) || 0;
                        setQty(String(Math.max(1, Math.abs(n) - 1)));
                      }}
                    >
                      <Ionicons name="remove" size={18} color="#ffffff" />
                    </Pressable>
                    <TextInput
                      value={qty}
                      onChangeText={(t) => {
                        const only = t.replace(/[^0-9]/g, "");
                        setQty(only);
                      }}
                      keyboardType="number-pad"
                      style={styles.qtyInput}
                      placeholder="1"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                    <Pressable
                      style={[styles.stepperBtn, styles.ghostBtn]}
                      onPress={() => {
                        const n = Number(qty) || 0;
                        setQty(String(Math.min(9999, Math.abs(n) + 1)));
                      }}
                    >
                      <Ionicons name="add" size={18} color="#ffffff" />
                    </Pressable>
                  </View>

                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.primaryBtn, styles.positiveBtn]}
                      onPress={async () => {
                        const amount = Math.max(1, Number(qty) || 0);
                        try {
                          await adjustProductStock(product.id, amount, {
                            reason: "manual-adjust",
                            note: "Ajuste rápido (+)",
                          });
                          setQuickOpen(false);
                        } catch (e) {
                          // noop: keep modal open so user can retry
                        }
                      }}
                    >
                      <Ionicons name="arrow-up" size={16} color="#0f1320" />
                      <Text style={styles.primaryBtnLabel}>Sumar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.primaryBtn, styles.negativeBtn]}
                      onPress={async () => {
                        const amount = Math.max(1, Number(qty) || 0);
                        try {
                          await adjustProductStock(product.id, -amount, {
                            reason: "manual-adjust",
                            note: "Ajuste rápido (-)",
                          });
                          setQuickOpen(false);
                        } catch (e) {
                          // noop
                        }
                      }}
                    >
                      <Ionicons name="arrow-down" size={16} color="#0f1320" />
                      <Text style={styles.primaryBtnLabel}>Restar</Text>
                    </Pressable>
                  </View>

                  <View style={styles.codesRow}>
                    {upc ? (
                      <Pressable
                        style={[styles.secondaryBtn]}
                        onPress={() => {
                          setBarcodeTarget("upc");
                          setBarcodeOpen(true);
                        }}
                      >
                        <Ionicons
                          name="barcode-outline"
                          size={16}
                          color="#9aa4ff"
                        />
                        <Text style={styles.secondaryBtnLabel}>Ver UPC</Text>
                      </Pressable>
                    ) : null}
                    {box ? (
                      <Pressable
                        style={[styles.secondaryBtn]}
                        onPress={() => {
                          setBarcodeTarget("box");
                          setBarcodeOpen(true);
                        }}
                      >
                        <Ionicons
                          name="qr-code-outline"
                          size={16}
                          color="#9aa4ff"
                        />
                        <Text style={styles.secondaryBtnLabel}>Ver Caja</Text>
                      </Pressable>
                    ) : null}
                    {!upc && !box ? (
                      <View style={[styles.secondaryBtn, { opacity: 0.6 }]}>
                        <Ionicons
                          name="barcode-outline"
                          size={16}
                          color="#9aa4ff"
                        />
                        <Text style={styles.secondaryBtnLabel}>
                          Sin códigos
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <BarcodePreviewModal
        visible={barcodeOpen}
        code={barcodeValue}
        label={barcodeLabel}
        onClose={() => setBarcodeOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#131728",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f2440",
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: "700",
    color: "#9aa4ff",
  },
  overlayActions: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8,11,22,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  primaryAction: {
    backgroundColor: "#7c93ff",
    borderColor: "#7c93ff",
  },
  dangerAction: {
    backgroundColor: "rgba(255,99,132,0.92)",
    borderColor: "rgba(255,99,132,0.5)",
  },
  stockBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(8,11,22,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  stockText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  lowStockText: {
    color: "#ff6384",
  },
  info: {
    padding: 12,
    gap: 6,
    height: 84,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4cc38a",
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    textDecorationLine: "line-through",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#0f1320",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  sheetContent: {
    padding: 16,
    gap: 12,
  },
  productName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  currentValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  ghostBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  qtyInput: {
    width: 80,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  primaryBtnLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  positiveBtn: {
    backgroundColor: "#4cc38a",
  },
  negativeBtn: {
    backgroundColor: "#ff6384",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  secondaryBtnLabel: {
    color: "#9aa4ff",
    fontWeight: "700",
  },
  codesRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
});
