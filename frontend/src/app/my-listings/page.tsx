'use client';

import { Navigation } from '@/components/Navigation';
import { MyListings } from '@/components/market/MyListings';

/**
 * 我的挂单页面
 * @description 用户管理自己的NFT挂单的页面
 */
export default function MyListingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <MyListings />
        </div>
      </main>
    </div>
  );
} 