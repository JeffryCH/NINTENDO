import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Category, Product } from "@/types/inventory";
import { formatCurrency } from "@/utils/formatCurrency";
import type { CategoryMetricsSummary } from "@/utils/categoryMetrics";
import { ProductCard } from "./ProductCard";

interface CategorySummaryModalProps {
  visible: boolean;
  summary: {
    category: Category;
    metrics: CategoryMetricsSummary;
    products: Product[];
  } | null;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  categoryOrder?: string[];
}

export const CategorySummaryModal = ({
  visible,
  summary,
  onClose,
  onSelectProduct,
  categoryOrder,
}: CategorySummaryModalProps) => {
  if (!summary) {
    return null;
  }

  const { category, metrics, products } = summary;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{category.name}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Productos</Text>
                <Text style={styles.metricValue}>{metrics.productCount}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Stock total</Text>
                <Text style={styles.metricValue}>{metrics.totalStock}</Text>
              </View>
            </View>
            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Valor acumulado</Text>
                <Text style={styles.metricValueSmall}>
                  {formatCurrency(metrics.totalValue)}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Ofertas activas</Text>
                <Text style={styles.metricValue}>{metrics.offerCount}</Text>
              </View>
            </View>
            <View style={styles.alertBox}>
              <Text style={styles.alertLabel}>Bajo stock</Text>
              <Text
                style={[
                  styles.alertValue,
                  metrics.lowStockCount > 0 && styles.alertValueActive,
                ]}
              >
                {metrics.lowStockCount}
              </Text>
            </View>
            <View style={styles.list}>
              {products.length === 0 ? (
                <Text style={styles.emptyLabel}>
                  Esta categoría no tiene productos registrados.
                </Text>
              ) : (
                products.map((product) => (
                  <Pressable
                    key={product.id}
                    style={styles.productEntry}
                    onPress={() => {
                      onClose();
                      onSelectProduct(product);
                    }}
                  >
                    <ProductCard product={product} category={category} />
                  </Pressable>
                ))
              )}
            </View>
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
    paddingBottom: 40,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  metricCard: {
    flexBasis: "47%",
    backgroundColor: "#10162b",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  metricLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  metricValueSmall: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  alertLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
  },
  alertValue: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 16,
    fontWeight: "700",
  },
  alertValueActive: {
    color: "#ff99b2",
  },
  list: {
    gap: 16,
  },
  productEntry: {
    borderRadius: 20,
    overflow: "hidden",
  },
  emptyLabel: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
  },
});
