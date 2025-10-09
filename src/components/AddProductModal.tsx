import { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Category } from "@/types/inventory";

export interface ProductFormData {
  name: string;
  price: number;
  stock: number;
  categoryName: string;
  imageUrl?: string;
  description?: string;
  hasOffer: boolean;
  offerPrice?: number;
}

interface AddProductModalProps {
  visible: boolean;
  categories: Category[];
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  mode?: "create" | "edit";
  initialValues?: ProductFormData;
}

const numberFrom = (value: string) => {
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

export const AddProductModal = ({
  visible,
  categories,
  onClose,
  onSubmit,
  mode = "create",
  initialValues,
}: AddProductModalProps) => {
  const [name, setName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [price, setPrice] = useState("0");
  const [stock, setStock] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [hasOffer, setHasOffer] = useState(false);
  const [offerPrice, setOfferPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = mode === "edit";

  const applyInitialValues = () => {
    if (isEdit && initialValues) {
      setName(initialValues.name);
      setCategoryName(initialValues.categoryName);
      setPrice(String(initialValues.price));
      setStock(String(initialValues.stock));
      setImageUrl(initialValues.imageUrl ?? "");
      setDescription(initialValues.description ?? "");
      setHasOffer(Boolean(initialValues.hasOffer));
      setOfferPrice(
        String(
          initialValues.offerPrice !== undefined
            ? initialValues.offerPrice
            : initialValues.price
        )
      );
    } else {
      setName("");
      setCategoryName("");
      setPrice("0");
      setStock("0");
      setImageUrl("");
      setDescription("");
      setHasOffer(false);
      setOfferPrice("0");
    }
    setError(null);
  };

  useEffect(() => {
    if (visible) {
      applyInitialValues();
    }
  }, [visible, isEdit, initialValues]);

  const handleClose = () => {
    if (submitting) return;
    applyInitialValues();
    onClose();
  };

  const handleSelectCategory = (value: string) => {
    setCategoryName(value);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedCategory = categoryName.trim();
    const numericPrice = numberFrom(price);
    const numericStock = Math.max(0, Math.floor(numberFrom(stock)));
    const numericOffer = numberFrom(offerPrice);

    if (!trimmedName || !trimmedCategory) {
      setError("Nombre y categoría son obligatorios.");
      return;
    }

    if (numericPrice <= 0) {
      setError("Define un precio mayor a 0.");
      return;
    }

    if (hasOffer && numericOffer <= 0) {
      setError("El precio en oferta debe ser mayor a 0.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmedName,
        categoryName: trimmedCategory,
        price: numericPrice,
        stock: numericStock,
        imageUrl: imageUrl.trim() || undefined,
        description: description.trim() || undefined,
        hasOffer,
        offerPrice: hasOffer ? numericOffer : undefined,
      });
      applyInitialValues();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isEdit
          ? "No se pudo actualizar el producto."
          : "No se pudo guardar el producto."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const suggestions = categories
    .map((category) => category.name)
    .filter((nameOption, index, arr) => arr.indexOf(nameOption) === index);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEdit ? "Editar producto" : "Nuevo producto"}
            </Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nintendo Switch Lite"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />

            <Text style={styles.label}>Categoría *</Text>
            <TextInput
              value={categoryName}
              onChangeText={handleSelectCategory}
              placeholder="Consolas"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />
            <View style={styles.suggestionRow}>
              {suggestions.slice(0, 3).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => handleSelectCategory(option)}
                  style={styles.suggestionPill}
                >
                  <Text style={styles.suggestionLabel}>{option}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Precio *</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />

            <Text style={styles.label}>Stock *</Text>
            <TextInput
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />

            <Text style={styles.label}>Imagen (URL)</Text>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Notas adicionales"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.input, styles.multiline]}
              multiline
            />

            <View style={styles.switchRow}>
              <Pressable
                style={[styles.checkbox, hasOffer && styles.checkboxChecked]}
                onPress={() => setHasOffer((value: boolean) => !value)}
              >
                {hasOffer ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </Pressable>
              <Text style={styles.switchLabel}>¿Tiene oferta activa?</Text>
            </View>

            {hasOffer ? (
              <>
                <Text style={styles.label}>Precio en oferta</Text>
                <TextInput
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.submitButton, submitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitLabel}>
                {submitting
                  ? "Guardando…"
                  : isEdit
                  ? "Guardar cambios"
                  : "Guardar producto"}
              </Text>
            </Pressable>
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
    maxHeight: "92%",
    backgroundColor: "#0f1320",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  closeLabel: {
    color: "rgba(255,255,255,0.6)",
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    backgroundColor: "#171b2c",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(154,164,255,0.15)",
  },
  suggestionLabel: {
    color: "#9aa4ff",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#5668ff",
    borderColor: "#5668ff",
  },
  checkboxMark: {
    color: "#ffffff",
    fontWeight: "700",
  },
  switchLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 15,
  },
  error: {
    color: "#ff6384",
    fontSize: 13,
  },
  submitButton: {
    marginTop: 16,
    backgroundColor: "#4cc38a",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitLabel: {
    color: "#0f1320",
    fontWeight: "700",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
});
