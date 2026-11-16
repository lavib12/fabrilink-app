import { apiClient } from "../client";
import { type PickedImage, uploadImageFile } from "../upload";
import type {
  FabricCategory,
  FabricRollCreate,
  FabricRollDetail,
  FabricRollListItem,
  RollFilters,
  UploadedImage,
} from "../types";

/** Drops empty values and serialises booleans the way the backend expects ("true"). */
export function toRollQueryParams(filters: RollFilters): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    params[key] = value === true ? "true" : String(value);
  }
  return params;
}

export const catalogApi = {
  async categories(): Promise<FabricCategory[]> {
    const res = await apiClient.get("/catalog/categories/");
    return res.data.data;
  },
  async rolls(filters: RollFilters = {}): Promise<FabricRollListItem[]> {
    const res = await apiClient.get("/catalog/rolls/", { params: toRollQueryParams(filters) });
    return res.data.data;
  },
  async roll(id: string): Promise<FabricRollDetail> {
    const res = await apiClient.get(`/catalog/rolls/${id}/`);
    return res.data.data;
  },
  async createRoll(input: FabricRollCreate): Promise<{ roll: FabricRollDetail; message: string }> {
    const res = await apiClient.post("/catalog/rolls/", input);
    return { roll: res.data.data, message: res.data.message };
  },
  /** Uploads one listing photo picked on the phone; the server shrinks it and returns its URL. */
  uploadImage(photo: PickedImage): Promise<UploadedImage> {
    return uploadImageFile<UploadedImage>("/catalog/images/", photo);
  },
};
