import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MediaAsset } from "@/types/inventory";
import { resolveMediaUri } from "@/utils/media";

type MediaSource = "camera" | "library";

interface MediaPickerFieldProps {
  label: string;
  asset?: MediaAsset;
  imageUrl?: string;
  onAssetChange: (value?: MediaAsset) => void;
  onImageUrlChange?: (value?: string) => void;
  allowUrl?: boolean;
}

const sourceToType: Record<MediaSource, MediaAsset["type"]> = {
  camera: "camera",
  library: "library",
};

export const MediaPickerField = ({
  label,
  asset,
  imageUrl,
  onAssetChange,
  onImageUrlChange,
  allowUrl = true,
}: MediaPickerFieldProps) => {
  const [pending, setPending] = useState<MediaSource | null>(null);

  const previewUri = useMemo(
    () => resolveMediaUri(asset, imageUrl),
    [asset, imageUrl]
  );

  const requestPermission = useCallback(async (source: MediaSource) => {
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === ImagePicker.PermissionStatus.GRANTED;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === ImagePicker.PermissionStatus.GRANTED;
  }, []);

  const pickMedia = useCallback(
    async (source: MediaSource) => {
      const granted = await requestPermission(source);
      if (!granted) {
        Alert.alert(
          "Permiso requerido",
          source === "camera"
            ? "Necesitamos acceso a la cámara para capturar una foto."
            : "Necesitamos acceso a tu galería para seleccionar una imagen."
        );
        return;
      }

      try {
        setPending(source);
        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        };
        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return;
        }

        const first = result.assets[0];
        if (!first.uri) {
          Alert.alert("Error", "No se pudo obtener la imagen seleccionada.");
          return;
        }

        onAssetChange({
          uri: first.uri,
          type: sourceToType[source],
          thumbnailUri: first.uri,
        });
      } catch (error) {
        console.warn("MediaPickerField error", error);
        Alert.alert(
          "Error",
          "No se pudo seleccionar la imagen. Intenta nuevamente más tarde."
        );
      } finally {
        setPending(null);
      }
    },
    [onAssetChange, requestPermission]
  );

  const handleClearAsset = useCallback(() => {
    onAssetChange(undefined);
  }, [onAssetChange]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.previewContainer}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.actionButton, pending === "camera" && styles.disabled]}
          onPress={() => pickMedia("camera")}
          disabled={pending !== null}
        >
          <Text style={styles.actionLabel}>Usar cámara</Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            pending === "library" && styles.disabled,
          ]}
          onPress={() => pickMedia("library")}
          disabled={pending !== null}
        >
          <Text style={styles.actionLabel}>Galería</Text>
        </Pressable>
        {asset ? (
          <Pressable style={styles.clearButton} onPress={handleClearAsset}>
            <Text style={styles.clearLabel}>Eliminar</Text>
          </Pressable>
        ) : null}
      </View>
      {allowUrl && onImageUrlChange ? (
        <View style={styles.urlContainer}>
          <Text style={styles.secondaryLabel}>Imagen por URL</Text>
          <TextInput
            value={imageUrl ?? ""}
            onChangeText={(value) => onImageUrlChange(value || undefined)}
            placeholder="https://"
            placeholderTextColor="rgba(255,255,255,0.4)"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewContainer: {
    width: "100%",
    aspectRatio: 1.8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#171b2c",
  },
  preview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionButton: {
    backgroundColor: "rgba(86,104,255,0.16)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionLabel: {
    color: "#b4bcff",
    fontWeight: "600",
  },
  clearButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,99,132,0.18)",
  },
  clearLabel: {
    color: "#ff99b2",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.7,
  },
  urlContainer: {
    gap: 8,
  },
  secondaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  input: {
    backgroundColor: "#171b2c",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 15,
  },
});
