'use client';

import React, { useState } from 'react';

interface MarketFiltersProps {
  onFiltersChange?: (filters: any) => void;
}

/**
 * 市场筛选器组件
 * @description NFT市场的筛选和排序功能（暂时简单实现，未来可扩展）
 * @param onFiltersChange 筛选条件变化回调
 */
export const MarketFilters: React.FC<MarketFiltersProps> = ({
  onFiltersChange,
}) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'time_asc' | 'time_desc'>('time_desc');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">筛选和排序</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 搜索框 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">搜索NFT</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="输入NFT标题或描述..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* 价格范围 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">价格范围 (CARB)</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={priceRange[0]}
              onChange={(e) => setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])}
              placeholder="最低价"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <span className="text-gray-500">-</span>
            <input
              type="number"
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value) || 1000])}
              placeholder="最高价"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 排序方式 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">排序方式</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="time_desc">最新上架</option>
            <option value="time_asc">最早上架</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
          </select>
        </div>
      </div>

      {/* 应用筛选按钮 */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onFiltersChange?.({ priceRange, sortBy, searchTerm })}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          应用筛选
        </button>
      </div>
    </div>
  );
}; 