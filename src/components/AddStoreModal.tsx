import { useState } from "react";
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

interface AddStoreModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    location: string;
    description?: string;
    imageUrl?: string;
  }) => Promise<void>;
}

export const AddStoreModal = ({
  visible,
  onClose,
  onSubmit,
}: AddStoreModalProps) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setLocation("");
    setDescription("");
    setImageUrl("");
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || !location.trim()) {
      setError("Nombre y ubicación son obligatorios.");
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
      });
      reset();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
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
            <Text style={styles.title}>Nueva tienda</Text>
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
            />

            <Text style={styles.label}>Ubicación *</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Centro comercial, ciudad"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.input}
            />

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Notas internas o highlights"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[styles.input, styles.multiline]}
              multiline
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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.submitButton, submitting && styles.disabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitLabel}>
                {submitting ? "Guardando…" : "Guardar tienda"}
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
