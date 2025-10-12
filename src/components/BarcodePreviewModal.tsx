import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Barcode, {
  type Format as BarcodeFormat,
} from "@kichiyaki/react-native-barcode-generator";

type SupportedFormat = Extract<
  BarcodeFormat,
  "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC"
>;

interface BarcodePreviewModalProps {
  visible: boolean;
  code: string | null;
  label: string;
  onClose: () => void;
}

const resolveFormat = (value: string): SupportedFormat => {
  const trimmed = value.trim();
  const numeric = /^\d+$/.test(trimmed);
  const code39 = /^[0-9A-Z\-\. \$/\+%]+$/.test(trimmed);

  if (numeric) {
    if (trimmed.length === 13) return "EAN13";
    if (trimmed.length === 8) return "EAN8";
    if (trimmed.length === 12) return "UPC";
    return "CODE128";
  }

  if (code39) {
    return "CODE39";
  }

  return "CODE128";
};

export const BarcodePreviewModal = ({
  visible,
  code,
  label,
  onClose,
}: BarcodePreviewModalProps) => {
  const normalizedCode = useMemo(() => (code ? code.trim() : null), [code]);
  const format = useMemo(
    () =>
      normalizedCode
        ? resolveFormat(normalizedCode)
        : ("CODE128" as SupportedFormat),
    [normalizedCode]
  );

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Código de barras</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            <Text style={styles.label}>{label}</Text>
            {normalizedCode ? (
              <View style={styles.barcodeWrapper}>
                <Barcode
                  value={normalizedCode}
                  format={format}
                  height={120}
                  maxWidth={280}
                />
                <Text style={styles.codeValue}>{normalizedCode}</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyMessage}>
                  No hay código de barras registrado para este producto.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: "#0f1320",
    borderRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
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
    gap: 16,
  },
  label: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  barcodeWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 16,
  },
  codeValue: {
    color: "#0f1320",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
  },
  emptyState: {
    padding: 24,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  emptyMessage: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
});
