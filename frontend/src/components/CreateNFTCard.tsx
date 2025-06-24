'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

// 创建NFT申请卡片组件
export const CreateNFTCard: React.FC<{ onShowForm: () => void }> = ({ onShowForm }) => {
  const { isConnected } = useAccount();
  const [isHovered, setIsHovered] = useState(false);

  if (!isConnected) {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
        <div className="text-4xl mb-4">🔗</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">请先连接钱包</h3>
        <p className="text-gray-500">连接钱包后开始创建您的绿色NFT</p>
      </div>
    );
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300 ${
        isHovered
          ? 'border-green-400 bg-green-50 shadow-lg scale-105'
          : 'border-green-300 bg-green-50 hover:border-green-400 hover:bg-green-100'
      }`}
      onClick={onShowForm}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`text-6xl mb-4 transition-transform duration-300 ${
        isHovered ? 'scale-110' : ''
      }`}>
        🌱
      </div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">
        创建新的绿色NFT
      </h3>
      <p className="text-gray-600 mb-4">
        记录您的环保行为，创建独特的绿色故事NFT
      </p>
      
      {/* 创建流程说明 */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
        <div className="text-center">
          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
            1
          </div>
          <div className="text-gray-600">填写信息</div>
        </div>
        <div className="text-center">
          <div className="w-8 h-8 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
            2
          </div>
          <div className="text-gray-600">等待审计</div>
        </div>
        <div className="text-center">
          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">
            3
          </div>
          <div className="text-gray-600">铸造NFT</div>
        </div>
      </div>

      <button className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors shadow-md">
        🚀 开始创建
      </button>
      
      <div className="mt-4 text-xs text-gray-500">
        需要支付少量碳代币作为申请费用
      </div>
    </div>
  );
}; 