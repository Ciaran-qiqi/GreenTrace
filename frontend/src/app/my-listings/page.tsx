'use client';

import { Navigation } from '@/components/Navigation';
import { MyListings } from '@/components/market/MyListings';
import { useTranslation } from '@/hooks/useI18n';

/**
 * 我的挂单页面
 * @description 用户管理自己的NFT挂单的页面
 */
export default function MyListingsPage() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">{t('myListings.title', '我的挂单')}</h1>
            <p className="text-lg text-gray-600">{t('myListings.subtitle', '管理您在市场上的NFT挂单')}</p>
          </div>
          <MyListings />
        </div>
      </main>
    </div>
  );
} 