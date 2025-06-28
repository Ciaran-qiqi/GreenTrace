'use client';

import React from 'react';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';
import { useTranslation } from '@/hooks/useI18n';
import { NFTMarketCard } from './NFTMarketCard';

interface NFTGridProps {
  nfts: MarketNFT[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onBuySuccess?: () => void;
}

/**
 * NFT网格展示组件
 * @description 以网格形式展示NFT列表，支持加载更多和错误处理
 * @param nfts NFT数组
 * @param isLoading 是否正在加载
 * @param error 错误信息
 * @param hasMore 是否还有更多数据
 * @param onLoadMore 加载更多回调
 * @param onBuySuccess 购买成功回调
 */
export const NFTGrid: React.FC<NFTGridProps> = ({
  nfts,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  onBuySuccess,
}) => {
  const { t } = useTranslation();

  // 加载骨架屏组件
  const LoadingSkeleton = () => (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 animate-pulse">
      {/* 头部骨架 */}
      <div className="h-48 bg-gray-200"></div>
      
      {/* 内容骨架 */}
      <div className="p-6">
        {/* 标题骨架 */}
        <div className="h-6 bg-gray-200 rounded mb-3"></div>
        <div className="h-4 bg-gray-200 rounded mb-4 w-2/3"></div>
        
        {/* 描述骨架 */}
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-4/5"></div>
          <div className="h-3 bg-gray-200 rounded w-3/5"></div>
        </div>
        
        {/* 价格骨架 */}
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        
        {/* 卖家信息骨架 */}
        <div className="h-16 bg-gray-100 rounded mb-4"></div>
        
        {/* 按钮骨架 */}
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  // 空状态组件
  const EmptyState = () => (
    <div className="col-span-full text-center py-16">
      <div className="text-6xl mb-4">🏪</div>
      <h3 className="text-xl font-semibold text-gray-700 mb-2">
        {t('nftMarket.grid.empty.title')}
      </h3>
      <p className="text-gray-500 max-w-md mx-auto">
        {t('nftMarket.grid.empty.description')}
        <span className="text-green-600 font-medium cursor-pointer hover:underline ml-1">
          {t('nftMarket.grid.empty.createLink')}
        </span>
      </p>
    </div>
  );

  // 错误状态组件
  const ErrorState = () => (
    <div className="col-span-full text-center py-16">
      <div className="text-6xl mb-4">❌</div>
      <h3 className="text-xl font-semibold text-gray-700 mb-2">
        {t('nftMarket.grid.error.title')}
      </h3>
      <p className="text-gray-500 mb-4 max-w-md mx-auto">
        {error || t('nftMarket.grid.error.description')}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        {t('nftMarket.grid.error.reload')}
      </button>
    </div>
  );

  return (
    <div className="w-full">
      {/* NFT网格容器 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* 显示错误状态 */}
        {error && !isLoading && nfts.length === 0 && <ErrorState />}
        
        {/* 显示空状态 */}
        {!error && !isLoading && nfts.length === 0 && <EmptyState />}
        
        {/* 显示NFT卡片 */}
        {nfts.map((nft) => (
          <NFTMarketCard
            key={`${nft.tokenId}-${nft.timestamp}`}
            nft={nft}
            onBuySuccess={onBuySuccess}
          />
        ))}
        
        {/* 显示加载骨架屏 */}
        {isLoading && (
          <>
            {Array.from({ length: nfts.length === 0 ? 8 : 4 }).map((_, index) => (
              <LoadingSkeleton key={`skeleton-${index}`} />
            ))}
          </>
        )}
      </div>

      {/* 加载更多按钮区域 */}
      <div className="mt-12 text-center">
        {/* 加载更多按钮 */}
        {hasMore && !isLoading && nfts.length > 0 && (
          <button
            onClick={onLoadMore}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            {t('nftMarket.grid.loadMore')}
          </button>
        )}
        
        {/* 正在加载更多的提示 */}
        {isLoading && nfts.length > 0 && (
          <div className="flex items-center justify-center text-gray-500">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mr-2"></div>
            {t('nftMarket.grid.loadingMore')}
          </div>
        )}
        
        {/* 没有更多数据的提示 */}
        {!hasMore && nfts.length > 0 && !error && (
          <div className="text-gray-500 py-4">
            <div className="text-sm">
              {t('nftMarket.grid.allLoaded')} {nfts.length} 个NFT
            </div>
            <div className="text-xs mt-1 text-gray-400">
              {t('nftMarket.grid.noMoreData')}
            </div>
          </div>
        )}
      </div>

      {/* 数据统计信息 */}
      {nfts.length > 0 && !error && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-center text-sm text-gray-500">
            {t('nftMarket.grid.showing')} <span className="font-medium text-gray-700">{nfts.length}</span> 个NFT
            {hasMore && (
              <span className="ml-2">
                · {t('nftMarket.grid.moreToLoad')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 