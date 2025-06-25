'use client';

import React, { useState, useEffect } from 'react';
import { formatContractPrice } from '@/utils/formatUtils';
import { MarketSearch } from './MarketSearch';

// 筛选条件接口
export interface FilterOptions {
  searchTerm: string;
  priceRange: [number, number];
  sortBy: 'time_desc' | 'time_asc' | 'price_asc' | 'price_desc' | 'carbon_desc' | 'carbon_asc';
  minCarbonReduction?: number;
}

interface MarketFiltersProps {
  onFiltersChange: (filters: FilterOptions) => void;
  totalCount?: number;
  isLoading?: boolean;
}

/**
 * 市场筛选器组件
 * @description 功能完整的NFT市场筛选和排序组件，支持实时筛选
 */
export const MarketFilters: React.FC<MarketFiltersProps> = ({
  onFiltersChange,
  totalCount = 0,
  isLoading = false,
}) => {
  // 筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]); // 提高默认上限
  const [sortBy, setSortBy] = useState<FilterOptions['sortBy']>('time_desc');
  const [minCarbonReduction, setMinCarbonReduction] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [isPriceFilterActive, setIsPriceFilterActive] = useState(false); // 标记价格筛选是否激活

  // 检查是否有活跃的筛选条件
  useEffect(() => {
    const hasFilters = 
      searchTerm.trim() !== '' ||
      isPriceFilterActive ||
      minCarbonReduction > 0 ||
      sortBy !== 'time_desc';
    
    setHasActiveFilters(hasFilters);
  }, [searchTerm, isPriceFilterActive, minCarbonReduction, sortBy]);

  // 应用筛选条件（实时更新）
  useEffect(() => {
    const filters: FilterOptions = {
      searchTerm: searchTerm.trim(),
      priceRange: isPriceFilterActive ? priceRange : [0, Number.MAX_SAFE_INTEGER], // 只有激活时才应用价格筛选
      sortBy,
      minCarbonReduction: minCarbonReduction > 0 ? minCarbonReduction : undefined,
    };

    onFiltersChange(filters);
  }, [searchTerm, priceRange, sortBy, minCarbonReduction, isPriceFilterActive, onFiltersChange]);

  // 重置筛选条件
  const resetFilters = () => {
    setSearchTerm('');
    setPriceRange([0, 10000]);
    setSortBy('time_desc');
    setMinCarbonReduction(0);
    setIsPriceFilterActive(false); // 重置价格筛选状态
  };

  // 排序选项
  const sortOptions = [
    { value: 'time_desc', label: '🕒 最新上架', icon: '⬇️' },
    { value: 'time_asc', label: '🕰️ 最早上架', icon: '⬆️' },
    { value: 'price_asc', label: '💰 价格从低到高', icon: '📈' },
    { value: 'price_desc', label: '💸 价格从高到低', icon: '📉' },
    { value: 'carbon_desc', label: '🌱 碳减排量从高到低', icon: '🔽' },
    { value: 'carbon_asc', label: '🌿 碳减排量从低到高', icon: '🔼' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
      {/* 筛选器头部 */}
      <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <h3 className="text-lg font-semibold text-gray-800">筛选和排序</h3>
            </div>
            {totalCount > 0 && (
              <span className="px-3 py-1 bg-white/70 backdrop-blur-sm text-gray-700 rounded-full text-sm font-medium">
                {isLoading ? '加载中...' : `${totalCount} 个结果`}
              </span>
            )}
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                已应用筛选
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                🗑️ 重置
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
            >
              {isExpanded ? '⬆️ 收起' : '⬇️ 展开'}
            </button>
          </div>
        </div>
      </div>

      {/* 快速排序栏（始终显示） */}
      <div className="px-6 py-3 bg-gray-50/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600 font-medium mr-2">快速排序:</span>
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSortBy(option.value as FilterOptions['sortBy'])}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                sortBy === option.value
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200'
              }`}
            >
              <span className="mr-1">{option.icon}</span>
              {option.label.replace(/^[🕒🕰️💰💸🌱🌿]\s/, '')}
            </button>
          ))}
        </div>
      </div>

      {/* 高级筛选区域（可展开） */}
      {isExpanded && (
        <div className="px-6 py-5 border-t border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 搜索框 */}
             <div className="space-y-2">
               <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                 <span>🔍</span>
                 <span>搜索NFT</span>
               </label>
               <MarketSearch
                 value={searchTerm}
                 onChange={setSearchTerm}
                 placeholder="输入NFT标题、描述或Token ID..."
               />
             </div>

            {/* 价格范围 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>💰</span>
                <span>价格范围 (CARB)</span>
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={(e) => {
                        const value = Math.max(0, parseInt(e.target.value) || 0);
                        setPriceRange([value, priceRange[1]]);
                        setIsPriceFilterActive(value > 0 || priceRange[1] < 10000);
                      }}
                      onFocus={() => setIsPriceFilterActive(true)}
                      placeholder="最低价"
                      min="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <span className="text-gray-500 font-medium">—</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) => {
                        const value = Math.max(priceRange[0], parseInt(e.target.value) || 10000);
                        setPriceRange([priceRange[0], value]);
                        setIsPriceFilterActive(priceRange[0] > 0 || value < 10000);
                      }}
                      onFocus={() => setIsPriceFilterActive(true)}
                      placeholder="最高价"
                      min={priceRange[0]}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{formatContractPrice(priceRange[0].toString())} CARB</span>
                  <span>{priceRange[1] >= 10000 ? '不限' : `${formatContractPrice(priceRange[1].toString())} CARB`}</span>
                </div>
              </div>
            </div>

            {/* 碳减排量筛选 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>🌱</span>
                <span>最低碳减排量 (tCO₂e)</span>
              </label>
              <div className="space-y-3">
                <input
                  type="number"
                  value={minCarbonReduction}
                  onChange={(e) => setMinCarbonReduction(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="例如: 50"
                  min="0"
                  step="1"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <div className="text-xs text-gray-500">
                  筛选碳减排量 ≥ {minCarbonReduction} tCO₂e 的NFT
                </div>
              </div>
            </div>
          </div>

          {/* 预设快捷筛选 */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">⚡ 快捷筛选:</span>
            </div>
            <div className="flex flex-wrap gap-2">
                             <button
                 onClick={() => {
                   setPriceRange([0, 50]);
                   setSortBy('price_asc');
                   setIsPriceFilterActive(true);
                 }}
                 className="px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
               >
                 💎 低价优质 (≤50 CARB)
               </button>
               <button
                 onClick={() => {
                   setMinCarbonReduction(100);
                   setSortBy('carbon_desc');
                 }}
                 className="px-3 py-2 text-sm bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
               >
                 🌟 高碳减排 (≥100 tCO₂e)
               </button>
               <button
                 onClick={() => {
                   setPriceRange([100, 500]);
                   setSortBy('time_desc');
                   setIsPriceFilterActive(true);
                 }}
                 className="px-3 py-2 text-sm bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg transition-colors"
               >
                 🔥 中档新品 (100-500 CARB)
               </button>
               <button
                 onClick={() => {
                   setSortBy('price_desc');
                   setPriceRange([500, 10000]);
                   setIsPriceFilterActive(true);
                 }}
                 className="px-3 py-2 text-sm bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg transition-colors"
               >
                 👑 高端精品 (≥500 CARB)
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 