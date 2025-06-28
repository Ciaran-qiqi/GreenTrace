'use client';

import React, { useState } from 'react';
import { useMarketNFTs } from '@/hooks/market/useMarketNFTs';
import { NFTGrid } from './NFTGrid';
import { MarketStats } from './MarketStats';
import { MarketFilters, FilterOptions } from './MarketFilters';
import { formatCarbonReduction, formatContractPrice } from '@/utils/formatUtils';

/**
 * NFT交易市场主页面组件
 * @description 市场的主要容器组件，包含统计信息、筛选功能和NFT网格展示
 */
export const NFTMarketplace: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    priceRange: [0, Number.MAX_SAFE_INTEGER], // 默认不限制价格
    sortBy: 'time_desc',
  });
  
  // 使用市场NFT数据Hook
  const {
    nfts: rawNfts,
    isLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  } = useMarketNFTs(12);

  // 应用筛选和排序逻辑
  const filteredAndSortedNfts = React.useMemo(() => {
    if (!rawNfts || !Array.isArray(rawNfts)) return [];
    
    let filtered = [...rawNfts];

    // 搜索筛选
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(nft => 
        nft.storyTitle?.toLowerCase().includes(searchLower) ||
        nft.storyDetail?.toLowerCase().includes(searchLower) ||
        nft.tokenId?.includes(filters.searchTerm)
      );
    }

    // 价格范围筛选（只有当设置了有意义的价格范围时才筛选）
    if (filters.priceRange && filters.priceRange[1] < Number.MAX_SAFE_INTEGER) {
      const [minPrice, maxPrice] = filters.priceRange;
      filtered = filtered.filter(nft => {
        const price = parseFloat(formatContractPrice(nft.price || '0'));
        return price >= minPrice && price <= maxPrice;
      });
    }

    // 碳减排量筛选
    if (filters.minCarbonReduction && filters.minCarbonReduction > 0) {
      filtered = filtered.filter(nft => {
        const carbonReduction = parseFloat(formatCarbonReduction(nft.carbonReduction || '0'));
        return carbonReduction >= (filters.minCarbonReduction || 0);
      });
    }

    // 排序
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price_asc':
          return parseFloat(formatContractPrice(a.price || '0')) - parseFloat(formatContractPrice(b.price || '0'));
        case 'price_desc':
          return parseFloat(formatContractPrice(b.price || '0')) - parseFloat(formatContractPrice(a.price || '0'));
        case 'time_asc':
          return parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0');
        case 'time_desc':
          return parseInt(b.timestamp || '0') - parseInt(a.timestamp || '0');
        case 'carbon_asc':
          return parseFloat(formatCarbonReduction(a.carbonReduction || '0')) - parseFloat(formatCarbonReduction(b.carbonReduction || '0'));
        case 'carbon_desc':
          return parseFloat(formatCarbonReduction(b.carbonReduction || '0')) - parseFloat(formatCarbonReduction(a.carbonReduction || '0'));
        default:
          return parseInt(b.timestamp || '0') - parseInt(a.timestamp || '0');
      }
    });

    return filtered;
  }, [rawNfts, filters]);

  const filteredCount = filteredAndSortedNfts.length;

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
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                总计 {totalCount} 个NFT在售
              </span>
              {filteredCount !== totalCount && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  筛选后 {filteredCount} 个结果
                </span>
              )}
            </div>
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

      {/* 筛选器组件 */}
      <MarketFilters 
        onFiltersChange={setFilters} 
        totalCount={filteredCount}
        isLoading={isLoading}
      />

      {/* NFT网格展示 */}
      <NFTGrid
        nfts={filteredAndSortedNfts}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onBuySuccess={handleBuySuccess}
      />

      {/* 筛选结果为空时的提示 */}
      {!isLoading && !error && filteredAndSortedNfts.length === 0 && totalCount > 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <div className="text-gray-600 text-lg mb-2">没有找到符合条件的NFT</div>
          <div className="text-gray-500 text-sm mb-4">
            尝试调整筛选条件或{' '}
            <button 
                           onClick={() => setFilters({
               searchTerm: '',
               priceRange: [0, Number.MAX_SAFE_INTEGER],
               sortBy: 'time_desc',
             })}
              className="text-green-600 hover:text-green-700 underline"
            >
              重置筛选
            </button>
          </div>
        </div>
      )}

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