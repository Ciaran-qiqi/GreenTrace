'use client';

import { Navigation } from '@/components/Navigation';
import { NFTMarketplace } from '@/components/market/NFTMarketplace';
import { useTranslation } from '@/hooks/useI18n';

/**
 * NFT交易市场页面
 * @description 提供NFT的展示、搜索、购买等功能
 */
export default function MarketPage() {
  const { t } = useTranslation();

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* 页面标题区域 */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                🏪 {t('nftMarket.title')}
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('nftMarket.subtitle')}
              </p>
            </div>

            {/* NFT市场主体组件 */}
            <NFTMarketplace />
          </div>
        </div>
      </main>
    </>
  );
} 