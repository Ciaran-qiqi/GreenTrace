'use client';

import React from 'react';
import { Navigation } from '@/components/Navigation';
import { NFTExchangeCenter } from '@/components/NFTExchangeCenter';
import { useTranslation } from '@/hooks/useI18n';

/**
 * NFT redemption page
 * @description Provides application and management functions for NFT exchange to carbon coins
 */
export default function ExchangePage() {
  const { t } = useTranslation();

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Page title area */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                🔄 {t('exchange.title', 'NFT兑换中心')}
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('exchange.subtitle', '将审核通过的NFT兑换为有价值的碳代币，参与碳信用交易，实现环保价值变现')}
              </p>
            </div>

            {/* Main redemption area */}
            <NFTExchangeCenter />
          </div>
        </div>
      </main>
    </>
  );
} 