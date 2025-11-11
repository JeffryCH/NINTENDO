import { useEffect, useMemo, useState } from "react";
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
import {
  Category,
  MediaAsset,
  ProductBarcodes,
  ProductDiscountInfo,
  ProductTemplate,
} from "@/types/inventory";
import { MediaPickerField } from "@/components/MediaPickerField";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { CategoryModal } from "@/components/CategoryModal";
import { ProductTemplatePickerModal } from "@/components/ProductTemplatePickerModal";

export interface ProductFormData {
  name: string;
  price: number;
  stock: number;
  categoryName: string;
  imageUrl?: string;
  imageAsset?: MediaAsset;
  description?: string;
  hasOffer: boolean;
  offerPrice?: number;
  barcodes?: ProductBarcodes;
  discountInfo?: ProductDiscountInfo;
  templateId?: string;
}

interface AddProductModalProps {
  visible: boolean;
  categories: Category[];
  templates: ProductTemplate[];
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCreateCategory: (data: {
    name: string;
    description?: string;
  }) => Promise<Category>;
  onTemplateUsed: (templateId: string) => Promise<ProductTemplate | undefined>;
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
  templates,
  onClose,
  onSubmit,
  onCreateCategory,
  onTemplateUsed,
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
  const [imageAsset, setImageAsset] = useState<MediaAsset | undefined>(
    undefined
  );
  const [barcodeUPC, setBarcodeUPC] = useState("");
  const [barcodeBox, setBarcodeBox] = useState("");
  const [zeroInterestMonths, setZeroInterestMonths] = useState("");
  const [cashOnly, setCashOnly] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"upc" | "box" | null>(
    null
  );
  const [createCategoryVisible, setCreateCategoryVisible] = useState(false);
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >(undefined);

  const isEdit = mode === "edit";

  const applyInitialValues = () => {
    if (isEdit && initialValues) {
      setName(initialValues.name);
      setCategoryName(initialValues.categoryName);
      setPrice(String(initialValues.price));
      setStock(String(initialValues.stock));
      setImageUrl(initialValues.imageUrl ?? "");
      setImageAsset(initialValues.imageAsset);
      setDescription(initialValues.description ?? "");
      setHasOffer(Boolean(initialValues.hasOffer));
      setOfferPrice(
        String(
          initialValues.offerPrice !== undefined
            ? initialValues.offerPrice
            : initialValues.price
        )
      );
      setBarcodeUPC(initialValues.barcodes?.upc ?? "");
      setBarcodeBox(initialValues.barcodes?.box ?? "");
      setZeroInterestMonths(
        initialValues.discountInfo?.zeroInterestMonths
          ? String(initialValues.discountInfo.zeroInterestMonths)
          : ""
      );
      setCashOnly(Boolean(initialValues.discountInfo?.cashOnly));
      setHasExpiration(Boolean(initialValues.discountInfo?.hasExpiration));
      setExpiresAt(initialValues.discountInfo?.expiresAt ?? "");
    } else {
      setName("");
      setCategoryName("");
      setPrice("0");
      setStock("0");
      setImageUrl("");
      setImageAsset(undefined);
      setDescription("");
      setHasOffer(false);
      setOfferPrice("0");
      setBarcodeUPC("");
      setBarcodeBox("");
      setZeroInterestMonths("");
      setCashOnly(false);
      setHasExpiration(false);
      setExpiresAt("");
    }
    setError(null);
    setSelectedTemplateId(undefined);
    setTemplatePickerVisible(false);
  };

  useEffect(() => {
    if (visible) {
      applyInitialValues();
    }
  }, [visible, isEdit, initialValues]);

  const handleClose = () => {
    if (submitting) return;
    setTemplatePickerVisible(false);
    applyInitialValues();
    onClose();
  };

  const handleSelectCategory = (value: string) => {
    setCategoryName(value);
  };

  const openScanner = (target: "upc" | "box") => {
    setScannerTarget(target);
    setScannerVisible(true);
  };

  const closeScanner = () => {
    setScannerVisible(false);
    setScannerTarget(null);
  };

  const handleScan = (value: string) => {
    if (!scannerTarget) return;
    if (scannerTarget === "upc") {
      setBarcodeUPC(value);
    } else {
      setBarcodeBox(value);
    }
  };

  const openCreateCategoryModal = () => {
    setCreateCategoryVisible(true);
  };

  const closeCreateCategoryModal = () => {
    setCreateCategoryVisible(false);
  };

  const handleSubmitCategoryCreation = async (data: {
    name: string;
    description?: string;
  }) => {
    const category = await onCreateCategory(data);
    setCategoryName(category.name);
    setError(null);
  };

  const openTemplatePicker = () => {
    setTemplatePickerVisible(true);
  };

  const closeTemplatePicker = () => {
    setTemplatePickerVisible(false);
  };

  const handleApplyTemplate = async (template: ProductTemplate) => {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setCategoryName(template.categoryName ?? "");
    setPrice(String(template.basePrice));
    setOfferPrice(String(template.basePrice));
    setHasOffer(false);
    setStock("0");
    setImageUrl(template.imageUrl ?? "");
    setImageAsset(template.imageAsset);
    setDescription(template.description ?? "");
    setBarcodeUPC(template.barcodes?.upc ?? "");
    setBarcodeBox(template.barcodes?.box ?? "");
    setZeroInterestMonths("");
    setCashOnly(false);
    setHasExpiration(false);
    setExpiresAt("");
    setError(null);
    closeTemplatePicker();
    try {
      await onTemplateUsed(template.id);
    } catch (usageError) {
      console.warn("No se pudo registrar el uso de la plantilla", usageError);
    }
  };

