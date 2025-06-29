'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';

// My pending data interface

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
 * Get user order data
 * @description Get all pending order information of the current user from the smart contract
 * @returns User order data and operation methods
 */
export const useMyListings = (): UseMyListingsReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [listings, setListings] = useState<MyListing[]>([]);
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

  const marketAddress = getMarketAddress(chainId);

  // Obtain user order data

  const { data: userListings, refetch: refetchUserListings } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: GreenTalesMarketABI.abi,
    functionName: 'getUserListings',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!marketAddress && address.length === 42, // Make sure the address format is correct

      retry: false, // Avoid repeated calls

    }
  });

  // Process the obtained pending order data

  const fetchListingsDetails = useCallback(async () => {
    if (!address) {
      setListings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🏪 开始获取用户完整挂单历史...');
      
      // Use readContracts to get detailed information in batches

      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');

      const myListings: MyListing[] = [];

      // 1. Get the currently active order

      if (userListings) {
        const tokenIds = userListings as bigint[];
        
        if (tokenIds.length > 0) {
          console.log('📋 获取当前活跃挂单...');
          
          // Get full information for each nft in batches

          const nftInfoContracts = tokenIds.map(tokenId => ({
            address: marketAddress as `0x${string}`,
            abi: GreenTalesMarketABI.abi as any,
            functionName: 'getNFTFullInfo',
            args: [tokenId],
          }));

          const nftInfoResults = await readContracts(config, { contracts: nftInfoContracts });

          nftInfoResults.forEach((result, index) => {
            if (result.status === 'success' && result.result) {
              const [listing, storyMeta] = result.result as [any, any, bigint];
              const tokenId = tokenIds[index];

              // Only the current user's pending order is added

              if (listing.seller.toLowerCase() === address.toLowerCase()) {
                myListings.push({
                  listingId: tokenId.toString(),
                  tokenId: tokenId.toString(),
                  title: storyMeta.storyTitle || `绿色NFT #${tokenId}`,
                  carbonReduction: storyMeta.carbonReduction.toString(),
                  currentPrice: listing.price.toString(),
                  originalPrice: listing.price.toString(),
                  listedAt: listing.timestamp.toString(),
                  status: listing.isActive ? 'active' : 'cancelled',
                  seller: listing.seller,
                  views: 0,
                  offers: 0,
                });
              }
            }
          });
        }
      }

      // 2. Note: Transaction history acquisition logic is temporarily disabled because getTradeHistory requires a specific tokenId parameter
      // In actual applications, transaction history should be obtained through blockchain event monitoring or external indexing services.

      console.log('📈 跳过交易历史获取（需要重新设计）');

      // 3. Sort by time (the latest one is first)

      myListings.sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt));

      console.log(`✅ 成功获取 ${myListings.length} 个用户挂单记录`);
      console.log('📊 状态分布:', {
        active: myListings.filter(l => l.status === 'active').length,
        sold: myListings.filter(l => l.status === 'sold').length,
        cancelled: myListings.filter(l => l.status === 'cancelled').length,
      });
      
      setListings(myListings);

    } catch (error) {
      console.error('❌ 获取用户挂单失败:', error);
      setError(error instanceof Error ? error.message : '获取挂单数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [address, userListings, marketAddress]);

  // Listen to changes in user orders

  useEffect(() => {
    if (address && marketAddress) {
      fetchListingsDetails();
    } else {
      setListings([]);
      setIsLoading(false);
    }
  }, [fetchListingsDetails, address, marketAddress]);

  // How to refresh data

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