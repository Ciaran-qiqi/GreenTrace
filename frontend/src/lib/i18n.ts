/**
 * GreenTrace i18n core configuration
 * @description Provides complete multilingual support, including language switching, translation loading, local storage, etc.
 */

// Supported language types
export type Language = 'zh' | 'en';

// Translation data structure type (based on messages file structure)
export interface TranslationData {
  common: Record<string, string>;
  navigation: Record<string, string | Record<string, string>>;
  auth: Record<string, string>;
  nft: Record<string, string>;
  market: Record<string, string>;
  audit: Record<string, string>;
  carbon: Record<string, string>;
  liquidity: Record<string, string>;
  admin: Record<string, string>;
  form: Record<string, string>;
  messages: Record<string, string>;
  language: Record<string, string>;
  home: Record<string, any>;
  created: Record<string, any>;
  [key: string]: any;
}

// i18n configuration
export const I18N_CONFIG = {
  defaultLanguage: 'zh' as Language,
  supportedLanguages: ['zh', 'en'] as Language[],
  storageKey: 'greentrace-language',
  fallbackLanguage: 'zh' as Language,
} as const;

// Language display configuration
export const LANGUAGE_CONFIG = {
  zh: {
    name: '中文',
    flag: '🇨🇳',
    shortName: 'CN',
  },
  en: {
    name: 'English', 
    flag: '🇺🇸',
    shortName: 'EN',
  },
} as const;

// Translation data cache
const translationCache = new Map<Language, TranslationData>();

/**
 * Get user language preference from local storage
 */
export const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return I18N_CONFIG.defaultLanguage;
  
  try {
    const stored = localStorage.getItem(I18N_CONFIG.storageKey);
    if (stored && I18N_CONFIG.supportedLanguages.includes(stored as Language)) {
      return stored as Language;
    }
  } catch (error) {
    console.warn('Failed to get stored language setting:', error);
  }
  
  return I18N_CONFIG.defaultLanguage;
};

/**
 * Save user language preference to local storage
 */
export const setStoredLanguage = (language: Language): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(I18N_CONFIG.storageKey, language);
  } catch (error) {
    console.warn('Failed to save language setting:', error);
  }
};

/**
 * Detect browser preferred language
 */
export const detectBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return I18N_CONFIG.defaultLanguage;
  
  const browserLang = navigator.language.toLowerCase();
  
  // Chinese detection (including Simplified, Traditional, Taiwan, Hong Kong, etc.)
  if (browserLang.includes('zh')) {
    return 'zh';
  }
  
  // English detection
  if (browserLang.includes('en')) {
    return 'en';
  }
  
  return I18N_CONFIG.defaultLanguage;
};

/**
 * Dynamically load translation files
 */
export const loadTranslations = async (language: Language): Promise<TranslationData> => {
  // Check cache first
  if (translationCache.has(language)) {
    return translationCache.get(language)!;
  }
  
  try {
    // Dynamically import translation file
    const translations = await import(`../../messages/${language}.json`);
    const data = translations.default as TranslationData;
    
    // Cache translation data
    translationCache.set(language, data);
    
    console.log(`✅ Translation file loaded: ${language}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to load translation file: ${language}`, error);
    
    // Use fallback language if loading fails
    if (language !== I18N_CONFIG.fallbackLanguage) {
      console.log(`🔄 Using fallback language: ${I18N_CONFIG.fallbackLanguage}`);
      return loadTranslations(I18N_CONFIG.fallbackLanguage);
    }
    
    // If fallback language also fails, return empty translation object
    return {} as TranslationData;
  }
};

/**
 * Preload all supported language files
 */
export const preloadAllTranslations = async (): Promise<void> => {
  try {
    await Promise.all(
      I18N_CONFIG.supportedLanguages.map(lang => loadTranslations(lang))
    );
    console.log('✅ All translation files preloaded');
  } catch (error) {
    console.warn('⚠️ Failed to preload translation files:', error);
  }
};

/**
 * Get value from nested object (supports key paths like a.b.c)
 */
export const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

/**
 * Translation function - supports nested keys and fallback values
 * @param translations Translation data object
 * @param key Translation key (supports nesting, e.g. 'navigation.home')
 * @param fallback Fallback text (optional)
 * @param params Parameter replacement object (optional)
 */
export const translate = (
  translations: TranslationData | null,
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
): string => {
  if (!translations) {
    return fallback || key;
  }
  
  // Get translation text
  let text = getNestedValue(translations, key);
  
  // Use fallback value if translation not found
  if (text === undefined || text === null) {
    text = fallback || key;
  }
  
  // Convert to string if not a string
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  // Parameter replacement
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([paramKey, value]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      text = text.replace(regex, String(value));
    });
  }
  
  return text;
};

/**
 * Clear translation cache
 */
export const clearTranslationCache = (): void => {
  translationCache.clear();
  console.log('🗑️ Translation cache cleared');
};

/**
 * Get current cache status
 */
export const getCacheInfo = () => {
  return {
    cacheSize: translationCache.size,
    cachedLanguages: Array.from(translationCache.keys()),
    supportedLanguages: I18N_CONFIG.supportedLanguages,
  };
};