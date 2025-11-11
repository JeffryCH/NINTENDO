import { Stack } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useInventoryStore } from "@/stores/useInventoryStore";
import { FloatingProductSearch } from "@/components/FloatingProductSearch";

export default function RootLayout() {
  const loadInventory = useInventoryStore((state) => state.load);
  const isReady = useInventoryStore((state) => state.isReady);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5668ff" />
          <Text style={styles.loadingLabel}>Preparando tu inventario...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#0f1320",
          },
          headerTintColor: "#ffffff",
          contentStyle: {
            backgroundColor: "#080b16",
          },
          headerTitleStyle: {
            fontWeight: "700",
          },
        }}
      />
      <FloatingProductSearch />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#080b16",
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingLabel: {
    color: "#ffffff",
    fontSize: 16,
  },
});
