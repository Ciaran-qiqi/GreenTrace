'use client';

import React from 'react';
import { Navigation } from '@/components/Navigation';
import CarbonMarket from '@/components/CarbonMarket';
import { useTranslation } from '@/hooks/useI18n';

/**
 * Carbon Coin Market Page
 * Provides complete carbon currency trading capabilities, including market orders and limit orders
 */
export default function CarbonMarketPage() {
  const { t } = useTranslation();

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Page title area */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                {t('carbon.page.title', '💰 碳币交易市场')}
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                {t('carbon.page.subtitle', '专业的碳币交易平台，支持市价单和限价单交易，享受智能撮合和价格保护')}
              </p>
            </div>

            {/* Carbon market entity components */}
            <CarbonMarket />
          </div>
        </div>
      </main>
    </>
  );
} 