  const suggestedCategories = useMemo(
    () =>
      categories
        .map((category) => category.name)
        .filter((nameOption, index, arr) => arr.indexOf(nameOption) === index)
        .slice(0, 3),
    [categories]
  );

  const buildBarcodes = (): ProductBarcodes | undefined => {
    const upcValue = barcodeUPC.trim();
    const boxValue = barcodeBox.trim();
    if (!upcValue && !boxValue) {
      return undefined;
    }
    return {
      upc: upcValue || undefined,
      box: boxValue || undefined,
    };
  };

  const buildDiscountInfo = (): ProductDiscountInfo | undefined => {
    const zeroInterestRaw = parseInt(zeroInterestMonths, 10);
    const zeroInterest =
      Number.isFinite(zeroInterestRaw) && zeroInterestRaw > 0
        ? zeroInterestRaw
        : undefined;
    const normalizedExpiration = hasExpiration
      ? expiresAt.trim() || null
      : null;

    if (!zeroInterest && !cashOnly && !hasExpiration) {
      return undefined;
    }

    return {
      zeroInterestMonths: zeroInterest,
      cashOnly,
      hasExpiration,
      expiresAt: normalizedExpiration,
    };
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
        imageAsset,
        description: description.trim() || undefined,
        hasOffer,
        offerPrice: hasOffer ? numericOffer : undefined,
        barcodes: buildBarcodes(),
        discountInfo: buildDiscountInfo(),
        templateId: selectedTemplateId,
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
              {suggestedCategories.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => handleSelectCategory(option)}
                  style={styles.suggestionPill}
                >
                  <Text style={styles.suggestionLabel}>{option}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.categoryHelpers}>
              <Pressable
                onPress={openCreateCategoryModal}
                style={styles.createCategoryButton}
              >
                <Text style={styles.createCategoryLabel}>
                  Crear nueva categoría
                </Text>
              </Pressable>
              {templates.length > 0 ? (
                <Pressable
                  onPress={openTemplatePicker}
                  style={styles.templateButton}
                >
                  <Text style={styles.templateLabel}>
                    Buscar plantilla de producto
                  </Text>
                </Pressable>
              ) : null}
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

            <MediaPickerField
              label="Imagen del producto"
              asset={imageAsset}
              imageUrl={imageUrl}
              onAssetChange={setImageAsset}
              onImageUrlChange={(value) => setImageUrl(value ?? "")}
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

            <View style={styles.divider} />

            <Text style={styles.label}>Códigos de barras</Text>
            <View style={styles.barcodeRow}>
              <TextInput
                value={barcodeUPC}
                onChangeText={setBarcodeUPC}
                placeholder="Código UPC"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.input, styles.flex]}
                autoCapitalize="characters"
              />
              <Pressable
                style={styles.scanButton}
                onPress={() => openScanner("upc")}
              >
                <Text style={styles.scanLabel}>Escanear</Text>
              </Pressable>
            </View>
            <View style={styles.barcodeRow}>
              <TextInput
                value={barcodeBox}
                onChangeText={setBarcodeBox}
                placeholder="Código caja"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[styles.input, styles.flex]}
                autoCapitalize="characters"
              />
              <Pressable
                style={styles.scanButton}
                onPress={() => openScanner("box")}
              >
                <Text style={styles.scanLabel}>Escanear</Text>
              </Pressable>
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Promociones</Text>
            <View style={styles.switchRow}>
              <Pressable
                style={[styles.checkbox, cashOnly && styles.checkboxChecked]}
                onPress={() => setCashOnly((value: boolean) => !value)}
              >
                {cashOnly ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </Pressable>
              <Text style={styles.switchLabel}>
                Solo aplica pagando en efectivo
              </Text>
            </View>
            <Text style={styles.secondaryLabel}>Meses tasa 0</Text>
            <TextInput
              value={zeroInterestMonths}
              onChangeText={setZeroInterestMonths}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />
            <View style={styles.switchRow}>
              <Pressable
                style={[
                  styles.checkbox,
                  hasExpiration && styles.checkboxChecked,
                ]}
                onPress={() => setHasExpiration((value: boolean) => !value)}
              >
                {hasExpiration ? (
                  <Text style={styles.checkboxMark}>✓</Text>
                ) : null}
              </Pressable>
              <Text style={styles.switchLabel}>
                La promoción tiene fecha de expiración
              </Text>
            </View>
            {hasExpiration ? (
              <TextInput
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={styles.input}
                autoCapitalize="none"
              />
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
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={closeScanner}
        onDetected={(value) => {
          handleScan(value);
          closeScanner();
        }}
        title={
          scannerTarget === "upc"
            ? "Escanea el código UPC"
            : "Escanea el código de caja"
        }
      />
      <CategoryModal
        visible={createCategoryVisible}
        mode="create"
        onClose={closeCreateCategoryModal}
        onSubmit={async (data) => {
          await handleSubmitCategoryCreation(data);
        }}
      />
      <ProductTemplatePickerModal
        visible={templatePickerVisible}
        templates={templates}
        onClose={closeTemplatePicker}
        onSelect={handleApplyTemplate}
      />
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
  categoryHelpers: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  createCategoryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(154,164,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(154,164,255,0.28)",
  },
  createCategoryLabel: {
    color: "#9aa4ff",
    fontWeight: "600",
  },
  templateButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(76,195,138,0.12)",
    borderWidth: 1,
    borderColor: "rgba(76,195,138,0.3)",
  },
  templateLabel: {
    color: "#4cc38a",
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
  secondaryLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 12,
    marginBottom: -4,
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
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 12,
  },
  barcodeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  scanButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(86,104,255,0.16)",
  },
  scanLabel: {
    color: "#b4bcff",
    fontWeight: "600",
  },
  flex: {
    flex: 1,
  },
});
