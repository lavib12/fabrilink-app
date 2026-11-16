import { Image, type ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import type { StyleProp } from "react-native";

import { tokenStorage } from "@/api/tokenStorage";
import { CLIENT_PLATFORM_HEADER } from "@/config";

/** An image from a protected URL (e.g. a payment receipt), sent with the user's token. */
export function AuthImage({ uri, style, label }: { uri: string; style?: StyleProp<ImageStyle>; label?: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void tokenStorage.load().then((t) => alive && setToken(t.access));
    return () => {
      alive = false;
    };
  }, []);
  if (token === undefined) return null;
  return (
    <Image
      source={{ uri, headers: { ...CLIENT_PLATFORM_HEADER, ...(token ? { Authorization: `Bearer ${token}` } : {}) } }}
      style={style}
      contentFit="contain"
      accessibilityLabel={label}
    />
  );
}
