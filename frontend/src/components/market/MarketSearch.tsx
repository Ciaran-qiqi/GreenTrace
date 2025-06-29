'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/hooks/useI18n';

interface MarketSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Market Search Components
 * @description Supports search history and autocomplete NFT search components
 */
export const MarketSearch: React.FC<MarketSearchProps> = ({
  value,
  onChange,
  placeholder,
  className = "",
}) => {
  const { t } = useTranslation();
  const defaultPlaceholder = placeholder || t('market.search.placeholder', '搜索NFT标题、描述或Token ID...');
  const [isFocused, setIsFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search history from local storage

  useEffect(() => {
    try {
      const history = localStorage.getItem('nft_search_history');
      if (history) {
        setSearchHistory(JSON.parse(history));
      }
    } catch (error) {
      console.error(t('market.search.loadHistoryError', '加载搜索历史失败'), error);
    }
  }, []);

  // Save search history

  const saveSearchHistory = (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    const newHistory = [
      searchTerm.trim(),
      ...searchHistory.filter(item => item !== searchTerm.trim())
    ].slice(0, 10); // Only the last 10 searches are retained


    setSearchHistory(newHistory);
    try {
      localStorage.setItem('nft_search_history', JSON.stringify(newHistory));
    } catch (error) {
      console.error(t('market.search.saveHistoryError', '保存搜索历史失败'), error);
    }
  };

  // Process input changes

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  // Handle keyboard events

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      saveSearchHistory(value);
      setShowSuggestions(false);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  // Select search suggestions

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Clear search

  const clearSearch = () => {
    onChange('');
    inputRef.current?.focus();
  };

  // Clear search history

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('nft_search_history');
    setShowSuggestions(false);
  };

  // Filter search suggestions

  const filteredSuggestions = value.trim() 
    ? searchHistory.filter(item => 
        item.toLowerCase().includes(value.toLowerCase()) && 
        item !== value
      ).slice(0, 5)
    : searchHistory.slice(0, 5);

  return (
    <div className={`relative ${className}`}>
      {/* Search input box */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            // Delay hiding suggestions so that users can click on suggestions

            setTimeout(() => setShowSuggestions(false), 150);
          }}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-12 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-gray-700 placeholder-gray-400"
        />
        
        {/* Search icon */}
        <div className="absolute left-4 top-3.5 text-gray-400">
          {isFocused || value ? (
            <span className="text-green-500">🔍</span>
          ) : (
            <span>🔍</span>
          )}
        </div>

        {/* Clear button */}
        {value && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search suggestions pull down */}
      {showSuggestions && (filteredSuggestions.length > 0 || (!value && searchHistory.length > 0)) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {/* Search for historical titles */}
          {searchHistory.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600 font-medium">
                {value ? '相关搜索' : '搜索历史'}
              </span>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              >
                清除历史
              </button>
            </div>
          )}

          {/* Suggestion list */}
          <div className="py-1">
            {(value ? filteredSuggestions : searchHistory.slice(0, 5)).map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <span className="text-gray-400 text-sm">
                  {value ? '🔍' : '🕐'}
                </span>
                <span className="text-gray-700">{suggestion}</span>
              </button>
            ))}
          </div>

          {/* Hot search tips */}
          {!value && searchHistory.length === 0 && (
            <div className="px-4 py-3 text-center text-gray-500 text-sm">
              <div className="mb-2">💡 搜索建议</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {['太阳能', '风能', '碳减排', '绿色出行', '节能'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => selectSuggestion(tag)}
                    className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 