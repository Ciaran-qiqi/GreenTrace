'use client';

import React, { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';

interface LanguageToggleProps {
  style?: 'dropdown' | 'buttons';
  size?: 'sm' | 'md' | 'lg';
  showFlag?: boolean;
  showName?: boolean;
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  style = 'dropdown',
  size = 'md',
  showFlag = true,
  showName = true,
  className = '',
}) => {
  const { language, changeLanguage, isLoading, mounted } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'zh', name: '中文', flag: '🇨🇳', short: 'CN' },
    { code: 'en', name: 'English', flag: '🇺🇸', short: 'EN' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    if (langCode !== language && !isLoading) {
      changeLanguage(langCode as 'zh' | 'en');
      setIsOpen(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm', 
    lg: 'px-4 py-3 text-base',
  };

  // 在服务器端渲染时显示占位符
  if (!mounted) {
    return (
      <div className={`${className}`}>
        <div className={`${sizeClasses[size]} bg-gray-200 rounded-lg animate-pulse`}>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 bg-gray-300 rounded"></div>
            <div className="w-8 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (style === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className={`
            ${sizeClasses[size]}
            bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg 
            hover:bg-gray-50 hover:border-gray-300 shadow-sm hover:shadow-md
            flex items-center space-x-1 transition-all duration-200
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${isOpen ? 'ring-2 ring-green-500 border-transparent' : ''}
          `}
          aria-label="选择语言"
        >
          {showFlag && <span className="text-base">{currentLang.flag}</span>}
          {showName ? <span className="font-medium">{currentLang.name}</span> : <span className="font-medium">{currentLang.short}</span>}
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-max overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoading}
                className={`
                  w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center space-x-2 transition-colors duration-150
                  ${language === lang.code ? 'bg-green-50 text-green-700' : 'text-gray-700'}
                  ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                `}
              >
                {showFlag && <span className="text-base">{lang.flag}</span>}
                <span className="font-medium">{showName ? lang.name : lang.short}</span>
                {language === lang.code && <span className="text-green-500 ml-auto">✓</span>}
              </button>
            ))}
            
            {/* 加载指示器 */}
            {isLoading && (
              <div className="px-3 py-2 text-center text-gray-500 text-xs border-t border-gray-100">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-300 border-t-green-500"></div>
                  <span>{language === 'zh' ? '切换中...' : 'Switching...'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex rounded-lg border border-gray-200 overflow-hidden bg-white/90 backdrop-blur-sm shadow-sm ${className}`}>
      {languages.map((lang, index) => (
        <button
          key={lang.code}
          onClick={() => handleLanguageChange(lang.code)}
          disabled={isLoading}
          className={`
            ${sizeClasses[size]}
            transition-all duration-200 flex items-center space-x-1 relative
            ${language === lang.code 
              ? 'bg-green-500 text-white shadow-sm' 
              : 'bg-transparent text-gray-600 hover:bg-gray-50'
            }
            ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            ${index > 0 ? 'border-l border-gray-200' : ''}
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:z-10
          `}
          aria-label={`切换到${lang.name}`}
        >
          <div className="relative">
            {showFlag && <span className="text-base">{lang.flag}</span>}
            <span className="font-medium">{showName ? lang.name : lang.short}</span>
            {isLoading && language === lang.code && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/80">
                <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}; 