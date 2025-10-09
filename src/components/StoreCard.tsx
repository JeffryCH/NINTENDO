import type { FC } from "react";
import { Link } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Store } from "@/types/inventory";
import { formatCurrency } from "@/utils/formatCurrency";

interface StoreCardProps {
  store: Store;
  productCount: number;
  inventoryValue: number;
  lowStockCount: number;
}

export const StoreCard: FC<StoreCardProps> = ({
  store,
  productCount,
  inventoryValue,
  lowStockCount,
}) => {
  return (
    <Link
      href={{ pathname: "/store/[storeId]", params: { storeId: store.id } }}
      asChild
    >
      <Pressable style={styles.card}>
        {store.imageUrl ? (
          <Image
            source={{ uri: store.imageUrl }}
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
        <View style={styles.content}>
          <Text style={styles.title}>{store.name}</Text>
          <Text style={styles.subtitle}>{store.location}</Text>
          {store.description ? (
            <Text style={styles.description}>{store.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Productos</Text>
              <Text style={styles.metaValue}>{productCount}</Text>
            </View>
            <View style={styles.metaBadge}>
              <Text style={styles.metaLabel}>Inventario</Text>
              <Text style={styles.metaValue}>
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
    height: 160,
    backgroundColor: "#1f2233",
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
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },
  description: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  metaBadge: {
    flex: 1,
    backgroundColor: "#1a1d2b",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
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
