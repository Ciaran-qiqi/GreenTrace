'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { readContracts } from 'wagmi/actions';
import { config } from '@/lib/wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { fetchBatchNFTMetadata, NFTMetadata } from '@/utils/nftMetadata';

// Market nft information interface

export interface MarketNFT {
  tokenId: string;
  seller: string;
  price: string;
  timestamp: string;
  isActive: boolean;
  // Nft basic metadata

  storyTitle: string;
  storyDetail: string;
  carbonReduction: string;
  createTime: string;
  initialPrice: string;
  lastPrice: string;
  // Transaction statistics

  tradeCount: number;
  // Nft metadata information

  tokenURI?: string;
  metadata?: NFTMetadata | null;
  imageUrl?: string | null;
}

// Pagination Parameter Interface

export interface PaginationParams {
  offset: number;
  limit: number;
}

// Hook return type interface

export interface UseMarketNFTsReturn {
  nfts: MarketNFT[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Get the Hook for Market NFT List
 * @description Support pagination loading to obtain NFTs and their detailed information for all pending orders in the market
 * @param initialLimit The number of initial loads, default 12
 * @returns Market NFT data and operation methods
 */
export const useMarketNFTs = (initialLimit: number = 12): UseMarketNFTsReturn => {
  const chainId = useChainId();
  const [nfts, setNfts] = useState<MarketNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(initialLimit);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Get the contract address

  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1:
        return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111:
        return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337:
        return CONTRACT_ADDRESSES.foundry.Market;
      default:
        return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const getNFTAddress = (chainId: number): string => {
    switch (chainId) {
      case 1:
        return CONTRACT_ADDRESSES.mainnet.NFT;
      case 11155111:
        return CONTRACT_ADDRESSES.sepolia.NFT;
      case 31337:
        return CONTRACT_ADDRESSES.foundry.NFT;
      default:
        return CONTRACT_ADDRESSES.sepolia.NFT;
    }
  };

  const marketAddress = getMarketAddress(chainId);
  const nftAddress = getNFTAddress(chainId);

  // Get market statistics

  const { data: marketStats, refetch: refetchStats } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: GreenTalesMarketABI.abi,
    functionName: 'getListingStats',
    query: {
      enabled: !!marketAddress,
    }
  });

  // Get market nft data

  const fetchMarketNFTs = useCallback(async (currentOffset: number = 0, shouldAppend: boolean = false) => {
    try {
      console.log(`🔍 开始获取市场NFT数据，偏移量: ${currentOffset}, 限制: ${limit}`);
      
      // 1. Get paging information

      const paginationResult = await readContracts(config, {
        contracts: [{
          address: marketAddress as `0x${string}`,
          abi: GreenTalesMarketABI.abi as any,
          functionName: 'getListingsWithPagination',
          args: [BigInt(currentOffset), BigInt(limit)],
        }]
      });

      if (paginationResult[0].status !== 'success' || !paginationResult[0].result) {
        throw new Error('获取挂单信息失败');
      }

      const [tokenIds] = paginationResult[0].result as [bigint[], any[]];
      console.log(`📋 获取到 ${tokenIds.length} 个挂单NFT`);

      if (tokenIds.length === 0) {
        setHasMore(false);
        if (!shouldAppend) {
          setNfts([]);
        }
        return;
      }

      // 2. Get complete NFT information in batches

      const nftInfoContracts = tokenIds.map(tokenId => ({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi as any,
        functionName: 'getNFTFullInfo',
        args: [tokenId],
      }));

      console.log('🎨 批量查询NFT完整信息...');
      const nftInfoResults = await readContracts(config, { contracts: nftInfoContracts });

      // 3. Bulk tokenURI

      const tokenURIContracts = tokenIds.map(tokenId => ({
        address: nftAddress as `0x${string}`,
        abi: GreenTalesNFTABI.abi as any,
        functionName: 'tokenURI',
        args: [tokenId],
      }));

      console.log('🔗 批量查询TokenURI...');
      const tokenURIResults = await readContracts(config, { contracts: tokenURIContracts });

      // 4. Assemble basic NFT data

      const newNFTs: MarketNFT[] = [];
      const tokenURIs: string[] = [];
      
      nftInfoResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [listing, storyMeta, tradeCount] = result.result as [any, any, bigint];
          const tokenId = tokenIds[index];
          const tokenURIResult = tokenURIResults[index];
          const tokenURI = tokenURIResult.status === 'success' ? tokenURIResult.result as string : '';

          // Make sure the order is active

          if (listing.isActive) {
            newNFTs.push({
              tokenId: tokenId.toString(),
              seller: listing.seller,
              price: listing.price.toString(),
              timestamp: listing.timestamp.toString(),
              isActive: listing.isActive,
              // Nft basic metadata

              storyTitle: storyMeta.storyTitle || `绿色NFT #${tokenId}`,
              storyDetail: storyMeta.storyDetail || '',
              carbonReduction: storyMeta.carbonReduction.toString(),
              createTime: storyMeta.createTime.toString(),
              initialPrice: storyMeta.initialPrice.toString(),
              lastPrice: storyMeta.lastPrice.toString(),
              // Transaction statistics

              tradeCount: Number(tradeCount),
              // Nft metadata information

              tokenURI: tokenURI,
              metadata: null, // Get it later

              imageUrl: null, // Set it later

            });
            tokenURIs.push(tokenURI);
          }
        }
      });

      console.log(`✅ 成功组装 ${newNFTs.length} 个基础NFT数据`);

      // 5. Bulk acquisition of NFT metadata

      if (newNFTs.length > 0 && tokenURIs.length > 0) {
        console.log('🎨 开始获取NFT元数据...');
        const metadataResults = await fetchBatchNFTMetadata(tokenURIs);
        
        // Associate metadata to nft

        newNFTs.forEach((nft, index) => {
          const metadata = metadataResults[index];
          nft.metadata = metadata;
          nft.imageUrl = metadata?.image || null;
        });

        console.log(`✅ 元数据获取完成，成功: ${metadataResults.filter(m => m !== null).length}/${newNFTs.length}`);
      }

      // 6. Update status

      if (shouldAppend) {
        setNfts(prev => [...prev, ...newNFTs]);
      } else {
        setNfts(newNFTs);
      }

      // 7. Check if there is more data

      if (newNFTs.length < limit) {
        setHasMore(false);
      }

    } catch (error) {
      console.error('❌ 获取市场NFT失败:', error);
      setError(error instanceof Error ? error.message : '获取市场数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [marketAddress, nftAddress, limit, config]);

  // Load more data

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const newOffset = offset + limit;
      setOffset(newOffset);
      setIsLoading(true);
      fetchMarketNFTs(newOffset, true);
    }
  };

  // Re-get data

  const refetch = () => {
    setOffset(0);
    setHasMore(true);
    setError(null);
    setIsLoading(true);
    fetchMarketNFTs(0, false);
    refetchStats();
  };

  // Initialize and monitor market statistics changes

  useEffect(() => {
    if (marketStats) {
      const [totalListings] = marketStats as [bigint, bigint];
      setTotalCount(Number(totalListings));
      console.log(`📊 市场统计 - 总挂单数: ${totalListings}`);
    }
  }, [marketStats]);

  // Initial loading

  useEffect(() => {
    if (marketAddress && nftAddress) {
      console.log('🚀 初始化市场NFT数据获取...');
      fetchMarketNFTs(0, false);
    }
  }, [marketAddress, nftAddress, chainId]);

  return {
    nfts,
    isLoading,
    error,
    totalCount,
    hasMore,
    loadMore,
    refetch,
  };
}; 