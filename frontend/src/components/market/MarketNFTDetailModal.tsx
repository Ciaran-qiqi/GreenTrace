'use client';

import React, { useState } from 'react';
import { formatCarbonPrice, formatCarbonReduction, formatContractTimestamp } from '@/utils/formatUtils';
import { generateDefaultNFTImage } from '@/utils/nftMetadata';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';
import { useTranslation } from '@/hooks/useI18n';
import { getNFTTranslation, hasNFTTranslation } from '@/utils/nftTranslations';

interface MarketNFTDetailModalProps {
  nft: MarketNFT | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Market NFT details modal box components
 * @description Specially used to showcase the details of NFTs in the market
 * @param nft NFT data
 * @param isOpen Whether to open
 * @param onClose Close callback
 */
export const MarketNFTDetailModal: React.FC<MarketNFTDetailModalProps> = ({
  nft,
  isOpen,
  onClose
}) => {
  const { t, language } = useTranslation();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  if (!isOpen || !nft) return null;

  // Get translated nft content

  const translatedContent = getNFTTranslation(
    nft.tokenId, 
    language, 
    nft.storyTitle, 
    nft.storyDetail
  );
  
  // Check if there is a translation available

  const hasTranslation = hasNFTTranslation(nft.tokenId, language);

  // Shorten the address display

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate price changes

  const getPriceChange = () => {
    if (nft.price === nft.initialPrice) return null;
    
    const current = BigInt(nft.price);
    const initial = BigInt(nft.initialPrice);
    const diff = current - initial;
    const percentage = (Number(diff) / Number(initial)) * 100;
    
    return {
      isIncrease: diff > BigInt(0),
      percentage: Math.abs(percentage).toFixed(1)
    };
  };

  const priceChange = getPriceChange();

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
    setImageLoading(false);
  };

  // Image loading is completed

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/50 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-2xl border border-gray-200/50 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Decorative top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
        
        {/* Nft image area */}
        <div className="relative h-64 overflow-hidden">
          {/* Loading status */}
          {imageLoading && (
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
              <div className="text-white opacity-70">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full"></div>
              </div>
            </div>
          )}
          
          {/* Nft Pictures */}
          <img
            src={getDisplayImage()}
            alt={translatedContent.storyTitle}
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            style={{ display: imageLoading ? 'none' : 'block' }}
          />
          
          {/* Picture mask layer */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
          
          {/* Carbon emission reduction badge */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
            <div className="text-sm font-medium text-green-700 flex items-center">
              🌿 {formatCarbonReduction(nft.carbonReduction)}
            </div>
          </div>
          
          {/* Number of transaction badge */}
          {nft.tradeCount > 0 && (
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
              <div className="text-sm font-medium text-gray-700 flex items-center">
                🔄 {nft.tradeCount}{t('nftMarket.detail.trades')}
              </div>
            </div>
          )}

          {/* Metadata source indicator */}
          {nft.imageUrl && !imageError && (
            <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
              IPFS
            </div>
          )}
        </div>
        
        {/* Pop-up window head */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-gray-50/80 to-white/80 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🎨</span>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {t('nftMarket.detail.title')}
            </h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              #{nft.tokenId}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Pop-up content */}
        <div className="overflow-y-auto max-h-[calc(90vh-300px)]">
          <div className="p-6 space-y-6 bg-gradient-to-br from-white/90 via-gray-50/50 to-white/90">
            
            {/* Nft basic information */}
            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-xl p-5 border border-gray-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">📋</span>
                </span>
                {t('nftMarket.detail.basicInfo')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm font-medium">{t('nftMarket.detail.storyTitle')}</span>
                    {hasTranslation && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <span>🌐</span>
                        <span>{t('nftMarket.detail.translated')}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 font-semibold text-gray-800 bg-white/70 p-3 rounded-lg border border-gray-200/50">
                    {translatedContent.storyTitle}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500 text-sm font-medium">{t('nftMarket.detail.storyDetail')}</span>
                    {hasTranslation && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        <span>🌐</span>
                        <span>{t('nftMarket.detail.translated')}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-gray-700 bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200/50 shadow-inner max-h-32 overflow-y-auto">
                    {translatedContent.storyDetail || t('nftMarket.detail.defaultStoryDetail')}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center">
                    <span className="text-gray-500">{t('nftMarket.detail.tokenId')}</span>
                    <span className="ml-2 font-medium text-gray-800">#{nft.tokenId}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500">{t('nftMarket.detail.createTime')}</span>
                    <span className="ml-2 font-medium text-gray-800">{formatContractTimestamp(nft.createTime, language)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500">{t('nftMarket.detail.carbonReduction')}</span>
                    <span className="ml-2 font-medium text-green-600">{formatCarbonReduction(nft.carbonReduction)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-gray-500">{t('nftMarket.detail.tradeCount')}</span>
                    <span className="ml-2 font-medium text-blue-600">{nft.tradeCount}{t('nftMarket.detail.trades')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price information */}
            <div className="bg-gradient-to-br from-white to-green-50/30 rounded-xl p-5 border border-green-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">💰</span>
                </span>
{t('nftMarket.detail.priceInfo')}
              </h3>
              
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-200 rounded-xl p-4 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-green-700 font-medium">{t('nftMarket.detail.currentPrice')}</span>
                    <span className="text-green-800 font-bold text-2xl">
                      {formatCarbonPrice(nft.price)} CARB
                    </span>
                  </div>
                  
                  {priceChange && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{t('nftMarket.detail.compareToInitial')}</span>
                      <span className={`font-medium flex items-center ${
                        priceChange.isIncrease ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {priceChange.isIncrease ? '↗' : '↘'} {priceChange.percentage}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('nftMarket.detail.initialPrice')}</span>
                    <span className="font-medium text-gray-700">{formatCarbonPrice(nft.initialPrice)} CARB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('nftMarket.detail.lastTradePrice')}</span>
                    <span className="font-medium text-gray-700">
                      {nft.lastPrice ? `${formatCarbonPrice(nft.lastPrice)} CARB` : t('nftMarket.detail.noPrevTrade')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Market Information */}
            <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl p-5 border border-blue-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">🏪</span>
                </span>
{t('nftMarket.detail.marketInfo')}
              </h3>
              
                              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('nftMarket.detail.currentSeller')}</span>
                    <span className="font-medium text-gray-700 font-mono">{shortenAddress(nft.seller)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('nftMarket.detail.listingTime')}</span>
                    <span className="font-medium text-gray-700">{formatContractTimestamp(nft.timestamp, language)}</span>
                  </div>
                </div>

                {/* Full address display */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-500 text-xs">{t('nftMarket.detail.sellerFullAddress')}</span>
                  <div className="font-mono text-xs text-gray-700 mt-1 break-all">
                    {nft.seller}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom button */}
        <div className="p-6 bg-gradient-to-r from-gray-50/80 to-white/80 border-t border-gray-200/50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-medium"
          >
{t('nftMarket.detail.closeDetails')}
          </button>
        </div>
      </div>
    </div>
  );
}; 