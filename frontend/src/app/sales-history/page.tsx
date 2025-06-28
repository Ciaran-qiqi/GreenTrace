'use client';

import React from 'react';
import { SalesHistory } from '@/components/market/SalesHistory';

/**
 * 销售历史页面
 * @description 展示用户的NFT销售历史记录
 */
export default function SalesHistoryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📊</span>
          <h1 className="text-3xl font-bold text-gray-800">销售历史</h1>
        </div>
        <p className="text-gray-600 text-lg">
          查看您在 GreenTrace NFT 市场的所有销售记录和统计信息
        </p>
      </div>

      {/* 销售历史组件 */}
      <SalesHistory />
    </div>
  );
} 