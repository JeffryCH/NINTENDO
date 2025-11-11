import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ProductTemplate } from "@/types/inventory";

interface ProductTemplatePickerModalProps {
  visible: boolean;
  templates: ProductTemplate[];
  onClose: () => void;
  onSelect: (template: ProductTemplate) => void;
}

const formatDate = (value?: string): string | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString();
};

export const ProductTemplatePickerModal = ({
  visible,
  templates,
  onClose,
  onSelect,
}: ProductTemplatePickerModalProps) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return templates;
    }

    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.categoryName ?? "",
        template.sourceStoreName ?? "",
        template.barcodes?.upc ?? "",
        template.barcodes?.box ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [query, templates]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Plantillas de producto</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nombre, categoría o código"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Sin coincidencias</Text>
                <Text style={styles.emptySubtitle}>
                  Ajusta el término de búsqueda o crea un producto nuevo para
                  generar más plantillas.
                </Text>
              </View>
            ) : (
              filtered.map((template) => (
                <Pressable
                  key={template.id}
                  style={styles.item}
                  onPress={() => onSelect(template)}
                >
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{template.name}</Text>
                    <Text style={styles.itemPrice}>
                      ${template.basePrice.toFixed(2)}
                    </Text>
                  </View>
                  {template.categoryName ? (
                    <Text style={styles.itemMeta}>
                      Categoría: {template.categoryName}
                    </Text>
                  ) : null}
                  {template.sourceStoreName ? (
                    <Text style={styles.itemMeta}>
                      Tienda origen: {template.sourceStoreName}
                    </Text>
                  ) : null}
                  {template.barcodes?.upc || template.barcodes?.box ? (
                    <Text style={styles.itemMeta}>
                      Códigos:{" "}
                      {[template.barcodes?.upc, template.barcodes?.box]
                        .filter(Boolean)
                        .join(" • ")}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    {template.createdAt ? (
                      <Text style={styles.metaLabel}>
                        Creada: {formatDate(template.createdAt) ?? "—"}
                      </Text>
                    ) : null}
                    {template.lastUsedAt ? (
                      <Text style={styles.metaLabel}>
                        Último uso: {formatDate(template.lastUsedAt) ?? "—"}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: "#0f1320",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  closeLabel: {
    color: "rgba(255,255,255,0.6)",
  },
  searchRow: {
    flexDirection: "row",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  item: {
    backgroundColor: "#171b2c",
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
    paddingRight: 12,
  },
  itemPrice: {
    color: "#4cc38a",
    fontWeight: "700",
  },
  itemMeta: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  emptyState: {
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
  },
  emptySubtitle: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: 13,
  },
});
