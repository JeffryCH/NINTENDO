import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ProductPriceSnapshot } from "@/types/inventory";
import { formatCurrency } from "@/utils/formatCurrency";

type TrendPoint = {
  key: string;
  height: number;
  isLatest: boolean;
};

interface PriceTrendProps {
  history: ProductPriceSnapshot[];
}

const toAsciiCurrency = (value: number) => {
  return formatCurrency(value)
    .replace(/\u20a1/g, "CRC")
    .replace(/\u00a0/g, " ");
};

export const PriceTrend = ({ history }: PriceTrendProps) => {
  const trend = useMemo(() => {
    if (!history || history.length <= 1) {
      return null;
    }

    const recent = history.slice(-8);
    if (recent.length <= 1) {
      return null;
    }

    const points = recent.map((entry) => {
      const reference = entry.offerPrice ?? entry.price;
      return reference;
    });

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;

    const pointData: TrendPoint[] = points.map((value, index) => {
      const height = Math.max(12, ((value - min) / span) * 100);
      return {
        key: `${recent[index].recordedAt}-${index}`,
        height,
        isLatest: index === points.length - 1,
      };
    });

    const startPrice = points[0];
    const endPrice = points[points.length - 1];
    const delta = endPrice - startPrice;
    const percentChange = startPrice > 0 ? (delta / startPrice) * 100 : 0;
    const percentLabel = Math.abs(percentChange).toFixed(1);
    const sign = delta > 0 ? "+" : "-";

    const changeLabel =
      delta === 0
        ? `Sin cambios (${toAsciiCurrency(endPrice)})`
        : `${delta > 0 ? "Subió" : "Bajó"} ${sign}${toAsciiCurrency(
            Math.abs(delta)
          )} (${sign}${percentLabel}%)`;

    const startLabel = `Inicio ${toAsciiCurrency(startPrice)}`;
    const endLabel = `Actual ${toAsciiCurrency(endPrice)}`;

    return {
      points: pointData,
      changeLabel,
      startLabel,
      endLabel,
    };
  }, [history]);

  if (!trend) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Tendencia reciente</Text>
        <Text style={styles.changeLabel}>{trend.changeLabel}</Text>
      </View>
      <View style={styles.chart}>
        {trend.points.map((point) => (
          <View
            key={point.key}
            style={[
              styles.bar,
              { height: `${point.height}%` },
              point.isLatest ? styles.barLatest : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>{trend.startLabel}</Text>
        <Text style={styles.footerLabel}>{trend.endLabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  changeLabel: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 12,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 80,
  },
  bar: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
  },
  barLatest: {
    backgroundColor: "#5668ff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
});
