'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { toast } from 'react-hot-toast';

// Hook return type interface

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
 * NFT Pending Function Hook
 * @description Handle NFT order pending process, including authorization and order pending operations
 * @returns Methods and statuses related to placing orders
 */
export const useListNFT = (): UseListNFTReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the contract address

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

  // Nft authorization contract call

  const { writeContract: approveNFTContract, data: approveHash } = useWriteContract();
  
  // Nft pending contract call

  const { writeContract: listNFTContract, data: listHash } = useWriteContract();

  // Listen to authorized transaction status

  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Listen to the status of pending order transactions

  const { isLoading: isListing, isSuccess: listSuccess } = useWaitForTransactionReceipt({
    hash: listHash,
  });

  // Check if nft requires authorization

  const needsApproval = (): boolean => {
    // Here you can check the authorization status through useReadContract
    // For simplicity, return true temporarily, allowing users to actively authorize

    return true;
  };

  // Get the nft authorization status

  const { refetch: refetchApproval } = useReadContract({
    address: nftAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'getApproved',
    args: address ? [BigInt(0)] : undefined, // Here you need to pass the specific token id

    query: { enabled: false } // Manually trigger query

  });

  // Authorize nft to market contracts

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

  // Pending order nft

  const listNFT = async (tokenId: string, price: string) => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(`🏪 开始挂单NFT #${tokenId}，价格: ${price}...`);

      // Verify price

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

  // Monitoring authorization completed

  useEffect(() => {
    if (approveSuccess) {
      toast.success('NFT授权成功！现在可以挂单', { id: 'approve-success' });
      refetchApproval();
    }
  }, [approveSuccess, refetchApproval]);

  // Listening to orders completed

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