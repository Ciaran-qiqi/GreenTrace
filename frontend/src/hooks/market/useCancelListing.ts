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
  // state

  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string;
  
  // Operation functions

  cancelListing: (tokenId: string) => Promise<void>;
  reset: () => void;
}

/**
 * Cancel the order Hook
 * @description Provides the function of canceling NFT pending orders, including contract calls and state management
 * @param onSuccess Cancel the successful callback
 * @returns Cancel the status and operation functions related to pending orders
 */
export const useCancelListing = ({ onSuccess }: UseCancelListingParams = {}): UseCancelListingReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get the market contract address

  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const marketAddress = getMarketAddress(chainId);

  // Cancel the pending contract call

  const { writeContract, data: hash, isPending } = useWriteContract();

  // Listen to transaction status

  const { isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
  });

  // Cancel the pending order operation

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

  // Reset status

  const reset = (): void => {
    setErrorMessage('');
  };

  // Listen to transaction completion

  useEffect(() => {
    if (isSuccess) {
      toast.success('🎉 挂单取消成功！');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // Listening to transaction errors

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
    // state

    isLoading: isPending,
    isSuccess,
    isError,
    errorMessage,
    
    // Operation functions

    cancelListing,
    reset,
  };
}; 