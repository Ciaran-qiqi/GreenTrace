import React from 'react';
import Link from 'next/link';
import { Navigation } from '@/src/components/Navigation';
import { Auth } from '@/src/components/Auth';

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-gray-800 mb-4">
                记录绿色足迹，创造可持续未来
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                通过区块链技术记录您的环保行为，将绿色行动转化为有价值的NFT资产
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="text-3xl mb-4">🌱</div>
                <h3 className="text-xl font-semibold mb-2">创建绿色NFT</h3>
                <p className="text-gray-600 mb-4">记录您的环保行为，创建独特的绿色NFT</p>
                <Link 
                  href="/create"
                  className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  立即创建
                </Link>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2">专业审计</h3>
                <p className="text-gray-600">专业审计员验证您的绿色行为真实性</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="text-3xl mb-4">🔄</div>
                <h3 className="text-xl font-semibold mb-2">碳代币兑换</h3>
                <p className="text-gray-600">将审核通过的NFT兑换为有价值的碳代币</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-4 text-center">
                开始您的绿色之旅
              </h3>
              <Auth />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
