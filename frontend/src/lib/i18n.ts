/**
 * GreenTrace i18n 国际化核心配置
 * @description 提供完整的多语言支持，包括语言切换、翻译加载、本地存储等功能
 */

// 支持的语言类型
export type Language = 'zh' | 'en';

// 翻译数据结构类型（基于messages文件结构）
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

// i18n配置
export const I18N_CONFIG = {
  defaultLanguage: 'zh' as Language,
  supportedLanguages: ['zh', 'en'] as Language[],
  storageKey: 'greentrace-language',
  fallbackLanguage: 'zh' as Language,
} as const;

// 语言显示配置
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

// 翻译数据缓存
const translationCache = new Map<Language, TranslationData>();

/**
 * 从本地存储获取用户语言偏好
 */
export const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return I18N_CONFIG.defaultLanguage;
  
  try {
    const stored = localStorage.getItem(I18N_CONFIG.storageKey);
    if (stored && I18N_CONFIG.supportedLanguages.includes(stored as Language)) {
      return stored as Language;
    }
  } catch (error) {
    console.warn('获取存储的语言设置失败:', error);
  }
  
  return I18N_CONFIG.defaultLanguage;
};

/**
 * 保存用户语言偏好到本地存储
 */
export const setStoredLanguage = (language: Language): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(I18N_CONFIG.storageKey, language);
  } catch (error) {
    console.warn('保存语言设置失败:', error);
  }
};

/**
 * 检测浏览器首选语言
 */
export const detectBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return I18N_CONFIG.defaultLanguage;
  
  const browserLang = navigator.language.toLowerCase();
  
  // 中文检测（包括简体、繁体、台湾、香港等）
  if (browserLang.includes('zh')) {
    return 'zh';
  }
  
  // 英文检测
  if (browserLang.includes('en')) {
    return 'en';
  }
  
  return I18N_CONFIG.defaultLanguage;
};

/**
 * 动态加载翻译文件
 */
export const loadTranslations = async (language: Language): Promise<TranslationData> => {
  // 先检查缓存
  if (translationCache.has(language)) {
    return translationCache.get(language)!;
  }
  
  try {
    // 动态导入翻译文件
    const translations = await import(`../../messages/${language}.json`);
    const data = translations.default as TranslationData;
    
    // 缓存翻译数据
    translationCache.set(language, data);
    
    console.log(`✅ 翻译文件加载成功: ${language}`);
    return data;
  } catch (error) {
    console.error(`❌ 翻译文件加载失败: ${language}`, error);
    
    // 加载失败时使用备用语言
    if (language !== I18N_CONFIG.fallbackLanguage) {
      console.log(`🔄 使用备用语言: ${I18N_CONFIG.fallbackLanguage}`);
      return loadTranslations(I18N_CONFIG.fallbackLanguage);
    }
    
    // 如果备用语言也加载失败，返回空的翻译对象
    return {} as TranslationData;
  }
};

/**
 * 预加载所有支持的语言文件
 */
export const preloadAllTranslations = async (): Promise<void> => {
  try {
    await Promise.all(
      I18N_CONFIG.supportedLanguages.map(lang => loadTranslations(lang))
    );
    console.log('✅ 所有翻译文件预加载完成');
  } catch (error) {
    console.warn('⚠️ 翻译文件预加载失败:', error);
  }
};

/**
 * 获取嵌套对象的值（支持 a.b.c 这样的键路径）
 */
export const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

/**
 * 翻译函数 - 支持嵌套键和回退值
 * @param translations 翻译数据对象
 * @param key 翻译键（支持嵌套，如 'navigation.home'）
 * @param fallback 回退文本（可选）
 * @param params 参数替换对象（可选）
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
  
  // 获取翻译文本
  let text = getNestedValue(translations, key);
  
  // 如果找不到翻译，使用回退值
  if (text === undefined || text === null) {
    text = fallback || key;
  }
  
  // 如果不是字符串，转换为字符串
  if (typeof text !== 'string') {
    text = String(text);
  }
  
  // 参数替换
  if (params && Object.keys(params).length > 0) {
    Object.entries(params).forEach(([paramKey, value]) => {
      const regex = new RegExp(`{{${paramKey}}}`, 'g');
      text = text.replace(regex, String(value));
    });
  }
  
  return text;
};

/**
 * 清除翻译缓存
 */
export const clearTranslationCache = (): void => {
  translationCache.clear();
  console.log('🗑️ 翻译缓存已清除');
};

/**
 * 获取当前缓存状态
 */
export const getCacheInfo = () => {
  return {
    cacheSize: translationCache.size,
    cachedLanguages: Array.from(translationCache.keys()),
    supportedLanguages: I18N_CONFIG.supportedLanguages,
  };
}; 