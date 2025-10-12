import { StyleSheet, Text, View, Image } from "react-native";
import { Product, Category } from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";
import { formatCurrency } from "@/utils/formatCurrency";

interface ProductCardProps {
  product: Product;
  category?: Category;
}

export const ProductCard = ({ product, category }: ProductCardProps) => {
  const hasOffer = product.hasOffer && product.offerPrice !== undefined;
  const previewUri = resolveMediaUri(product.imageAsset, product.imageUrl);
  return (
    <View style={styles.card}>
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.placeholder]}>
          <Text style={styles.placeholderText}>
            {product.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{product.name}</Text>
          <View style={styles.stockPill}>
            <Text
              style={[styles.stockText, product.stock <= 3 && styles.lowStock]}
            >
              {product.stock}
            </Text>
          </View>
        </View>
        {category ? <Text style={styles.category}>{category.name}</Text> : null}
        {product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={[styles.price, hasOffer && styles.strikethrough]}>
            {formatCurrency(product.price)}
          </Text>
          {hasOffer ? (
            <Text style={styles.offerPrice}>
              {formatCurrency(product.offerPrice ?? product.price)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#131728",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  thumbnail: {
    width: 88,
    height: 88,
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1f2440",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#9aa4ff",
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    flex: 1,
    marginRight: 8,
  },
  category: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  description: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
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
  strikethrough: {
    textDecorationLine: "line-through",
    color: "rgba(255,255,255,0.5)",
  },
  stockPill: {
    minWidth: 38,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(154,164,255,0.12)",
    alignItems: "center",
  },
  stockText: {
    color: "#9aa4ff",
    fontWeight: "600",
  },
  lowStock: {
    color: "#ff6384",
  },
});
