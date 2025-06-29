'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { MyListing } from './useMyListings';

// Cache data interface

interface CachedCancelHistory {
  version: string;
  userAddress: string;
  chainId: number;
  lastUpdated: number;
  lastBlockNumber: bigint | string;
  records: MyListing[];
}

const CANCEL_CACHE_KEY_PREFIX = 'cancel_history_';
const CANCEL_CACHE_VERSION = '1.0.0';

/**
 * Event-based cancellation of order history Hook
 * @description Get the user's cancellation order history by listening to the ListingCancelled event
 * @returns User cancellation of order history data
 */
export const useEventBasedCancelHistory = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [cancelHistory, setCancelHistory] = useState<MyListing[]>([]);
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

  // Get the cache key

  const getCacheKey = useCallback((userAddress: string, chainId: number): string => {
    return `${CANCEL_CACHE_KEY_PREFIX}${userAddress.toLowerCase()}_${chainId}`;
  }, []);

  // Load cached data from local storage

  const loadCachedData = useCallback((userAddress: string, chainId: number): CachedCancelHistory | null => {
    try {
      const cacheKey = getCacheKey(userAddress, chainId);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData) as CachedCancelHistory;
      
      // Verify cached data

      if (
        parsed.version !== CANCEL_CACHE_VERSION ||
        parsed.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
        parsed.chainId !== chainId
      ) {
        console.log('🗄️ 取消挂单缓存版本不匹配或用户变更，清理缓存');
        localStorage.removeItem(cacheKey);
        return null;
      }

      // Convert last block number in string format to big int

      if (typeof parsed.lastBlockNumber === 'string') {
        parsed.lastBlockNumber = BigInt(parsed.lastBlockNumber);
      }

      console.log(`📦 加载取消挂单缓存: ${parsed.records.length} 条记录`);
      return parsed;
    } catch (error) {
      console.error('❌ 加载取消挂单缓存失败:', error);
      return null;
    }
  }, [getCacheKey]);

  // Save data to local storage

  const saveCachedData = useCallback((
    userAddress: string, 
    chainId: number, 
    records: MyListing[], 
    lastBlockNumber: bigint
  ): void => {
    try {
      const cacheKey = getCacheKey(userAddress, chainId);
      const cacheData: CachedCancelHistory = {
        version: CANCEL_CACHE_VERSION,
        userAddress: userAddress.toLowerCase(),
        chainId,
        lastUpdated: Date.now(),
        lastBlockNumber,
        records: records.sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt)),
      };

      // Solve the big int serialization problem

      const jsonString = JSON.stringify(cacheData, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      });

      localStorage.setItem(cacheKey, jsonString);
      console.log(`💾 保存取消挂单缓存: ${records.length} 条记录`);
    } catch (error) {
      console.error('❌ 保存取消挂单缓存失败:', error);
    }
  }, [getCacheKey]);

  // Merge old and new records and remove the repetition

  const mergeRecords = useCallback((existingRecords: MyListing[], newRecords: MyListing[]): MyListing[] => {
    const recordMap = new Map<string, MyListing>();
    
    // Add an existing record

    existingRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-cancelled`;
      recordMap.set(key, record);
    });

    // Add a new record (skip if it already exists)

    let newCount = 0;
    newRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-cancelled`;
      if (!recordMap.has(key)) {
        recordMap.set(key, record);
        newCount++;
      }
    });

    console.log(`🔄 合并取消记录: 现有 ${existingRecords.length} 条，新增 ${newCount} 条，总计 ${recordMap.size} 条`);
    
    return Array.from(recordMap.values()).sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt));
  }, []);

  // Get cancellation order history

  const fetchCancelHistory = useCallback(async (forceRefresh: boolean = false) => {
    if (!address || !publicClient || !marketAddress) {
      setCancelHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 开始获取取消挂单历史...');

      // 1. Load cached data

      let cachedData: CachedCancelHistory | null = null;
      let existingRecords: MyListing[] = [];
      let fromBlock: bigint;
      
      if (!forceRefresh) {
        cachedData = loadCachedData(address, chainId);
        if (cachedData) {
          existingRecords = cachedData.records;
          fromBlock = cachedData.lastBlockNumber as bigint;
          console.log(`📅 增量查询取消记录从区块 ${fromBlock} 开始`);
        }
      }

      // 2. Determine the query scope

      const latestBlock = await publicClient.getBlockNumber();
      if (!cachedData || forceRefresh) {
        fromBlock = latestBlock - BigInt(100000);
        console.log(`📅 全量查询取消记录区块范围: ${fromBlock} - ${latestBlock}`);
      }

      // 3. If there is no new block, return cached data directly

      if (cachedData && fromBlock >= latestBlock) {
        console.log('✅ 没有新区块，使用取消记录缓存数据');
        setCancelHistory(existingRecords);
        setIsLoading(false);
        return;
      }

      // 4. ListingCancelled event ABI

      const listingCancelledEvent = parseAbiItem(
        'event ListingCancelled(uint256 indexed tokenId, address indexed seller, uint256 timestamp)'
      );

      // 5. Query ListingCancelled Events (user as seller)

      const cancelLogs = await publicClient.getLogs({
        address: marketAddress as `0x${string}`,
        event: listingCancelledEvent,
        args: {
          seller: address, // Users as sellers

        },
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(`❌ 找到 ${cancelLogs.length} 条新取消记录`);

      // 6. Build a new cancel record

      const newCancelRecords: MyListing[] = [];

      for (const log of cancelLogs) {
        try {
          const { tokenId, seller, timestamp } = log.args;
          
          if (!tokenId || !seller || !timestamp) {
            console.warn('⚠️ 取消事件数据不完整:', log);
            continue;
          }

          // Get nft metadata (title, etc.)

          let title = `绿色NFT #${tokenId}`;
          let carbonReduction = '0';
          let price = '0';
          
          try {
            // Here you can get the details of NFT through contract calls
            // Use default values ​​temporarily

          } catch (metaError) {
            console.warn(`⚠️ 获取取消的NFT #${tokenId} 元数据失败:`, metaError);
          }

          newCancelRecords.push({
            listingId: `cancelled-${tokenId}-${timestamp}`,
            tokenId: tokenId.toString(),
            title: title,
            carbonReduction: carbonReduction,
            currentPrice: price,
            originalPrice: price,
            listedAt: timestamp.toString(),
            status: 'cancelled',
            seller: seller,
            views: 0,
            offers: 0,
          });

        } catch (recordError) {
          console.error('❌ 处理取消记录失败:', recordError, log);
        }
      }

      // 7. Merge old and new records

      const mergedRecords = mergeRecords(existingRecords, newCancelRecords);

      // 8. Save to cache

      saveCachedData(address, chainId, mergedRecords, latestBlock);

      // 9. Update status

      setCancelHistory(mergedRecords);
      console.log(`✅ 取消挂单历史更新完成: 总计 ${mergedRecords.length} 条记录`);

    } catch (error) {
      console.error('❌ 获取取消挂单历史失败:', error);
      setError(error instanceof Error ? error.message : '获取取消历史失败');
      
      // If there is cached data, the cached data will still be displayed.

      if (address) {
        const cachedData = loadCachedData(address, chainId);
        if (cachedData) {
          console.log('🔄 使用取消记录缓存数据作为降级方案');
          setCancelHistory(cachedData.records);
        } else {
          setCancelHistory([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, marketAddress, chainId, loadCachedData, saveCachedData, mergeRecords]);

  // Clean up the cache

  const clearCache = useCallback(() => {
    if (address) {
      const cacheKey = getCacheKey(address, chainId);
      localStorage.removeItem(cacheKey);
      console.log('🗑️ 清理取消挂单缓存数据');
    }
  }, [address, chainId, getCacheKey]);

  // Force refresh

  const forceRefresh = useCallback(() => {
    fetchCancelHistory(true);
  }, [fetchCancelHistory]);

  // Listening dependency changes

  useEffect(() => {
    if (address && publicClient && marketAddress) {
      // First try to load cached data

      const cachedData = loadCachedData(address, chainId);
      if (cachedData) {
        setCancelHistory(cachedData.records);
        console.log(`📦 立即显示取消记录缓存: ${cachedData.records.length} 条记录`);
      }
      
      // Then perform incremental update

      fetchCancelHistory(false);
    } else {
      setCancelHistory([]);
    }
  }, [address, publicClient, marketAddress, chainId, fetchCancelHistory, loadCachedData]);

  // Manual refresh

  const refetch = useCallback(() => {
    fetchCancelHistory(false);
  }, [fetchCancelHistory]);

  return {
    cancelHistory,
    isLoading,
    error,
    refetch,
    forceRefresh,
    clearCache,
  };
}; 