import React from 'react';
import { Navigation } from '@/src/components/Navigation';
import { CreateNFT } from '@/src/components/CreateNFT';

export default function CreatePage() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                🌱 创建绿色NFT
              </h1>
              <p className="text-lg text-gray-600">
                记录您的绿色行为，铸造专属的环保NFT，为地球贡献一份力量
              </p>
            </div>
            <CreateNFT />
          </div>
        </div>
      </main>
    </>
  );
} 