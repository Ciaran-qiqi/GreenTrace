'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';

// 我的挂单数据接口
export interface MyListing {
  listingId: string;
  tokenId: string;
  title: string;
  carbonReduction: string;
  currentPrice: string;
  originalPrice: string;
  listedAt: string;
  status: 'active' | 'sold' | 'cancelled';
  views?: number;
  offers?: number;
  seller: string;
}

export interface UseMyListingsReturn {
  listings: MyListing[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 获取用户挂单数据的Hook
 * @description 从智能合约获取当前用户的所有挂单信息
 * @returns 用户挂单数据和操作方法
 */
export const useMyListings = (): UseMyListingsReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [listings, setListings] = useState<MyListing[]>([]);
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

  const marketAddress = getMarketAddress(chainId);

  // 获取用户挂单数据
  const { data: userListings, refetch: refetchUserListings } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: GreenTalesMarketABI.abi,
    functionName: 'getUserListings',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!marketAddress,
    }
  });

  // 处理获取到的挂单数据
  const fetchListingsDetails = async () => {
    if (!userListings || !address) {
      setListings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🏪 获取用户挂单数据:', userListings);
      
      // userListings 应该是一个包含 tokenId 数组的结果
      const tokenIds = userListings as bigint[];
      
      if (tokenIds.length === 0) {
        setListings([]);
        setIsLoading(false);
        return;
      }

      // 使用 readContracts 批量获取详细信息
      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');

      // 批量获取每个NFT的完整信息
      const nftInfoContracts = tokenIds.map(tokenId => ({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi as any,
        functionName: 'getNFTFullInfo',
        args: [tokenId],
      }));

      console.log('📋 批量查询NFT详细信息...');
      const nftInfoResults = await readContracts(config, { contracts: nftInfoContracts });

      // 组装挂单数据
      const myListings: MyListing[] = [];
      nftInfoResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [listing, storyMeta] = result.result as [any, any, bigint];
          const tokenId = tokenIds[index];

          // 只有当前用户的挂单才添加
          if (listing.seller.toLowerCase() === address.toLowerCase()) {
            myListings.push({
              listingId: tokenId.toString(),
              tokenId: tokenId.toString(),
              title: storyMeta.storyTitle || `绿色NFT #${tokenId}`,
              carbonReduction: storyMeta.carbonReduction.toString(),
              currentPrice: listing.price.toString(),
              originalPrice: listing.price.toString(), // 暂时设为相同，后续可以从历史记录获取
              listedAt: listing.timestamp.toString(),
              status: listing.isActive ? 'active' : 'sold',
              seller: listing.seller,
              // 这些数据暂时设为默认值，可以后续从其他合约函数获取
              views: 0,
              offers: 0,
            });
          }
        }
      });

      console.log(`✅ 成功获取 ${myListings.length} 个用户挂单`);
      setListings(myListings);

    } catch (error) {
      console.error('❌ 获取用户挂单失败:', error);
      setError(error instanceof Error ? error.message : '获取挂单数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 监听用户挂单数据变化
  useEffect(() => {
    if (userListings && address) {
      fetchListingsDetails();
    }
  }, [userListings, address, marketAddress]);

  // 刷新数据的方法
  const refetch = () => {
    refetchUserListings();
  };

  return {
    listings,
    isLoading,
    error,
    refetch,
  };
}; 