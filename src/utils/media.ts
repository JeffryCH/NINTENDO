import { MediaAsset } from "@/types/inventory";

export const resolveMediaUri = (
  asset?: MediaAsset,
  fallbackUrl?: string
): string | undefined => {
  if (asset?.thumbnailUri) {
    return asset.thumbnailUri;
  }
  if (asset?.uri) {
    return asset.uri;
  }
  if (fallbackUrl && fallbackUrl.trim()) {
    return fallbackUrl.trim();
  }
  return undefined;
};
