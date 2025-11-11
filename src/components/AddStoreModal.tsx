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
} from "react-native";
import { MediaAsset } from "@/types/inventory";
import { MediaPickerField } from "@/components/MediaPickerField";

interface AddStoreModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
    imageAsset?: MediaAsset;
  }) => Promise<void>;
  mode?: "create" | "edit";
  initialValues?: {
    name?: string;
    location?: string;
    description?: string;
    imageUrl?: string;
    imageAsset?: MediaAsset;
  };
}

export const AddStoreModal = ({
  visible,
  onClose,
  onSubmit,
  mode = "create",
  initialValues,
}: AddStoreModalProps) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAsset, setImageAsset] = useState<MediaAsset | undefined>(
    undefined
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touchedName, setTouchedName] = useState(false);
  const [touchedLocation, setTouchedLocation] = useState(false);

  const isEdit = mode === "edit";
  const isNameValid = name.trim().length > 0;
  const isLocationValid = location.trim().length > 0;
  const isFormValid = isNameValid && isLocationValid;

  const applyInitialValues = () => {
    if (isEdit && initialValues) {
      setName(initialValues.name ?? "");
      setLocation(initialValues.location ?? "");
      setDescription(initialValues.description ?? "");
      setImageUrl(initialValues.imageUrl ?? "");
      setImageAsset(initialValues.imageAsset);
    } else {
      setName("");
      setLocation("");
      setDescription("");
      setImageUrl("");
      setImageAsset(undefined);
    }
    setError(null);
    setTouchedName(false);
    setTouchedLocation(false);
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

  const handleSubmit = async () => {
    setTouchedName(true);
    setTouchedLocation(true);

    if (!isFormValid) {
      setError("Completa los campos obligatorios antes de guardar.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        location: location.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        imageAsset,
      });
      applyInitialValues();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isEdit
          ? "No se pudo actualizar la tienda."
          : "No se pudo crear la tienda."
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
              {isEdit ? "Editar tienda" : "Nueva tienda"}
            </Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Nintendo Store Monterrey"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              onBlur={() => setTouchedName(true)}
            />
            {touchedName && !isNameValid ? (
              <Text style={styles.fieldError}>
                Ingresa un nombre válido para la tienda.
              </Text>
            ) : null}

            <Text style={styles.label}>Ubicación *</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Centro comercial, ciudad"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
              onBlur={() => setTouchedLocation(true)}
            />
            {touchedLocation && !isLocationValid ? (
              <Text style={styles.fieldError}>
                Proporciona la ubicación de la sucursal.
              </Text>
            ) : null}

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Notas internas o highlights"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.input, styles.multiline]}
              multiline
            />

            <MediaPickerField
              label="Imagen de la tienda"
              asset={imageAsset}
              imageUrl={imageUrl}
              onAssetChange={setImageAsset}
              onImageUrlChange={(value) => setImageUrl(value ?? "")}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[
                styles.submitButton,
                (submitting || !isFormValid) && styles.disabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || !isFormValid}
            >
              <Text style={styles.submitLabel}>
                {submitting
                  ? "Guardando..."
                  : isEdit
                  ? "Guardar cambios"
                  : "Guardar tienda"}
              </Text>
            </Pressable>
          </View>
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
    backgroundColor: "#0f1320",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeButton: {
    padding: 8,
  },
  closeLabel: {
    color: "rgba(255,255,255,0.6)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
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
  error: {
    color: "#ff6384",
    fontSize: 13,
  },
  fieldError: {
    color: "#ff9aa2",
    fontSize: 12,
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: "#5668ff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
});
