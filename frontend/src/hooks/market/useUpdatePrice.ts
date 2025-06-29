'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import { toast } from 'react-hot-toast';

interface UseUpdatePriceParams {
  onSuccess?: () => void;
}

interface UseUpdatePriceReturn {
  // state

  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string;
  
  // Operation functions

  updatePrice: (tokenId: string, newPrice: string) => Promise<void>;
  reset: () => void;
}

/**
 * Update price Hook
 * @description Provides the function of updating NFT pending order prices, including contract calls and state management
 * @param onSuccess Update successfully callback
 * @returns Update price-related state and operation functions
 */
export const useUpdatePrice = ({ onSuccess }: UseUpdatePriceParams = {}): UseUpdatePriceReturn => {
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

  // Update price contract call

  const { writeContract, data: hash, isPending } = useWriteContract();

  // Listen to transaction status

  const { isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
  });

  // Update price action

  const updatePrice = async (tokenId: string, newPrice: string): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    // Price verification

    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      const errorMsg = '请输入有效的价格';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setErrorMessage('');
      
      // Price is in integer format, used directly (no need to convert to wei)

      const priceInInteger = BigInt(Math.floor(priceValue));
      
      await writeContract({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'updatePrice',
        args: [BigInt(tokenId), priceInInteger],
      });
    } catch (error) {
      console.error('更新价格失败:', error);
      const errorMsg = '更新价格失败，请重试';
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
      toast.success('🎉 价格更新成功！');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // Listening to transaction errors

  useEffect(() => {
    if (isError && error) {
      console.error('更新价格交易失败:', error);
      let errorMsg = '更新价格失败';
      
      if (error.message?.includes('user rejected')) {
        errorMsg = '用户取消了交易';
      } else if (error.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      } else if (error.message?.includes('not owner')) {
        errorMsg = '只有挂单者才能更新价格';
      } else if (error.message?.includes('not listed')) {
        errorMsg = '该NFT未在市场上挂单';
      } else if (error.message?.includes('invalid price')) {
        errorMsg = '价格必须大于0';
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

    updatePrice,
    reset,
  };
}; 