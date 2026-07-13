import { translations, type TranslationKey } from "./translations";

export const SUPPORTED_LOCALES = ["en", "he"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type TextDirection = "ltr" | "rtl";
export const DEFAULT_LOCALE: AppLocale = "en";

export const localeMetadata = {
  en: { languageTag: "en-US", direction: "ltr", nativeName: "English" },
  he: { languageTag: "he-IL", direction: "rtl", nativeName: "עברית" },
} as const satisfies Record<
  AppLocale,
  { languageTag: string; direction: TextDirection; nativeName: string }
>;

export function normalizeLocale(locale: unknown): AppLocale {
  if (typeof locale !== "string") {
    return DEFAULT_LOCALE;
  }

  const language = locale.trim().toLowerCase().replace("_", "-").split("-")[0];
  return language === "he" ? "he" : DEFAULT_LOCALE;
}

export function getDirection(locale: AppLocale | string): TextDirection {
  return localeMetadata[normalizeLocale(locale)].direction;
}

export function isRtl(locale: AppLocale | string): boolean {
  return getDirection(locale) === "rtl";
}

export function getLanguageTag(locale: AppLocale | string): string {
  return localeMetadata[normalizeLocale(locale)].languageTag;
}

type TranslationParams = Readonly<Record<string, string | number>>;

export function t(
  locale: AppLocale | string,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template = translations[normalizeLocale(locale)][key];

  if (!params) {
    return template;
  }

  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(params, token)
      ? String(params[token])
      : match,
  );
}

export { translations } from "./translations";
export type { TranslationDictionary, TranslationKey } from "./translations";
