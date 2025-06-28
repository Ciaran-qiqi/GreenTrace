'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { TradeHistoryTable } from './TradeHistoryTable';

interface SalesHistoryProps {
  className?: string;
}

/**
 * 销售历史组件
 * @description 显示当前用户的NFT销售历史记录
 * @param className 样式类名
 */
export const SalesHistory: React.FC<SalesHistoryProps> = ({
  className = ''
}) => {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-4xl mb-4">🔐</div>
        <div className="text-gray-600 text-lg mb-2">请连接钱包</div>
        <div className="text-gray-500 text-sm">连接钱包后查看您的销售历史</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部说明 */}
      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start">
          <div className="text-green-500 text-2xl mr-3">💰</div>
          <div>
            <div className="text-green-800 font-medium mb-1">
              销售历史记录
            </div>
            <div className="text-green-700 text-sm">
              这里显示您销售的所有NFT记录，包括成交价格、时间和买家信息。
            </div>
          </div>
        </div>
      </div>

      {/* 销售统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">总销售额</div>
              <div className="text-2xl font-bold text-green-600">-- CARB</div>
            </div>
            <div className="text-green-500 text-2xl">💵</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">已售NFT</div>
              <div className="text-2xl font-bold text-blue-600">-- 个</div>
            </div>
            <div className="text-blue-500 text-2xl">🎨</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500 mb-1">平均售价</div>
              <div className="text-2xl font-bold text-purple-600">-- CARB</div>
            </div>
            <div className="text-purple-500 text-2xl">📊</div>
          </div>
        </div>
      </div>

      {/* 使用TradeHistoryTable组件，筛选当前用户作为卖家的记录 */}
      <TradeHistoryTable
        userAddress={address}
        limit={100}
        className="sales-history"
      />
    </div>
  );
}; 