import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import el from "./locales/el.json";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      el: { translation: el }
    },
    lng: localStorage.getItem("duo_lang") || "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
