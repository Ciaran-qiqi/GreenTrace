'use client';

import React from 'react';
import { useMarketStats } from '@/hooks/market/useMarketStats';

/**
 * 市场统计信息展示组件
 * @description 展示市场的关键统计数据，包括实时计算的交易额和价格统计
 */
export const MarketStats: React.FC = () => {
  const { stats, isLoading, error } = useMarketStats();

  // 加载状态
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <div className="text-red-600 text-sm">
          ⚠️ 无法加载市场统计数据
        </div>
      </div>
    );
  }

  // 统计数据不存在
  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {/* 总挂单数 */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
        <div className="flex items-center">
          <div className="text-2xl mr-3">🏪</div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalListings.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">在售NFT</div>
          </div>
        </div>
      </div>

      {/* 活跃卖家 */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
        <div className="flex items-center">
          <div className="text-2xl mr-3">👤</div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalUsers.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">活跃卖家</div>
          </div>
        </div>
      </div>

      {/* 总交易额 */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow" title="已完成交易的NFT总价值">
        <div className="flex items-center">
          <div className="text-2xl mr-3">💰</div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {(() => {
                const volume = Number(stats.totalVolume) / 1e18;
                return volume > 0 ? volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0';
              })()}
            </div>
            <div className="text-sm text-gray-600">
              总交易额 CARB
              {Number(stats.totalVolume) === 0 && (
                <div className="text-xs text-gray-400 mt-1">暂无交易记录</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 平均价格 */}
      <div className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow" title="当前在售NFT的平均价格">
        <div className="flex items-center">
          <div className="text-2xl mr-3">📊</div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {(() => {
                const price = Number(stats.averagePrice) / 1e18;
                return price > 0 ? price.toFixed(1) : '0';
              })()}
            </div>
            <div className="text-sm text-gray-600">
              平均价格 CARB
              {Number(stats.averagePrice) === 0 && (
                <div className="text-xs text-gray-400 mt-1">基于在售NFT计算</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 