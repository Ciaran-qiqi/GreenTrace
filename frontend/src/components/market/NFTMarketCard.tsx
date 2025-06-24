'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { formatTime } from '@/utils/timeUtils';
import { formatCarbonReduction, formatContractPrice } from '@/utils/formatUtils';
import { generateDefaultNFTImage } from '@/utils/nftMetadata';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';
import { BuyNFTModal } from './BuyNFTModal';
import { MarketNFTDetailModal } from './MarketNFTDetailModal';

interface NFTMarketCardProps {
  nft: MarketNFT;
  onBuySuccess?: () => void;
}

/**
 * NFT市场卡片组件
 * @description 展示单个NFT的市场信息，包括价格、卖家、购买按钮等
 * @param nft NFT数据
 * @param onBuySuccess 购买成功回调
 */
export const NFTMarketCard: React.FC<NFTMarketCardProps> = ({ 
  nft, 
  onBuySuccess 
}) => {
  const { address } = useAccount();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 判断是否是自己的NFT
  const isOwnNFT = address && nft.seller.toLowerCase() === address.toLowerCase();

  // 处理购买成功
  const handleBuySuccess = () => {
    setShowBuyModal(false);
    onBuySuccess?.();
  };

  // 格式化价格显示
  const formatPrice = (price: string) => {
    return formatContractPrice(price) + ' CARB';
  };



  // 缩短地址显示
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 处理图片显示逻辑
  const getDisplayImage = () => {
    if (imageError || !nft.imageUrl) {
      return generateDefaultNFTImage(nft.tokenId);
    }
    return nft.imageUrl;
  };

  // 图片加载错误处理
  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
        {/* NFT图片/头部区域 */}
        <div className="relative h-48 overflow-hidden">
          {/* NFT图片 */}
          <img
            src={getDisplayImage()}
            alt={nft.storyTitle}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={handleImageError}
          />
          
          {/* 图片遮罩层 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
          
          {/* 交易次数徽章 */}
          {nft.tradeCount > 0 && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
              🔄 {nft.tradeCount} 次交易
            </div>
          )}
          
          {/* 碳减排量徽章 */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-green-700 shadow-sm">
            🌿 {formatCarbonReduction(nft.carbonReduction)}
          </div>

          {/* 元数据来源指示器 */}
          {nft.imageUrl && !imageError && (
            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white opacity-60">
              IPFS
            </div>
          )}
        </div>

        {/* NFT信息区域 */}
        <div className="p-6">
          {/* 标题和Token ID */}
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-2">
              {nft.storyTitle}
            </h3>
            <p className="text-sm text-gray-500">
              Token ID: #{nft.tokenId}
            </p>
          </div>

          {/* 故事详情预览 */}
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {nft.storyDetail || '这是一个关于环保行动的精彩故事...'}
          </p>

          {/* 价格信息 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">当前价格</span>
              <span className="text-lg font-bold text-green-600">
                {formatPrice(nft.price)}
              </span>
            </div>
            
            {/* 价格历史对比 */}
            {nft.initialPrice !== nft.price && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>初始价格: {formatPrice(nft.initialPrice)}</span>
                <span className={
                  BigInt(nft.price) > BigInt(nft.initialPrice) 
                    ? 'text-red-500' 
                    : 'text-green-500'
                }>
                  {BigInt(nft.price) > BigInt(nft.initialPrice) ? '↑' : '↓'}
                  {(
                    (Number(BigInt(nft.price) - BigInt(nft.initialPrice)) / Number(BigInt(nft.initialPrice))) * 100
                  ).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* 卖家信息 */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">卖家</span>
              <span className="text-sm font-medium text-gray-700">
                {shortenAddress(nft.seller)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">挂单时间</span>
              <span className="text-xs text-gray-500">
                {formatTime(parseInt(nft.timestamp))}
              </span>
            </div>
          </div>

          {/* 操作按钮区域 */}
          <div className="flex gap-2">
            {/* 查看详情按钮 */}
            <button
              onClick={() => setShowDetailModal(true)}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              查看详情
            </button>
            
            {/* 购买按钮或自己的NFT提示 */}
            {isOwnNFT ? (
              <div className="flex-1 py-2 px-4 bg-gray-100 text-gray-500 rounded-lg text-center text-sm font-medium">
                自己的NFT
              </div>
            ) : (
              <button
                onClick={() => setShowBuyModal(true)}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                💰 购买
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 购买模态框 */}
      {showBuyModal && (
        <BuyNFTModal
          nft={nft}
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
          onSuccess={handleBuySuccess}
        />
      )}

      {/* NFT详情模态框 */}
      {showDetailModal && (
        <MarketNFTDetailModal
          nft={nft}
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </>
  );
}; 