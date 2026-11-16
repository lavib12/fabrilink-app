import { Platform } from "react-native";

import { apiClient } from "./client";

export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** Sends one picked photo as multipart field "image" and returns the response's `data`. */
export async function uploadImageFile<T>(path: string, photo: PickedImage): Promise<T> {
  const form = new FormData();
  const name = photo.fileName || `photo-${Date.now()}.jpg`;
  const type = photo.mimeType || "image/jpeg";
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo.uri)).blob();
    form.append("image", blob, name);
  } else {
    // React Native's FormData takes a file descriptor object instead of a Blob.
    form.append("image", { uri: photo.uri, name, type } as unknown as Blob);
  }
  const res = await apiClient.post(path, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 90_000,
    transformRequest: (data) => data,
  });
  return res.data.data as T;
}
