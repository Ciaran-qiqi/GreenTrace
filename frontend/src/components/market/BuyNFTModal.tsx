'use client';

import React, { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useChainId } from 'wagmi';
// viem imports handled in hooks
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatCarbonReduction } from '@/utils/formatUtils';
import { MarketNFT } from '@/hooks/market/useMarketNFTs';
import { toast } from 'react-hot-toast';

interface BuyNFTModalProps {
  nft: MarketNFT;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 购买NFT模态框组件
 * @description 处理NFT购买流程，包括余额检查、授权和购买交易
 * @param nft NFT信息
 * @param isOpen 是否显示模态框
 * @param onClose 关闭回调
 * @param onSuccess 购买成功回调
 */
export const BuyNFTModal: React.FC<BuyNFTModalProps> = ({
  nft,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [currentStep, setCurrentStep] = useState<'check' | 'approve' | 'buy' | 'success' | 'error'>('check');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 获取合约地址
  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const getCarbonTokenAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.CarbonToken;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.CarbonToken;
      case 31337: return CONTRACT_ADDRESSES.foundry.CarbonToken;
      default: return CONTRACT_ADDRESSES.sepolia.CarbonToken;
    }
  };

  const marketAddress = getMarketAddress(chainId);
  const carbonTokenAddress = getCarbonTokenAddress(chainId);

  // 检查CARB余额
  const { data: carbBalance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // 检查CARB授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'allowance',
    args: address ? [address, marketAddress] : undefined,
    query: { enabled: !!address && !!marketAddress }
  });

  // 授权CARB合约调用
  const { writeContract: approveCarb, data: approveHash } = useWriteContract();
  
  // 购买NFT合约调用
  const { writeContract: buyNFT, data: buyHash } = useWriteContract();

  // 监听授权交易状态（包括错误）
  const { isSuccess: approveSuccess, isError: approveError, error: approveErrorDetails } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // 监听购买交易状态（包括错误）
  const { isSuccess: buySuccess, isError: buyError, error: buyErrorDetails } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // 计算是否需要授权 - 修复逻辑：当没有授权或授权不足时都需要授权
  const needsApproval = !allowance || BigInt(nft.price) > BigInt(allowance.toString());
  const hasEnoughBalance = Boolean(carbBalance && BigInt(nft.price) <= BigInt(carbBalance.toString()));

  // 处理授权
  const handleApprove = async () => {
    if (!address) return;
    
    try {
      setCurrentStep('approve');
      // 授权稍微多一点的代币，以防价格波动或手续费
      const approveAmount = BigInt(nft.price) * BigInt(110) / BigInt(100); // 多授权10%
      await approveCarb({
        address: carbonTokenAddress as `0x${string}`,
        abi: CarbonTokenABI.abi,
        functionName: 'approve',
        args: [marketAddress, approveAmount],
      });
    } catch (error) {
      console.error('授权失败:', error);
      toast.error('授权失败，请重试');
      setCurrentStep('check');
    }
  };

  // 处理购买
  const handleBuy = async () => {
    if (!address) return;
    
    try {
      setCurrentStep('buy');
      await buyNFT({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'buyNFT',
        args: [BigInt(nft.tokenId)],
      });
    } catch (error) {
      console.error('购买失败:', error);
      toast.error('购买失败，请重试');
      setCurrentStep('check');
    }
  };

  // 监听交易完成和错误
  React.useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      setCurrentStep('check');
      toast.success('授权成功！现在可以购买NFT');
    }
  }, [approveSuccess, refetchAllowance]);

  React.useEffect(() => {
    if (buySuccess) {
      setCurrentStep('success');
      toast.success('🎉 NFT购买成功！');
      onSuccess?.();
    }
  }, [buySuccess, onSuccess]);

  // 监听授权错误
  React.useEffect(() => {
    if (approveError && approveErrorDetails) {
      console.error('授权交易失败:', approveErrorDetails);
      let errorMsg = '授权失败';
      if (approveErrorDetails.message?.includes('insufficient allowance')) {
        errorMsg = '授权额度不足，请重新授权';
      } else if (approveErrorDetails.message?.includes('user rejected')) {
        errorMsg = '用户取消了授权';
      } else if (approveErrorDetails.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      }
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  }, [approveError, approveErrorDetails]);

  // 监听购买错误
  React.useEffect(() => {
    if (buyError && buyErrorDetails) {
      console.error('购买交易失败:', buyErrorDetails);
      let errorMsg = '购买失败';
      if (buyErrorDetails.message?.includes('insufficient allowance')) {
        errorMsg = 'CARB授权不足，请先授权足够的代币';
      } else if (buyErrorDetails.message?.includes('user rejected')) {
        errorMsg = '用户取消了购买';
      } else if (buyErrorDetails.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      } else if (buyErrorDetails.message?.includes('not listed')) {
        errorMsg = '该NFT已下架或不存在';
      }
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  }, [buyError, buyErrorDetails]);

  return isOpen ? (
    <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-md w-full max-h-[90vh] overflow-y-auto relative overflow-hidden">
        {/* 装饰性顶部渐变 */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
        
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              购买 NFT #{nft.tokenId}
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* NFT信息 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{nft.storyTitle}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>💰 价格: <span className="font-medium text-green-600">{formatFeeAmount(nft.price)} CARB</span></div>
              <div>🌿 碳减排: {formatCarbonReduction(nft.carbonReduction)}</div>
              <div>👤 卖家: {nft.seller.slice(0, 6)}...{nft.seller.slice(-4)}</div>
            </div>
          </div>

          {/* 余额检查 */}
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

          {/* 操作步骤 */}
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
                        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        1️⃣ 授权 CARB 代币
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleBuy}
                      className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      💰 立即购买
                    </button>
                  )}
                </>
              )}

              {currentStep === 'approve' && (
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

              {currentStep === 'buy' && (
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

          {/* 底部提示 */}
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