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
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Category,
  MediaAsset,
  ProductBarcodes,
  ProductDiscountInfo,
  ProductTemplate,
} from "@/types/inventory";
import { MediaPickerField } from "@/components/MediaPickerField";
import { BarcodeScannerModal } from "@/components/BarcodeScannerModal";
import { ProductTemplatePickerModal } from "@/components/ProductTemplatePickerModal";

export interface ProductFormData {
  name: string;
  price: number;
  onlinePrice?: number;
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
  const [onlinePrice, setOnlinePrice] = useState("0");
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
  const [categoryDropdownVisible, setCategoryDropdownVisible] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
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
      setOnlinePrice(String(initialValues.onlinePrice ?? 0));
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
      setOnlinePrice("0");
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
    setCategoryDropdownVisible(false);
    setIsCreatingCategory(false);
  };

  const handleCreateCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setError("Nombre de categoría requerido.");
      return;
    }

    try {
      const category = await onCreateCategory({ name: trimmed });
      setCategoryName(category.name);
      setNewCategoryName("");
      setIsCreatingCategory(false);
      setCategoryDropdownVisible(false);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la categoría."
      );
    }
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
        .filter((nameOption, index, arr) => arr.indexOf(nameOption) === index),
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
    const numericOnlinePrice = numberFrom(onlinePrice);
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
        onlinePrice: numericOnlinePrice > 0 ? numericOnlinePrice : undefined,
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
            <View style={styles.titleRow}>
              <Ionicons
                name={isEdit ? "create" : "add-circle"}
                size={20}
                color="#ffffff"
              />
              <Text style={styles.title}>
                {isEdit ? "Editar producto" : "Nuevo producto"}
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            {/* SECCIÓN BÁSICA */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información básica</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Nombre del producto *</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nintendo Switch Lite"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Precio online</Text>
                <TextInput
                  value={onlinePrice}
                  onChangeText={setOnlinePrice}
                  keyboardType="decimal-pad"
                  placeholder="8299.00"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Categoría *</Text>
                <Pressable
                  style={styles.categorySelector}
                  onPress={() =>
                    setCategoryDropdownVisible(!categoryDropdownVisible)
                  }
                >
                  <Text
                    style={[
                      styles.categorySelectorText,
                      !categoryName && styles.categorySelectorPlaceholder,
                    ]}
                  >
                    {categoryName || "Selecciona una categoría"}
                  </Text>
                  <Ionicons
                    name={
                      categoryDropdownVisible ? "chevron-up" : "chevron-down"
                    }
                    size={18}
                    color="#9aa4ff"
                  />
                </Pressable>

                {categoryDropdownVisible && (
                  <View style={styles.categoryDropdown}>
                    {isCreatingCategory ? (
                      <View style={styles.createCategoryForm}>
                        <TextInput
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                          placeholder="Nombre de la nueva categoría"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          style={styles.input}
                          autoFocus
                        />
                        <View style={styles.categoryActions}>
                          <Pressable
                            style={[styles.categoryButton, styles.cancelButton]}
                            onPress={() => {
                              setIsCreatingCategory(false);
                              setNewCategoryName("");
                            }}
                          >
                            <Text style={styles.categoryButtonLabel}>
                              Cancelar
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.categoryButton,
                              styles.confirmButton,
                            ]}
                            onPress={handleCreateCategory}
                          >
                            <Text
                              style={[
                                styles.categoryButtonLabel,
                                styles.confirmButtonLabel,
                              ]}
                            >
                              Crear
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <>
                        {suggestedCategories.map((category) => (
                          <Pressable
                            key={category}
                            style={[
                              styles.categoryOption,
                              categoryName === category &&
                                styles.categoryOptionSelected,
                            ]}
                            onPress={() => handleSelectCategory(category)}
                          >
                            <Text
                              style={[
                                styles.categoryOptionLabel,
                                categoryName === category &&
                                  styles.categoryOptionLabelSelected,
                              ]}
                            >
                              {category}
                            </Text>
                          </Pressable>
                        ))}
                        <Pressable
                          style={styles.createCategoryOption}
                          onPress={() => setIsCreatingCategory(true)}
                        >
                          <Ionicons
                            name="add-circle"
                            size={16}
                            color="#5668ff"
                          />
                          <Text style={styles.createCategoryOptionLabel}>
                            Crear categoría
                          </Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                )}
              </View>

              {templates.length > 0 ? (
                <Pressable
                  onPress={openTemplatePicker}
                  style={styles.templateLinkButton}
                >
                  <Ionicons name="document-text" size={14} color="#9aa4ff" />
                  <Text style={styles.templateLinkLabel}>Usar plantilla</Text>
                </Pressable>
              ) : null}
            </View>

            {/* SECCIÓN PRECIO E INVENTARIO */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Precio e inventario</Text>

              <View style={styles.rowGroup}>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Precio *</Text>
                  <TextInput
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.input}
                  />
                </View>
                <View style={[styles.fieldGroup, styles.flex]}>
                  <Text style={styles.label}>Stock *</Text>
                  <TextInput
                    value={stock}
                    onChangeText={setStock}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[styles.toggle, hasOffer && styles.toggleActive]}
                    onPress={() => setHasOffer((v) => !v)}
                  >
                    {hasOffer && <Text style={styles.toggleDot}>●</Text>}
                  </Pressable>
                  <Text style={styles.toggleLabel}>¿Tiene oferta activa?</Text>
                </View>
              </View>

              {hasOffer ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Precio en oferta</Text>
                  <TextInput
                    value={offerPrice}
                    onChangeText={setOfferPrice}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.input}
                  />
                </View>
              ) : null}
            </View>

            {/* SECCIÓN CÓDIGOS DE BARRAS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Códigos de barras</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Código UPC</Text>
                <View style={styles.barcodeInputRow}>
                  <TextInput
                    value={barcodeUPC}
                    onChangeText={setBarcodeUPC}
                    placeholder="Código UPC"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={[styles.input, styles.flex]}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => openScanner("upc")}
                  >
                    <Ionicons name="barcode" size={20} color="#5668ff" />
                  </Pressable>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Código de caja</Text>
                <View style={styles.barcodeInputRow}>
                  <TextInput
                    value={barcodeBox}
                    onChangeText={setBarcodeBox}
                    placeholder="Código de caja"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={[styles.input, styles.flex]}
                    autoCapitalize="characters"
                  />
                  <Pressable
                    style={styles.iconButton}
                    onPress={() => openScanner("box")}
                  >
                    <Ionicons name="barcode" size={20} color="#5668ff" />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* SECCIÓN PROMOCIONES */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Opciones de promoción</Text>

              <View style={styles.fieldGroup}>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[styles.toggle, cashOnly && styles.toggleActive]}
                    onPress={() => setCashOnly((v) => !v)}
                  >
                    {cashOnly && <Text style={styles.toggleDot}>●</Text>}
                  </Pressable>
                  <Text style={styles.toggleLabel}>
                    Solo en pago en efectivo
                  </Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Meses a tasa 0</Text>
                <TextInput
                  value={zeroInterestMonths}
                  onChangeText={setZeroInterestMonths}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <View style={styles.toggleRow}>
                  <Pressable
                    style={[
                      styles.toggle,
                      hasExpiration && styles.toggleActive,
                    ]}
                    onPress={() => setHasExpiration((v) => !v)}
                  >
                    {hasExpiration && <Text style={styles.toggleDot}>●</Text>}
                  </Pressable>
                  <Text style={styles.toggleLabel}>
                    Tiene fecha de expiración
                  </Text>
                </View>
              </View>

              {hasExpiration ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Fecha de expiración</Text>
                  <TextInput
                    value={expiresAt}
                    onChangeText={setExpiresAt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>
              ) : null}
            </View>

            {/* SECCIÓN MEDIA */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción e imagen</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Notas adicionales sobre el producto"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={[styles.input, styles.multiline]}
                  multiline
                />
              </View>

              <MediaPickerField
                label="Imagen del producto"
                asset={imageAsset}
                imageUrl={imageUrl}
                onAssetChange={setImageAsset}
                onImageUrlChange={(value) => setImageUrl(value ?? "")}
              />
            </View>

            {/* ERROR Y BOTÓN */}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.submitButton, submitting && styles.submitDisabled]}
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 16,
    paddingBottom: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  rowGroup: {
    flexDirection: "row",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#171b2c",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: "#ffffff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  templateLinkButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  templateLinkLabel: {
    color: "#9aa4ff",
    fontWeight: "600",
    fontSize: 12,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  toggle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#5668ff",
    borderColor: "#5668ff",
  },
  toggleDot: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  toggleLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  categorySelector: {
    backgroundColor: "#171b2c",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categorySelectorText: {
    color: "#ffffff",
    fontSize: 14,
    flex: 1,
  },
  categorySelectorPlaceholder: {
    color: "rgba(255,255,255,0.4)",
  },
  categoryDropdown: {
    marginTop: 6,
    backgroundColor: "#171b2c",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(86,104,255,0.25)",
    overflow: "hidden",
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  categoryOptionSelected: {
    backgroundColor: "rgba(86,104,255,0.12)",
  },
  categoryOptionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  categoryOptionLabelSelected: {
    color: "#9aa4ff",
    fontWeight: "600",
  },
  createCategoryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(86,104,255,0.08)",
    borderTopWidth: 1,
    borderTopColor: "rgba(86,104,255,0.25)",
  },
  createCategoryOptionLabel: {
    color: "#5668ff",
    fontSize: 14,
    fontWeight: "600",
  },
  createCategoryForm: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  categoryActions: {
    flexDirection: "row",
    gap: 8,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  confirmButton: {
    backgroundColor: "#5668ff",
    borderColor: "#5668ff",
  },
  categoryButtonLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
  },
  confirmButtonLabel: {
    color: "#ffffff",
  },
  barcodeInputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(86,104,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(86,104,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    color: "#ff6384",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
    backgroundColor: "#5668ff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
});
