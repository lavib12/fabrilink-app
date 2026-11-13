import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_KEY = "fabrilink.access";
const REFRESH_KEY = "fabrilink.refresh";

export interface StoredTokens {
  access: string | null;
  refresh: string | null;
}

// expo-secure-store has no web implementation; fall back to localStorage there (dev only).
const webStore = {
  get: (k: string) => (typeof localStorage === "undefined" ? null : localStorage.getItem(k)),
  set: (k: string, v: string) => localStorage.setItem(k, v),
  del: (k: string) => localStorage.removeItem(k),
};

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webStore.get(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value) webStore.set(key, value);
    else webStore.del(key);
    return;
  }
  if (value) await SecureStore.setItemAsync(key, value);
  else await SecureStore.deleteItemAsync(key);
}

// In-memory copy so every request doesn't hit the keychain.
let cache: StoredTokens | null = null;

export const tokenStorage = {
  async load(): Promise<StoredTokens> {
    if (!cache) {
      const [access, refresh] = await Promise.all([getItem(ACCESS_KEY), getItem(REFRESH_KEY)]);
      cache = { access, refresh };
    }
    return cache;
  },

  async save(tokens: Partial<StoredTokens>): Promise<void> {
    const current = await this.load();
    const next: StoredTokens = {
      access: tokens.access !== undefined ? tokens.access : current.access,
      refresh: tokens.refresh !== undefined ? tokens.refresh : current.refresh,
    };
    cache = next;
    await Promise.all([setItem(ACCESS_KEY, next.access), setItem(REFRESH_KEY, next.refresh)]);
  },

  async clear(): Promise<void> {
    cache = { access: null, refresh: null };
    await Promise.all([setItem(ACCESS_KEY, null), setItem(REFRESH_KEY, null)]);
  },
};
