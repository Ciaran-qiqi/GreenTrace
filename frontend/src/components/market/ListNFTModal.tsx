'use client';

import React, { useState } from 'react';
import { parseEther } from 'viem';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatCarbonReduction } from '@/utils/formatUtils';
import { useListNFT } from '@/hooks/market/useListNFT';
import { toast } from 'react-hot-toast';

// Nft information interface (simplified version)

interface NFTInfo {
  tokenId: string;
  title: string;
  storyDetails: string;
  carbonReduction: string;
  initialPrice: string;
  owner: string;
}

interface ListNFTModalProps {
  nft: NFTInfo;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Pending order NFT modal box component
 * @description Handle NFT order pending process, including price setting, authorization and order pending operations
 * @param nft NFT information
 * @param isOpen Whether to display the modal box
 * @param onClose Close callback
 * @param onSuccess Callback successfully
 */
export const ListNFTModal: React.FC<ListNFTModalProps> = ({
  nft,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [price, setPrice] = useState('');
  const [currentStep, setCurrentStep] = useState<'input' | 'approve' | 'list' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const {
    listNFT,
    isLoading,
    isSuccess,
    isApproveSuccess,
    error,
    needsApproval,
    approveNFT,
  } = useListNFT();

  // Verify price input

  const validatePrice = (priceStr: string): boolean => {
    try {
      const priceNum = parseFloat(priceStr);
      return priceNum > 0 && priceNum <= 1000000; // Up to 1 million carbs

    } catch {
      return false;
    }
  };

  // Process price input

  const handlePriceChange = (value: string) => {
    // Only numbers and decimal points are allowed

    const validValue = value.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points

    const parts = validValue.split('.');
    if (parts.length > 2) {
      return;
    }
    // Limit the number of decimal places

    if (parts[1] && parts[1].length > 18) {
      return;
    }
    setPrice(validValue);
  };

  // Processing Authorization

  const handleApprove = async () => {
    try {
      setCurrentStep('approve');
      await approveNFT(nft.tokenId);
    } catch (error) {
      console.error('授权失败:', error);
      setCurrentStep('input');
    }
  };

  // Processing orders

  const handleList = async () => {
    if (!validatePrice(price)) {
      toast.error('请输入有效的价格');
      return;
    }

    try {
      setCurrentStep('list');
      const priceInWei = parseEther(price);
      await listNFT(nft.tokenId, priceInWei.toString());
    } catch (error) {
      console.error('挂单失败:', error);
      setCurrentStep('input');
    }
  };



  // Calculate the handling fee (assuming 1%)

  const calculateFee = (priceStr: string) => {
    if (!validatePrice(priceStr)) return '0';
    const priceNum = parseFloat(priceStr);
    return (priceNum * 0.01).toFixed(4); // 1% handling fee

  };

  // The monitoring authorization is successful and the order is automatically entered.

  React.useEffect(() => {
    if (isApproveSuccess && currentStep === 'approve') {
      console.log('🎉 授权成功，准备挂单...');
      setCurrentStep('input'); // Return to the input step and display the pending order button

    }
  }, [isApproveSuccess, currentStep]);

  // Listening to order successfully

  React.useEffect(() => {
    if (isSuccess) {
      setCurrentStep('success');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // Listening error

  React.useEffect(() => {
    if (error) {
      console.error('挂单过程中出错:', error);
      let errorMsg = '挂单失败';
      if (error.includes('user rejected')) {
        errorMsg = '用户取消了交易';
      } else if (error.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      } else if (error.includes('not owner')) {
        errorMsg = '您不是该NFT的拥有者';
      } else if (error.includes('already listed')) {
        errorMsg = '该NFT已经在市场上挂单';
      }
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  }, [error]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-md w-full max-h-[90vh] overflow-y-auto relative overflow-hidden">
        {/* Decorative top gradient */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
        
        {/* head */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              挂单 NFT #{nft.tokenId}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* content */}
        <div className="p-6">
          {/* Nft information display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{nft.title}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>🌿 碳减排: {formatCarbonReduction(nft.carbonReduction)}</div>
              <div>💰 初始价格: {formatFeeAmount(nft.initialPrice)} CARB</div>
              <div className="text-xs text-gray-500 line-clamp-2">{nft.storyDetails}</div>
            </div>
          </div>

          {/* Steps display */}
          {currentStep === 'input' && (
            <div className="space-y-4">
              {/* Price input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  设置售价 (CARB) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={price}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    placeholder="请输入售价，如：10.5"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-3 text-gray-500 text-sm">
                    CARB
                  </div>
                </div>
                {price && validatePrice(price) && (
                  <div className="mt-2 text-xs text-gray-500">
                    ≈ ${(parseFloat(price) * 80).toFixed(2)} USD (假设1 CARB = $80)
                  </div>
                )}
              </div>

              {/* Fee preview */}
              {price && validatePrice(price) && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-blue-700 font-medium mb-2">费用预览</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">售价:</span>
                      <span className="font-medium">{price} CARB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">平台手续费 (1%):</span>
                      <span className="text-red-600">-{calculateFee(price)} CARB</span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 flex justify-between font-medium">
                      <span className="text-gray-700">您将收到:</span>
                      <span className="text-green-600">
                        {(parseFloat(price) - parseFloat(calculateFee(price))).toFixed(4)} CARB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Operation button */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                
                {needsApproval() && !isApproveSuccess ? (
                  <button
                    onClick={handleApprove}
                    disabled={!validatePrice(price) || isLoading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    1️⃣ 授权NFT
                  </button>
                ) : (
                  <button
                    onClick={handleList}
                    disabled={!validatePrice(price) || isLoading}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    🏪 立即挂单
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Authorization */}
          {currentStep === 'approve' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-blue-600 font-medium text-lg mb-2">正在授权NFT...</div>
              <div className="text-sm text-gray-500 mb-4">请在钱包中确认授权交易</div>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                💡 授权后，市场合约才能代您转移NFT
              </div>
              <button
                onClick={() => setCurrentStep('input')}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          )}

          {/* Put in order */}
          {currentStep === 'list' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <div className="text-green-600 font-medium text-lg mb-2">正在挂单...</div>
              <div className="text-sm text-gray-500 mb-4">请在钱包中确认挂单交易</div>
              <div className="mb-4 space-y-2 text-sm text-gray-600">
                <div>💰 售价: {price} CARB</div>
                <div>📋 Token ID: #{nft.tokenId}</div>
              </div>
              <button
                onClick={() => setCurrentStep('input')}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
            </div>
          )}

          {/* Successful order */}
          {currentStep === 'success' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <div className="text-green-600 font-medium text-lg mb-2">挂单成功！</div>
              <div className="text-sm text-gray-500 mb-4">
                您的NFT现在在市场上等待买家
              </div>
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-green-700">
                  <div>🏪 售价: {price} CARB</div>
                  <div>📋 Token ID: #{nft.tokenId}</div>
                  <div>💼 您可以在&ldquo;我的挂单&rdquo;中管理此NFT</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                完成
              </button>
            </div>
          )}

          {/* Error status */}
          {currentStep === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <div className="text-red-600 font-medium text-lg mb-2">挂单失败</div>
              <div className="text-sm text-gray-600 mb-4 px-4">
                {errorMessage}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setCurrentStep('input');
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

        {/* Bottom tips */}
        {currentStep === 'input' && (
          <div className="px-6 pb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="text-yellow-700 text-sm">
                ⚠️ <strong>重要提示:</strong>
                <ul className="mt-1 ml-4 list-disc text-xs">
                  <li>挂单后NFT将转移到市场合约中</li>
                  <li>您可以随时取消挂单或调整价格</li>
                  <li>成交时平台收取1%手续费</li>
                  <li>请确认价格后再提交</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 