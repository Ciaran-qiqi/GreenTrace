'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useTranslation } from '@/hooks/useI18n';
import { formatTime } from '@/utils/timeUtils';
import { formatCarbonReduction, formatCarbonPrice } from '@/utils/formatUtils';
import { generateDefaultNFTImage } from '@/utils/nftMetadata';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';
import { BuyNFTModal } from './BuyNFTModal';
import { MarketNFTDetailModal } from './MarketNFTDetailModal';
import { getNFTTranslation, hasNFTTranslation } from '@/utils/nftTranslations';

interface NFTMarketCardProps {
  nft: MarketNFT;
  onBuySuccess?: () => void;
}

/**
 * NFT Market Card Components
 * @description Displays market information for a single NFT, including price, seller, purchase button, etc.
 * @param nft NFT data
 * @param onBuySuccess Successful purchase callback
 */
export const NFTMarketCard: React.FC<NFTMarketCardProps> = ({ 
  nft, 
  onBuySuccess 
}) => {
  const { t, language } = useTranslation();
  const { address } = useAccount();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Get translated nft content

  const translatedContent = getNFTTranslation(
    nft.tokenId, 
    language, 
    nft.storyTitle, 
    nft.storyDetail
  );
  
  // Check if there is a translation available

  const hasTranslation = hasNFTTranslation(nft.tokenId, language);

  // Determine whether it is your own nft

  const isOwnNFT = address && nft.seller.toLowerCase() === address.toLowerCase();

  // Processing the purchase successfully

  const handleBuySuccess = () => {
    setShowBuyModal(false);
    onBuySuccess?.();
  };

  // Format price display

  const formatPrice = (price: string) => {
    return formatCarbonPrice(price) + ' CARB';
  };

  // Shorten the address display

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Processing picture display logic

  const getDisplayImage = () => {
    if (imageError || !nft.imageUrl) {
      return generateDefaultNFTImage(nft.tokenId);
    }
    return nft.imageUrl;
  };

  // Image loading error handling

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100">
        {/* Nft picture/head area */}
        <div className="relative h-48 overflow-hidden">
          {/* Nft Pictures */}
          <img
            src={getDisplayImage()}
            alt={translatedContent.storyTitle}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            onError={handleImageError}
          />
          
          {/* Picture mask layer */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
          
          {/* Number of transaction badge */}
          {nft.tradeCount > 0 && (
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
              🔄 {nft.tradeCount} {t('nftMarket.card.trades')}
            </div>
          )}
          
          {/* Carbon emission reduction badge */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-green-700 shadow-sm">
            🌿 {formatCarbonReduction(nft.carbonReduction)}
          </div>

          {/* Metadata source indicator */}
          {nft.imageUrl && !imageError && (
            <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs text-white opacity-60">
              IPFS
            </div>
          )}
        </div>

        {/* Nft information area */}
        <div className="p-6">
          {/* Title and Token ID */}
          <div className="mb-3">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-800 line-clamp-2 flex-1">
                {translatedContent.storyTitle}
              </h3>
              {hasTranslation && (
                <div className="ml-2 flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <span>🌐</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {t('nftMarket.card.tokenId')}{nft.tokenId}
            </p>
          </div>

          {/* Story details preview */}
          <div className="mb-4">
            <p className="text-sm text-gray-600 line-clamp-3">
              {translatedContent.storyDetail || t('nftMarket.card.defaultStory')}
            </p>
                         {hasTranslation && (
               <div className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                 <span>🌐</span>
                 <span>{t('nftMarket.card.contentTranslated')}</span>
               </div>
             )}
          </div>

          {/* Price information */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{t('nftMarket.card.currentPrice')}</span>
              <span className="text-lg font-bold text-green-600">
                {formatPrice(nft.price)}
              </span>
            </div>
            
            {/* Price history comparison */}
            {nft.initialPrice !== nft.price && (
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{t('nftMarket.card.initialPrice')}: {formatPrice(nft.initialPrice)}</span>
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

          {/* Seller information */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{t('nftMarket.card.seller')}</span>
              <span className="text-sm font-medium text-gray-700">
                {shortenAddress(nft.seller)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{t('nftMarket.card.listingTime')}</span>
              <span className="text-xs text-gray-500">
                {formatTime(parseInt(nft.timestamp))}
              </span>
            </div>
          </div>

          {/* Operation button area */}
          <div className="flex gap-2">
            {/* View Details Button */}
            <button
              onClick={() => setShowDetailModal(true)}
              className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {t('nftMarket.card.viewDetails')}
            </button>
            
            {/* Buy button or your own nft tips */}
            {isOwnNFT ? (
              <div className="flex-1 py-2 px-4 bg-gray-100 text-gray-500 rounded-lg text-center text-sm font-medium">
                {t('nftMarket.card.ownNFT')}
              </div>
            ) : (
              <button
                onClick={() => setShowBuyModal(true)}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                💰 {t('nftMarket.card.buy')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Purchase modal box */}
      {showBuyModal && (
        <BuyNFTModal
          nft={nft}
          isOpen={showBuyModal}
          onClose={() => setShowBuyModal(false)}
          onSuccess={handleBuySuccess}
        />
      )}

      {/* Nft Details Modal Box */}
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