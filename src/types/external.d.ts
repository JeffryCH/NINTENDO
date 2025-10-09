import type { ComponentType } from "react";

declare module "expo-router" {
  export * from "expo-router/build/index";
}

declare module "expo-router/index" {
  export * from "expo-router/build/index";
}

declare module "expo-router/entry" {
  const ExpoRouterEntry: ComponentType;
  export default ExpoRouterEntry;
}

declare module "expo-status-bar" {
  export * from "expo-status-bar/build/StatusBar";
  export { default } from "expo-status-bar/build/StatusBar";
}

declare module "@react-native-async-storage/async-storage" {
  type AsyncStorageType =
    typeof import("@react-native-async-storage/async-storage/lib/typescript/index")["default"];
  export type { AsyncStorageStatic } from "@react-native-async-storage/async-storage/lib/typescript/types";
  const AsyncStorage: AsyncStorageType;
  export default AsyncStorage;
  export * from "@react-native-async-storage/async-storage/lib/typescript/index";
}
