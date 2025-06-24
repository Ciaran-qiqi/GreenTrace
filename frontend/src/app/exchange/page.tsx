'use client';

import React from 'react';
import { Navigation } from '@/components/Navigation';
import { NFTExchangeCenter } from '@/components/NFTExchangeCenter';

// NFT兑换页面 - 用户申请将NFT兑换为碳币
export default function ExchangePage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-green-50/20 py-8">
        <div className="container mx-auto px-4">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
              NFT兑换中心
            </h1>
            <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
              将您的绿色NFT兑换为CARB代币，变现您的环保价值贡献
            </p>
            
            {/* 流程说明 */}
            <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-xl p-6 border border-blue-100 max-w-4xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">🔄 兑换流程</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg p-4 border border-blue-200">
                  <div className="text-blue-600 text-2xl mb-2">1️⃣</div>
                  <div className="font-medium text-blue-800 mb-1">提交申请</div>
                  <div className="text-blue-600">选择要兑换的NFT并支付申请手续费</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg p-4 border border-purple-200">
                  <div className="text-purple-600 text-2xl mb-2">2️⃣</div>
                  <div className="font-medium text-purple-800 mb-1">等待审计</div>
                  <div className="text-purple-600">审计员评估NFT价值并确定兑换金额</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg p-4 border border-green-200">
                  <div className="text-green-600 text-2xl mb-2">3️⃣</div>
                  <div className="font-medium text-green-800 mb-1">完成兑换</div>
                  <div className="text-green-600">NFT销毁，获得相应的CARB代币</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* NFT兑换中心组件 */}
          <NFTExchangeCenter />
        </div>
      </div>
    </>
  );
} 