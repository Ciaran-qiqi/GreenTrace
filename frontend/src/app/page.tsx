'use client';

import Link from 'next/link';
import { Navbar } from '@/src/components/Navbar';
import { CarbonPriceCard } from '@/src/components/CarbonPriceCard';

// 主页内容组件
const HomeContent = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 英雄区域 */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          欢迎来到 GreenTrace
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          通过区块链技术，为环保事业贡献力量。在这里，您的每一个环保行为都将被记录和奖励。
        </p>
      </div>

      {/* 碳价指数卡片 */}
      <div className="mb-12">
        <CarbonPriceCard />
      </div>

      {/* 特色区域 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 碳币市场卡片 */}
        <Link href="/carbon-market" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">碳币市场</h3>
            <p className="text-gray-600">
              交易环保碳币，支持可持续发展项目，获得环保收益。
            </p>
          </div>
        </Link>

        {/* NFT中心卡片 */}
        <Link href="/nft-center" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">NFT中心</h3>
            <p className="text-gray-600">
              探索独特的环保NFT艺术品，收藏具有环保价值的数字资产。
            </p>
          </div>
        </Link>

        {/* NFT交易卡片 */}
        <Link href="/nft-trading" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">NFT交易</h3>
            <p className="text-gray-600">
              安全、便捷的NFT交易平台，支持环保项目的数字资产流通。
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};

// 主页组件
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <HomeContent />
    </main>
  );
} 