import type { FC } from "react";
import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Store } from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";
import { formatCurrency } from "@/utils/formatCurrency";

interface StoreCardProps {
  store: Store;
  productCount: number;
  inventoryValue: number;
  lowStockCount: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

export const StoreCard: FC<StoreCardProps> = ({
  store,
  productCount,
  inventoryValue,
  lowStockCount,
  onEdit,
  onDelete,
  onReport,
}) => {
  const coverUri = resolveMediaUri(store.imageAsset, store.imageUrl);

  return (
    <Link
      href={{ pathname: "/store/[storeId]", params: { storeId: store.id } }}
      asChild
    >
      <Pressable style={styles.card}>
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Text style={styles.coverFallbackText}>
              {store.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.coverActions}>
          {onEdit ? (
            <Pressable
              style={[styles.actionIcon, styles.editIcon]}
              onPress={onEdit}
              accessibilityLabel="Editar tienda"
            >
              <Ionicons name="create-outline" size={18} color="#ffffff" />
            </Pressable>
          ) : null}
          {onReport ? (
            <Pressable
              style={[styles.actionIcon, styles.reportIcon]}
              onPress={onReport}
              accessibilityLabel="Descargar reporte de tienda"
            >
              <Ionicons name="download-outline" size={18} color="#ffffff" />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              style={[styles.actionIcon, styles.deleteIcon]}
              onPress={onDelete}
              accessibilityLabel="Eliminar tienda"
            >
              <Ionicons name="trash-outline" size={18} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{store.name}</Text>
          <Text style={styles.subtitle}>{store.location}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Productos</Text>
              <Text style={styles.metaValue}>{productCount}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Inventario</Text>
              <Text style={[styles.metaValue, styles.metaValueCurrency]}>
                {formatCurrency(inventoryValue)}
              </Text>
            </View>
            <View
              style={[
                styles.metaBadge,
                lowStockCount > 0 && styles.lowStockBadge,
              ]}
            >
              <Text style={styles.metaLabel}>Bajo stock</Text>
              <Text
                style={[
                  styles.metaValue,
                  lowStockCount > 0 && styles.lowStockValue,
                ]}
              >
                {lowStockCount}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#12141d",
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cover: {
    width: "100%",
    height: 180,
    backgroundColor: "#1f2233",
  },
  coverActions: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#343d72",
    borderWidth: 1,
    borderColor: "#5668ff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  editIcon: {
    backgroundColor: "#3b82f6",
    borderColor: "#60a5fa",
  },
  reportIcon: {
    backgroundColor: "#7c3aed",
    borderColor: "#a78bfa",
  },
  deleteIcon: {
    backgroundColor: "#ef4444",
    borderColor: "#f87171",
  },
  coverFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  coverFallbackText: {
    fontSize: 42,
    fontWeight: "700",
    color: "#9aa4ff",
  },
  content: {
    padding: 20,
    gap: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  metaBadge: {
    flexGrow: 1,
    backgroundColor: "#1a1d2b",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 0,
    flexBasis: "31%",
  },
  metaLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
    textAlign: "center",
  },
  metaValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
    minWidth: 0,
    flexShrink: 1,
  },
  metaValueCurrency: {
    fontSize: 16,
  },
  lowStockBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,99,132,0.4)",
    backgroundColor: "rgba(255,99,132,0.08)",
  },
  lowStockValue: {
    color: "#ff6384",
  },
});
