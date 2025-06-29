'use client';

import React from 'react';
import { useBuyNFT } from '@/hooks/market/useBuyNFT';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatCarbonReduction } from '@/utils/formatUtils';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';

interface BuyNFTModalProps {
  nft: MarketNFT;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Purchase NFT modal box components
 * @description Handle NFT purchase process, including balance checks, authorizations and purchase transactions
 * @param nft NFT information
 * @param isOpen Whether to display the modal box
 * @param onClose Close callback
 * @param onSuccess Successful purchase callback
 */
export const BuyNFTModal: React.FC<BuyNFTModalProps> = ({
  nft,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Use the refactored useBuyNFT Hook

  const {
    currentStep,
    isLoading,
    errorMessage,
    carbBalance,
    allowance,
    hasEnoughBalance,
    needsApproval,
    handleApprove,
    handleBuy,
    reset
  } = useBuyNFT({
    tokenId: nft.tokenId,
    price: nft.price,
    onSuccess: () => {
      onSuccess?.();
      handleClose();
    }
  });

  // Close the modal box

  const handleClose = () => {
    reset();
    onClose();
  };

  return isOpen ? (
    <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-md w-full max-h-[90vh] overflow-y-auto relative overflow-hidden">
        {/* Decorative top gradient */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
        
        {/* head */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              购买 NFT #{nft.tokenId}
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* content */}
        <div className="p-6">
          {/* Nft information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{nft.storyTitle}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>💰 价格: <span className="font-medium text-green-600">{formatFeeAmount(nft.price)} CARB</span></div>
              <div>🌿 碳减排: {formatCarbonReduction(nft.carbonReduction)}</div>
              <div>👤 卖家: {nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}</div>
            </div>
          </div>

          {/* Balance check */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">您的CARB余额:</span>
              <span className={`font-medium ${hasEnoughBalance ? 'text-green-600' : 'text-red-500'}`}>
                {carbBalance ? formatFeeAmount(carbBalance.toString()) + ' CARB' : '0 CARB'}
              </span>
            </div>
            {!hasEnoughBalance && (
              <div className="text-red-500 text-sm">
                ⚠️ 余额不足，无法购买此NFT
              </div>
            )}
          </div>

          {/* Operation steps */}
          {hasEnoughBalance && (
            <div className="space-y-3">
              {currentStep === 'check' && (
                <>
                  {needsApproval ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="text-yellow-800 text-sm">
                          <strong>⚠️ 需要授权</strong><br />
                          首次购买需要授权CARB代币给市场合约，这是安全要求。
                        </div>
                      </div>
                      <button
                        onClick={handleApprove}
                        disabled={isLoading}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                      >
                        1️⃣ 授权 CARB 代币
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleBuy}
                      disabled={isLoading}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                    >
                      💰 立即购买
                    </button>
                  )}
                </>
              )}

              {(currentStep === 'approve' || (isLoading && needsApproval)) && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <div className="text-blue-600 font-medium">正在授权...</div>
                  <div className="text-sm text-gray-500 mt-1 mb-4">请在钱包中确认授权交易</div>
                  <button
                    onClick={() => setCurrentStep('check')}
                    className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}

              {(currentStep === 'buy' || (isLoading && !needsApproval)) && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                  <div className="text-green-600 font-medium">正在购买...</div>
                  <div className="text-sm text-gray-500 mt-1 mb-4">请在钱包中确认购买交易</div>
                  <button
                    onClick={() => setCurrentStep('check')}
                    className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}

              {currentStep === 'success' && (
                <div className="text-center py-4">
                  <div className="text-6xl mb-3">🎉</div>
                  <div className="text-green-600 font-medium text-lg mb-2">购买成功！</div>
                  <div className="text-sm text-gray-500 mb-4">NFT已转移到您的钱包</div>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    完成
                  </button>
                </div>
              )}

              {currentStep === 'error' && (
                <div className="text-center py-4">
                  <div className="text-6xl mb-3">❌</div>
                  <div className="text-red-600 font-medium text-lg mb-2">交易失败</div>
                  <div className="text-sm text-gray-600 mb-4 px-4">
                    {errorMessage}
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setCurrentStep('check');
                        setErrorMessage('');
                      }}
                      className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      重试
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom tips */}
          {hasEnoughBalance && currentStep === 'check' && !needsApproval && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <div className="text-green-700 text-sm">
                ✅ <strong>准备就绪:</strong>
                <ul className="mt-1 ml-4 list-disc text-xs">
                  <li>CARB代币已授权</li>
                  <li>余额充足，可以立即购买</li>
                  <li>购买成功后NFT将转移到您的钱包</li>
                </ul>
              </div>
            </div>
          )}

          {hasEnoughBalance && currentStep === 'check' && needsApproval && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-blue-700 text-sm">
                💡 <strong>购买流程:</strong>
                <ul className="mt-1 ml-4 list-disc text-xs">
                  <li>第1步：授权CARB代币给市场合约</li>
                  <li>第2步：确认购买交易</li>
                  <li>完成后NFT将转移到您的钱包</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;
}; 