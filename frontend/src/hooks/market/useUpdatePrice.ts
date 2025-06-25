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
  // 状态
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage: string;
  
  // 操作函数
  updatePrice: (tokenId: string, newPrice: string) => Promise<void>;
  reset: () => void;
}

/**
 * 更新价格 Hook
 * @description 提供更新NFT挂单价格的功能，包括合约调用和状态管理
 * @param onSuccess 更新成功回调
 * @returns 更新价格相关的状态和操作函数
 */
export const useUpdatePrice = ({ onSuccess }: UseUpdatePriceParams = {}): UseUpdatePriceReturn => {
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

  // 更新价格合约调用
  const { writeContract, data: hash, isPending } = useWriteContract();

  // 监听交易状态
  const { isSuccess, isError, error } = useWaitForTransactionReceipt({
    hash,
  });

  // 更新价格操作
  const updatePrice = async (tokenId: string, newPrice: string): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    // 价格验证
    const priceValue = parseFloat(newPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      const errorMsg = '请输入有效的价格';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      return;
    }

    try {
      setErrorMessage('');
      
      // 将价格转换为wei (假设输入的是以太单位)
      const priceInWei = BigInt(Math.floor(priceValue * 1e18));
      
      await writeContract({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'updatePrice',
        args: [BigInt(tokenId), priceInWei],
      });
    } catch (error) {
      console.error('更新价格失败:', error);
      const errorMsg = '更新价格失败，请重试';
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
      toast.success('🎉 价格更新成功！');
      onSuccess?.();
    }
  }, [isSuccess, onSuccess]);

  // 监听交易错误
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
    // 状态
    isLoading: isPending,
    isSuccess,
    isError,
    errorMessage,
    
    // 操作函数
    updatePrice,
    reset,
  };
}; 