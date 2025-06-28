'use client';

import React from 'react';
import { useMarketStats } from '@/hooks/market/useMarketStats';
import { useMarketNFTs } from '@/hooks/market/useMarketNFTs';
import { useTranslation } from '@/hooks/useI18n';
import { formatCarbonPrice } from '@/utils/formatUtils';

/**
 * 市场统计信息展示组件
 * @description 展示市场的关键统计数据，包括实时计算的交易额和价格统计
 */
export const MarketStats: React.FC = () => {
  const { t } = useTranslation();
  const { stats, isLoading, error } = useMarketStats();
  
  // 直接获取NFT数据进行验证计算
  const { nfts } = useMarketNFTs(100);
  
  // 手动验证平均价格计算
  const verifyAveragePrice = () => {
    if (!nfts || nfts.length === 0) return '0';
    
    console.log('🔎 手动验证平均价格计算');
    console.log('📝 NFT数量:', nfts.length);
    
    const prices = nfts.map(nft => {
      const rawPrice = nft.price || '0';
      const formattedPrice = formatCarbonPrice(rawPrice);
      // 解析时先移除逗号分隔符，避免parseFloat只解析到逗号前
      const numPrice = parseFloat(formattedPrice.replace(/,/g, ''));
      
      console.log(`📊 NFT #${nft.tokenId}: ${rawPrice} -> ${formattedPrice} -> ${numPrice} (修复前: ${parseFloat(formattedPrice)})`);
      return numPrice;
    });
    
    const total = prices.reduce((sum, price) => sum + price, 0);
    const average = total / prices.length;
    
    console.log('🧮 手动计算结果:', {
      prices,
      total,
      average,
      expectedFormula: `(${prices.join(' + ')}) / ${prices.length} = ${average}`
    });
    
    return average;
  };

  // 在开发环境下验证
  React.useEffect(() => {
    if (nfts && nfts.length > 0) {
      const manualAverage = verifyAveragePrice();
      const hookAverage = stats ? parseFloat(stats.averagePrice) : 0;
      
      console.log('🔍 平均价格对比:', {
        手动计算: manualAverage,
        Hook计算: hookAverage,
        差异: Math.abs(manualAverage - hookAverage),
        NFT数量: nfts.length
      });
    }
  }, [nfts, stats]);

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
          ⚠️ {t('nftMarket.stats.loadingError')}
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
            <div className="text-sm text-gray-600">{t('nftMarket.stats.totalListings')}</div>
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
            <div className="text-sm text-gray-600">{t('nftMarket.stats.activeSellers')}</div>
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
                const volume = Number(stats.totalVolume);
                if (volume === 0) return '0';
                if (volume < 1000) return volume.toFixed(0);
                if (volume < 1000000) return `${(volume / 1000).toFixed(1)}K`;
                if (volume < 1000000000) return `${(volume / 1000000).toFixed(1)}M`;
                return `${(volume / 1000000000).toFixed(1)}B`;
              })()}
            </div>
            <div className="text-sm text-gray-600">
              {t('nftMarket.stats.totalVolume')}
              {Number(stats.totalVolume) === 0 && (
                <div className="text-xs text-gray-400 mt-1">{t('nftMarket.stats.noTrades')}</div>
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
                const price = Number(stats.averagePrice);
                if (price === 0) return '0';
                if (price < 1000) return price.toFixed(1);
                return price.toLocaleString();
              })()}
            </div>
            <div className="text-sm text-gray-600">
              {t('nftMarket.stats.averagePrice')}
              {Number(stats.averagePrice) === 0 && (
                <div className="text-xs text-gray-400 mt-1">{t('nftMarket.stats.basedOnListings')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 