'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
import { toast } from 'react-hot-toast';

interface UseBuyNFTParams {
  tokenId: string;
  price: string;
  onSuccess?: () => void;
}

type BuyStep = 'check' | 'approve' | 'buy' | 'success' | 'error';

interface UseBuyNFTReturn {
  // 状态
  currentStep: BuyStep;
  isLoading: boolean;
  errorMessage: string;
  
  // 余额和授权信息
  carbBalance: bigint | undefined;
  allowance: bigint | undefined;
  hasEnoughBalance: boolean;
  needsApproval: boolean;
  
  // 操作函数
  handleApprove: () => Promise<void>;
  handleBuy: () => Promise<void>;
  reset: () => void;
}

/**
 * 购买NFT Hook
 * @description 提供完整的NFT购买流程，包括余额检查、代币授权和购买操作
 * @param tokenId NFT Token ID
 * @param price NFT价格（wei格式）
 * @param onSuccess 购买成功回调
 * @returns 购买相关的状态和操作函数
 */
export const useBuyNFT = ({ tokenId, price, onSuccess }: UseBuyNFTParams): UseBuyNFTReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [currentStep, setCurrentStep] = useState<BuyStep>('check');
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
  const { data: carbBalance, refetch: refetchBalance } = useReadContract({
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

  // 监听授权交易状态
  const { isSuccess: approveSuccess, isError: approveError, error: approveErrorDetails, isLoading: approveLoading } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // 监听购买交易状态
  const { isSuccess: buySuccess, isError: buyError, error: buyErrorDetails, isLoading: buyLoading } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // 计算状态
  const needsApproval = !allowance || BigInt(price) > BigInt(allowance.toString());
  const hasEnoughBalance = Boolean(carbBalance && BigInt(price) <= BigInt(carbBalance.toString()));
  const isLoading = approveLoading || buyLoading || currentStep === 'approve' || currentStep === 'buy';

  // 处理授权
  const handleApprove = async (): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }
    
    try {
      setCurrentStep('approve');
      setErrorMessage('');
      
      // 授权稍微多一点的代币，以防价格波动
      const approveAmount = BigInt(price) * BigInt(110) / BigInt(100); // 多授权10%
      
      await approveCarb({
        address: carbonTokenAddress as `0x${string}`,
        abi: CarbonTokenABI.abi,
        functionName: 'approve',
        args: [marketAddress, approveAmount],
      });
    } catch (error) {
      console.error('授权失败:', error);
      const errorMsg = '授权失败，请重试';
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  };

  // 处理购买
  const handleBuy = async (): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }
    
    try {
      setCurrentStep('buy');
      setErrorMessage('');
      
      await buyNFT({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'buyNFT',
        args: [BigInt(tokenId)],
      });
    } catch (error) {
      console.error('购买失败:', error);
      const errorMsg = '购买失败，请重试';
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  };

  // 重置状态
  const reset = (): void => {
    setCurrentStep('check');
    setErrorMessage('');
  };

  // 监听授权交易完成
  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      refetchBalance();
      setCurrentStep('check');
      toast.success('授权成功！现在可以购买NFT');
    }
  }, [approveSuccess, refetchAllowance, refetchBalance]);

  // 监听购买交易完成
  useEffect(() => {
    if (buySuccess) {
      setCurrentStep('success');
      toast.success('🎉 NFT购买成功！');
      onSuccess?.();
    }
  }, [buySuccess, onSuccess]);

  // 监听授权错误
  useEffect(() => {
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
  useEffect(() => {
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

  return {
    // 状态
    currentStep,
    isLoading,
    errorMessage,
    
    // 余额和授权信息
    carbBalance,
    allowance,
    hasEnoughBalance,
    needsApproval,
    
    // 操作函数
    handleApprove,
    handleBuy,
    reset,
  };
}; 