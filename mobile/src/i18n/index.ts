import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import bn from "./bn.json";
import en from "./en.json";

export type Language = "bn" | "en";

// Bangla is the product default; fall back to English if the device is set to English.
const deviceLanguage = getLocales()[0]?.languageCode;
const initialLanguage: Language = deviceLanguage === "en" ? "en" : "bn";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
