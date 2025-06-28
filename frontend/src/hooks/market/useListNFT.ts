'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { toast } from 'react-hot-toast';

// Hook返回类型接口
export interface UseListNFTReturn {
  listNFT: (tokenId: string, price: string) => Promise<void>;
  isLoading: boolean;
  isApproving: boolean;
  isListing: boolean;
  isSuccess: boolean;
  isApproveSuccess: boolean;
  error: string | null;
  needsApproval: () => boolean;
  approveNFT: (tokenId: string) => Promise<void>;
}

/**
 * NFT挂单功能Hook
 * @description 处理NFT挂单流程，包括授权和挂单操作
 * @returns 挂单相关的方法和状态
 */
export const useListNFT = (): UseListNFTReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取合约地址
  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const getNFTAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.NFT;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.NFT;
      case 31337: return CONTRACT_ADDRESSES.foundry.NFT;
      default: return CONTRACT_ADDRESSES.sepolia.NFT;
    }
  };

  const marketAddress = getMarketAddress(chainId);
  const nftAddress = getNFTAddress(chainId);

  // NFT授权合约调用
  const { writeContract: approveNFTContract, data: approveHash } = useWriteContract();
  
  // NFT挂单合约调用
  const { writeContract: listNFTContract, data: listHash } = useWriteContract();

  // 监听授权交易状态
  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // 监听挂单交易状态
  const { isLoading: isListing, isSuccess: listSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  // 检查NFT是否需要授权
  const needsApproval = (): boolean => {
    // 这里可以通过 useReadContract 检查授权状态
    // 为简化，暂时返回 true，让用户主动授权
    return true;
  };

  // 获取NFT授权状态
  const { refetch: refetchApproval } = useReadContract({
    address: nftAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'getApproved',
    args: address ? [BigInt(0)] : undefined, // 这里需要传入具体的tokenId
    query: { enabled: false } // 手动触发查询
  });

  // 授权NFT给市场合约
  const approveNFT = async (tokenId: string) => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    try {
      setError(null);
      console.log(`🔐 开始授权NFT #${tokenId}给市场合约...`);
      
      await approveNFTContract({
        address: nftAddress as `0x${string}`,
        abi: GreenTalesNFTABI.abi,
        functionName: 'approve',
        args: [marketAddress, BigInt(tokenId)],
      });
      
      toast.loading('正在授权NFT...', { id: `approve-${tokenId}` });
    } catch (error) {
      console.error('授权失败:', error);
      const errorMessage = error instanceof Error ? error.message : '授权失败';
      setError(errorMessage);
      toast.error('授权失败: ' + errorMessage);
    }
  };

  // 挂单NFT
  const listNFT = async (tokenId: string, price: string) => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🏪 开始挂单NFT #${tokenId}，价格: ${price}...`);

      // 验证价格
      const priceInWei = BigInt(price);
      if (priceInWei <= 0) {
        throw new Error('价格必须大于0');
      }

      await listNFTContract({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'listNFT',
        args: [BigInt(tokenId), priceInWei],
      });

      toast.loading('正在挂单NFT...', { id: `list-${tokenId}` });
    } catch (error) {
      console.error('挂单失败:', error);
      const errorMessage = error instanceof Error ? error.message : '挂单失败';
      setError(errorMessage);
      toast.error('挂单失败: ' + errorMessage);
      setIsLoading(false);
    }
  };

  // 监听授权完成
  useEffect(() => {
    if (approveSuccess) {
      toast.success('NFT授权成功！现在可以挂单', { id: 'approve-success' });
      refetchApproval();
    }
  }, [approveSuccess, refetchApproval]);

  // 监听挂单完成
  useEffect(() => {
    if (listSuccess) {
      setIsLoading(false);
      toast.success('🎉 NFT挂单成功！', { id: 'list-success' });
    }
  }, [listSuccess]);

  return {
    listNFT,
    isLoading: isLoading || isApproving || isListing,
    isApproving,
    isListing,
    isSuccess: listSuccess,
    isApproveSuccess: approveSuccess,
    error,
    needsApproval,
    approveNFT,
  };
}; 