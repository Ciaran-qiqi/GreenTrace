'use client';

import { Navbar } from '@/src/components/Navbar';

export default function NFTCenter() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">NFT中心</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-600">NFT中心内容开发中...</p>
        </div>
      </div>
    </main>
  );
} 