import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

/**
 * Singleton i18next instance with bundled resources. The active language is set
 * at bootstrap from the Forge context locale (real) or left at the default in the
 * mock preview, where it can also be switched manually. Importing this module
 * initializes i18next as a side effect.
 */
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
})

/** Map a Forge/BCP-47 locale (e.g. "ru-RU") to a supported language, else default. */
export function resolveLanguage(locale: string | undefined): Language {
  const lang = locale?.slice(0, 2).toLowerCase()
  return SUPPORTED_LANGUAGES.includes(lang as Language)
    ? (lang as Language)
    : DEFAULT_LANGUAGE
}

export default i18n
