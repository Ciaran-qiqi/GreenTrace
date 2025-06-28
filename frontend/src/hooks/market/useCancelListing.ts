'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import { toast } from 'react-hot-toast';

interface UseCancelListingParams {
  onSuccess?: () => void;
}

interface UseCancelListingReturn {
  // 状态
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string;
  
  // 操作函数
  cancelListing: (tokenId: string) => Promise<void>;
  reset: () => void;
}

/**
 * 取消挂单 Hook
 * @description 提供取消NFT挂单的功能，包括合约调用和状态管理
 * @param onSuccess 取消成功回调
 * @returns 取消挂单相关的状态和操作函数
 */
export const useCancelListing = ({ onSuccess }: UseCancelListingParams = {}): UseCancelListingReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 获取市场合约地址
  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const marketAddress = getMarketAddress(chainId);

  // 取消挂单合约调用
  const { writeContract, data: hash, isPending } = useWriteContract();

  // 监听交易状态
  const { isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
  });

  // 取消挂单操作
  const cancelListing = async (tokenId: string): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    try {
      setErrorMessage('');
      
      await writeContract({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'cancelListing',
        args: [BigInt(tokenId)],
      });
    } catch (error) {
      console.error('取消挂单失败:', error);
      const errorMsg = '取消挂单失败，请重试';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    }
  };

  // 重置状态
  const reset = (): void => {
    setErrorMessage('');
  };

  // 监听交易完成
  useEffect(() => {
    if (isSuccess) {
      toast.success('🎉 挂单取消成功！');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // 监听交易错误
  useEffect(() => {
    if (isError && error) {
      console.error('取消挂单交易失败:', error);
      let errorMsg = '取消挂单失败';
      
      if (error.message?.includes('user rejected')) {
        errorMsg = '用户取消了交易';
      } else if (error.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      } else if (error.message?.includes('not owner')) {
        errorMsg = '只有挂单者才能取消挂单';
      } else if (error.message?.includes('not listed')) {
        errorMsg = '该NFT未在市场上挂单';
      }
      
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    }
  }, [isError, error]);

  return {
    // 状态
    isLoading: isPending,
    isSuccess,
    isError,
    errorMessage,
    
    // 操作函数
    cancelListing,
    reset,
  };
}; 