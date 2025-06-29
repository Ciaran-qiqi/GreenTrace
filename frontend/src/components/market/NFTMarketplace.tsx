'use client';

import React, { useState } from 'react';
import { useMarketNFTs } from '@/hooks/market/useMarketNFTs';
import { useTranslation } from '@/hooks/useI18n';
import { NFTGrid } from './NFTGrid';
import { MarketStats } from './MarketStats';
import { MarketFilters, FilterOptions } from './MarketFilters';
import { formatCarbonReduction, formatContractPrice } from '@/utils/formatUtils';

/**
 * NFT Trading Market Main Page Component
 * @description The main container components of the market, including statistics, filtering functions and NFT grid display
 */
export const NFTMarketplace: React.FC = () => {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    searchTerm: '',
    priceRange: [0, Number.MAX_SAFE_INTEGER], // No price limits by default

    sortBy: 'time_desc',
  });
  
  // Use market nft data hook

  const {
    nfts: rawNfts,
    isLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  } = useMarketNFTs(12);

  // Apply filtering and sorting logic

  const filteredAndSortedNfts = React.useMemo(() => {
    if (!rawNfts || !Array.isArray(rawNfts)) return [];
    
    let filtered = [...rawNfts];

    // Search Filter

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(nft => 
        nft.storyTitle?.toLowerCase().includes(searchLower) ||
        nft.storyDetail?.toLowerCase().includes(searchLower) ||
        nft.tokenId?.includes(filters.searchTerm)
      );
    }

    // Price range filter (only filter if a meaningful price range is set)

    if (filters.priceRange && filters.priceRange[1] < Number.MAX_SAFE_INTEGER) {
      const [minPrice, maxPrice] = filters.priceRange;
      filtered = filtered.filter(nft => {
        const price = parseFloat(formatContractPrice(nft.price || '0'));
        return price >= minPrice && price <= maxPrice;
      });
    }

    // Carbon emission reduction screening

    if (filters.minCarbonReduction && filters.minCarbonReduction > 0) {
      filtered = filtered.filter(nft => {
        const carbonReduction = parseFloat(formatCarbonReduction(nft.carbonReduction || '0'));
        return carbonReduction >= (filters.minCarbonReduction || 0);
      });
    }

    // Sort

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

  // Processing the purchase successfully, refreshing the data

  const handleBuySuccess = () => {
    console.log('🎉 NFT购买成功，刷新市场数据');
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  // Process refresh

  const handleRefresh = () => {
    console.log('🔄 手动刷新市场数据');
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  return (
    <div className="w-full">
      {/* Market statistics information */}
      <MarketStats key={`stats-${refreshKey}`} />

      {/* Market top operation bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">
            🏪 {t('nftMarket.marketplace')}
          </h2>
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {t('nftMarket.total')} {totalCount} {t('nftMarket.nftsForSale')}
              </span>
              {filteredCount !== totalCount && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {t('nftMarket.filteredResults')} {filteredCount} {t('nftMarket.results')}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                {t('nftMarket.refreshing')}
              </div>
            ) : (
              `🔄 ${t('nftMarket.refresh')}`
            )}
          </button>
        </div>
      </div>

      {/* Filter Components */}
      <MarketFilters 
        onFiltersChange={setFilters} 
        totalCount={filteredCount}
        isLoading={isLoading}
      />

      {/* Nft grid display */}
      <NFTGrid
        nfts={filteredAndSortedNfts}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onBuySuccess={handleBuySuccess}
      />

      {/* Tips when the filter result is empty */}
      {!isLoading && !error && filteredAndSortedNfts.length === 0 && totalCount > 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-400 text-4xl mb-4">🔍</div>
          <div className="text-gray-600 text-lg mb-2">{t('nftMarket.noNFTsFound')}</div>
          <div className="text-gray-500 text-sm mb-4">
            {t('nftMarket.adjustFilters')}{' '}
            <button 
                           onClick={() => setFilters({
               searchTerm: '',
               priceRange: [0, Number.MAX_SAFE_INTEGER],
               sortBy: 'time_desc',
             })}
              className="text-green-600 hover:text-green-700 underline"
            >
              {t('nftMarket.resetFilters')}
            </button>
          </div>
        </div>
      )}

      {/* Bottom description information */}
      {!error && (
        <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-200 pt-8">
          <div className="max-w-2xl mx-auto">
            <p className="mb-2">
              🌱 <strong>{t('nftMarket.platformName')}</strong> - {t('nftMarket.platformSubtitle')}
            </p>
            <p>
              {t('nftMarket.description')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}; 