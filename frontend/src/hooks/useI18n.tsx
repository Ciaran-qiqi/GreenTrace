'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Simplified version of i18n implementation

type Language = 'zh' | 'en';

interface TranslationData {
  [key: string]: any;
}

interface I18nContextType {
  language: Language;
  translations: TranslationData | null;
  isLoading: boolean;
  changeLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isReady: boolean;
  getLocalizedPath: (path: string) => string;
  mounted: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

// Helper functions to get nested values

const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

// Extract language from url path

const getLanguageFromPath = (pathname: string): Language => {
  if (pathname.endsWith('/en')) return 'en';
  if (pathname.endsWith('/zh')) return 'zh';
  // If there is no language suffix, the default return to Chinese

  return 'zh';
};

// Remove language suffixes from paths

const removeLanguageSuffix = (pathname: string): string => {
  if (pathname.endsWith('/en') || pathname.endsWith('/zh')) {
    return pathname.slice(0, -3) || '/';
  }
  return pathname;
};

// Add language suffix to path

const addLanguageSuffix = (pathname: string, language: Language): string => {
  const cleanPath = removeLanguageSuffix(pathname);
  if (cleanPath === '/') {
    return `/${language}`;
  }
  return `${cleanPath}/${language}`;
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ 
  children
}) => {
  const pathname = usePathname();
  const router = useRouter();
  
  const [language, setLanguage] = useState<Language>('zh');
  const [translations, setTranslations] = useState<TranslationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadTranslations = useCallback(async (lang: Language) => {
    try {
      setIsLoading(true);
      const translationModule = await import(`../../messages/${lang}.json`);
      setTranslations(translationModule.default);
      setLanguage(lang);
      console.log(`✅ 语言加载完成: ${lang}`);
    } catch (error) {
      console.error('加载翻译失败:', error);
      if (lang !== 'zh') {
        return loadTranslations('zh');
      }
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }, []);

  const changeLanguage = useCallback((lang: Language) => {
    if (lang !== language) {
      const newPath = addLanguageSuffix(pathname, lang);
      console.log(`🔄 语言切换: ${language} → ${lang}, 路径: ${pathname} → ${newPath}`);
      router.push(newPath);
    }
  }, [language, pathname, router]);

  const t = useCallback((key: string, fallback?: string): string => {
    if (!translations) return fallback || key;
    
    const value = getNestedValue(translations, key);
    return value !== undefined ? String(value) : (fallback || key);
  }, [translations]);

  const getLocalizedPath = useCallback((path: string) => {
    if (path.endsWith('/zh') || path.endsWith('/en')) {
      return path;
    }
    return addLanguageSuffix(path, language);
  }, [language]);

  useEffect(() => {
    if (!mounted) return;

    const currentLang = getLanguageFromPath(pathname);
    console.log(`🌐 检测到路径语言: ${currentLang}, 当前路径: ${pathname}`);
    
    if (currentLang !== language) {
      loadTranslations(currentLang);
    } else if (!translations) {
      loadTranslations(currentLang);
    }
  }, [pathname, language, translations, loadTranslations, mounted]);

  return (
    <I18nContext.Provider value={{
      language,
      translations,
      isLoading,
      changeLanguage,
      t,
      isReady,
      getLocalizedPath,
      mounted,
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n必须在I18nProvider内使用');
  }
  return context;
};

export const useTranslation = () => {
  const { t, language, isReady, mounted } = useI18n();
  return { t, language, isReady, mounted };
};

export const useLocalizedNavigation = () => {
  const { getLocalizedPath, mounted } = useI18n();
  return { getLocalizedPath, mounted };
}; 