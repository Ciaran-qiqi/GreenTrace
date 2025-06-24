'use client';

import React, { useState } from 'react';
import { useMarketNFTs } from '@/hooks/market/useMarketNFTs';
import { NFTGrid } from './NFTGrid';
import { MarketStats } from './MarketStats';
// import { MarketFilters } from './MarketFilters'; // 暂时注释，后续启用

/**
 * NFT交易市场主页面组件
 * @description 市场的主要容器组件，包含统计信息、筛选功能和NFT网格展示
 */
export const NFTMarketplace: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 使用市场NFT数据Hook
  const {
    nfts,
    isLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  } = useMarketNFTs(12);

  // 处理购买成功，刷新数据
  const handleBuySuccess = () => {
    console.log('🎉 NFT购买成功，刷新市场数据');
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  // 处理刷新
  const handleRefresh = () => {
    console.log('🔄 手动刷新市场数据');
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  return (
    <div className="w-full">
      {/* 市场统计信息 */}
      <MarketStats key={`stats-${refreshKey}`} />

      {/* 市场顶部操作栏 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            🏪 NFT市场
          </h2>
          {totalCount > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              {totalCount} 个NFT在售
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 刷新按钮 */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                刷新中...
              </div>
            ) : (
              '🔄 刷新'
            )}
          </button>
        </div>
      </div>

      {/* 筛选器组件（未来扩展） */}
      {/* <MarketFilters /> */}

      {/* NFT网格展示 */}
      <NFTGrid
        nfts={nfts}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onBuySuccess={handleBuySuccess}
      />

      {/* 底部说明信息 */}
      {!error && (
        <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-200 pt-8">
          <div className="max-w-2xl mx-auto">
            <p className="mb-2">
              🌱 <strong>GreenTrace NFT市场</strong> - 发现和交易环保故事NFT
            </p>
            <p>
              所有NFT均代表真实的环保行动，使用 <span className="font-medium text-green-600">CARB</span> 代币进行交易
            </p>
          </div>
        </div>
      )}
    </div>
  );
}; 