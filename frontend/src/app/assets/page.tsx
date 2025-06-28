'use client';

import { Navigation } from '@/components/Navigation';
import { MyAssets } from '@/components/MyAssets';
import { useTranslation } from '@/hooks/useI18n';

export default function AssetsPage() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">{t('assets.title', '我的资产')}</h1>
            <p className="text-lg text-gray-600">{t('assets.subtitle', '查看您的CARB代币余额和NFT收藏')}</p>
          </div>
          <MyAssets />
        </div>
      </main>
    </div>
  );
} 