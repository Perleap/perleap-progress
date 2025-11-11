import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files directly
import enTranslations from '../locales/en/translation.json';
import heTranslations from '../locales/he/translation.json';

// Get initial language from localStorage before init - with validation
const getInitialLanguage = (): string => {
  try {
    const stored = localStorage.getItem('language_preference');
    // Only accept valid languages, ignore browser language
    if (stored === 'he' || stored === 'en') {
      return stored;
    }
  } catch (e) {
    console.error('Error reading language preference:', e);
  }
  return 'en';
};

const storedLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: enTranslations,
    },
    he: {
      translation: heTranslations,
    },
  },
  fallbackLng: 'en',
  lng: storedLanguage,

  // Disable language detection to prevent automatic language changes
  detection: {
    order: [],
    caches: [],
  },

  interpolation: {
    escapeValue: false, // React already escapes values
  },

  react: {
    useSuspense: false,
  },
});

// Listen for language changes and persist to localStorage
i18n.on('languageChanged', (lng) => {
  // Only save valid languages
  if (lng === 'he' || lng === 'en') {
    try {
      localStorage.setItem('language_preference', lng);
    } catch (e) {
      console.error('Error saving language preference:', e);
    }
  }

  // Update HTML dir attribute for RTL
  document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

// Set initial direction BEFORE React renders
const initialLang = getInitialLanguage();
document.documentElement.dir = initialLang === 'he' ? 'rtl' : 'ltr';
document.documentElement.lang = initialLang;

export default i18n;
