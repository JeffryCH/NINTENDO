import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onDetected: (value: string) => void;
  title?: string;
}

export const BarcodeScannerModal = ({
  visible,
  onClose,
  onDetected,
  title = "Escanear código",
}: BarcodeScannerModalProps) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanning(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const status = permission?.status;
        if (status === "granted") {
          if (mounted) {
            setHasPermission(true);
          }
          return;
        }

        const requestResult = await requestPermission();
        if (mounted) {
          setHasPermission(requestResult?.status === "granted");
        }
      } catch (error) {
        console.warn("BarcodeScannerModal permission error", error);
        if (mounted) {
          setHasPermission(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [permission?.status, requestPermission, visible]);

  const handleBarCodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (scanning) {
        return;
      }
      setScanning(true);
      onDetected(data.trim());
      onClose();
      setTimeout(() => setScanning(false), 300);
    },
    [onClose, onDetected, scanning]
  );

  useEffect(() => {
    if (hasPermission === false && visible) {
      Alert.alert(
        "Permiso denegado",
        "No podemos acceder a la cámara para escanear códigos. Ajusta los permisos del dispositivo."
      );
    }
  }, [hasPermission, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
          </View>

          {hasPermission === null ? (
            <View style={styles.messageContainer}>
              <Text style={styles.message}>Solicitando permisos…</Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.messageContainer}>
              <Text style={styles.message}>
                No se otorgó permiso para usar la cámara.
              </Text>
            </View>
          ) : (
            <View style={styles.scannerContainer}>
              <CameraView
                facing="back"
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "qr",
                    "ean13",
                    "ean8",
                    "upc_a",
                    "upc_e",
                    "code128",
                    "code39",
                  ],
                }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.focusFrame}>
                <Text style={styles.focusLabel}>Alinea el código aquí</Text>
              </View>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  messageContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  scannerContainer: {
    height: 340,
    position: "relative",
  },
  focusFrame: {
    position: "absolute",
    top: "20%",
    left: "10%",
    right: "10%",
    bottom: "20%",
    borderWidth: 2,
    borderColor: "rgba(86,104,255,0.7)",
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,11,22,0.15)",
  },
  focusLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
