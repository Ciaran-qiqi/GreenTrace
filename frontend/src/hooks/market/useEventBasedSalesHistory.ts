'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { MyListing } from './useMyListings';

// Cache data interface

interface CachedSalesHistory {
  version: string;
  userAddress: string;
  chainId: number;
  lastUpdated: number;
  lastBlockNumber: bigint | string; // Support string format (parsed from json)

  records: MyListing[];
}

// Cache key name

const CACHE_KEY_PREFIX = 'sales_history_';
const CACHE_VERSION = '1.0.0';

/**
 * Event-based sales history Hook (local caching is supported)
 * @description By listening to blockchain events, obtaining the user's real NFT sales history, supporting local cache and incremental updates
 * @returns User sales history data
 */
export const useEventBasedSalesHistory = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [salesHistory, setSalesHistory] = useState<MyListing[]>([]);
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
    return `${CACHE_KEY_PREFIX}${userAddress.toLowerCase()}_${chainId}`;
  }, []);

  // Load cached data from local storage

  const loadCachedData = useCallback((userAddress: string, chainId: number): CachedSalesHistory | null => {
    try {
      const cacheKey = getCacheKey(userAddress, chainId);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData) as CachedSalesHistory;
      
      // Verify cached data

      if (
        parsed.version !== CACHE_VERSION ||
        parsed.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
        parsed.chainId !== chainId
      ) {
        console.log('🗄️ 缓存版本不匹配或用户变更，清理缓存');
        localStorage.removeItem(cacheKey);
        return null;
      }

             // Convert last block number in string format to big int

       if (typeof parsed.lastBlockNumber === 'string') {
         parsed.lastBlockNumber = BigInt(parsed.lastBlockNumber);
       }

       console.log(`📦 加载本地缓存: ${parsed.records.length} 条记录，最后更新: ${new Date(parsed.lastUpdated).toLocaleString()}`);
       return parsed;
    } catch (error) {
      console.error('❌ 加载缓存数据失败:', error);
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
      const cacheData: CachedSalesHistory = {
        version: CACHE_VERSION,
        userAddress: userAddress.toLowerCase(),
        chainId,
        lastUpdated: Date.now(),
        lastBlockNumber,
        records: records.sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt)), // Sort by time

      };

      // Solve the big int serialization problem

      const jsonString = JSON.stringify(cacheData, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      });

      localStorage.setItem(cacheKey, jsonString);
      console.log(`💾 保存缓存数据: ${records.length} 条记录`);
    } catch (error) {
      console.error('❌ 保存缓存数据失败:', error);
    }
  }, [getCacheKey]);

  // Merge old and new records and remove the repetition

  const mergeRecords = useCallback((existingRecords: MyListing[], newRecords: MyListing[]): MyListing[] => {
    const recordMap = new Map<string, MyListing>();
    
    // Add an existing record

    existingRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-${record.status}`;
      recordMap.set(key, record);
    });

    // Add a new record (skip if it already exists)

    let newCount = 0;
    newRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-${record.status}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, record);
        newCount++;
      }
    });

    console.log(`🔄 合并记录: 现有 ${existingRecords.length} 条，新增 ${newCount} 条，总计 ${recordMap.size} 条`);
    
    // Convert to array and sort by time

    return Array.from(recordMap.values()).sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt));
  }, []);

  // Get sales history (support incremental updates)

  const fetchSalesHistory = useCallback(async (forceRefresh: boolean = false) => {
    if (!address || !publicClient || !marketAddress) {
      setSalesHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 开始获取基于事件的销售历史...');

      // 1. Load cached data

      let cachedData: CachedSalesHistory | null = null;
      let existingRecords: MyListing[] = [];
      let fromBlock: bigint = BigInt(0);
      
      if (!forceRefresh) {
        cachedData = loadCachedData(address, chainId);
        if (cachedData) {
          existingRecords = cachedData.records;
          fromBlock = typeof cachedData.lastBlockNumber === 'string'
            ? BigInt(cachedData.lastBlockNumber)
            : cachedData.lastBlockNumber;
          console.log(`📅 增量查询从区块 ${fromBlock} 开始`);
        }
      }

      // 2. Determine the query scope

      const latestBlock = await publicClient.getBlockNumber();
      if (!cachedData || forceRefresh) {
        fromBlock = latestBlock - BigInt(100000);
        console.log(`📅 全量查询区块范围: ${fromBlock} - ${latestBlock}`);
      }
      // 保底赋值，防止未赋值
      if (fromBlock === undefined) {
        fromBlock = BigInt(0);
      }

      // 3. If there is no new block, return cached data directly

      if (cachedData && fromBlock >= latestBlock) {
        console.log('✅ 没有新区块，使用缓存数据');
        setSalesHistory(existingRecords);
        setIsLoading(false);
        return;
      }

      // 4. ABI of NFTSold Event

      const nftSoldEvent = parseAbiItem(
        'event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 platformFee, uint256 sellerAmount, uint256 timestamp)'
      );

      // ABI of NFTListed Event (used to get the original pending order price)

      const nftListedEvent = parseAbiItem(
        'event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 timestamp)'
      );

      // 5. Query the NFTSold event (user as seller)

      const soldLogs = await publicClient.getLogs({
        address: marketAddress as `0x${string}`,
        event: nftSoldEvent,
        args: {
          seller: address, // Users as sellers

        },
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(`💰 找到 ${soldLogs.length} 条新销售记录`);

      // 6. Build a new sales history

      const newSalesRecords: MyListing[] = [];

      for (const log of soldLogs) {
        try {
          const { tokenId, seller, buyer, price, timestamp } = log.args;
          
          if (!tokenId || !seller || !buyer || !price || !timestamp) {
            console.warn('⚠️ 事件数据不完整:', log);
            continue;
          }

          // Try to get the original pending order price (by querying the last pending order event of that nft)

          let originalPrice = price; // Default transaction price

          
          try {
            const listingLogs = await publicClient.getLogs({
              address: marketAddress as `0x${string}`,
              event: nftListedEvent,
              args: {
                tokenId: tokenId,
                seller: seller,
              },
              fromBlock: latestBlock - BigInt(100000), // Query a larger range to find pending order records

              toBlock: log.blockNumber, // Only check before sale

            });

            // Get the latest pending order price

            if (listingLogs.length > 0) {
              const latestListingLog = listingLogs[listingLogs.length - 1];
              originalPrice = latestListingLog.args.price || price;
            }
          } catch (listingError) {
            console.warn(`⚠️ 获取NFT #${tokenId} 挂单价格失败:`, listingError);
          }

          // Get nft metadata (title, etc.)

          const title = `绿色NFT #${tokenId}`;
          const carbonReduction = '0';
          
          try {
            // Here you can get the details of NFT through contract calls
            // Use the default value temporarily. You can call the tokenURI or metadata related methods of the NFT contract in the actual project.

          } catch (metaError) {
            console.warn(`⚠️ 获取NFT #${tokenId} 元数据失败:`, metaError);
          }

          newSalesRecords.push({
            listingId: `sold-${tokenId}-${timestamp}`,
            tokenId: tokenId.toString(),
            title: title,
            carbonReduction: carbonReduction,
            currentPrice: price.toString(),
            originalPrice: originalPrice.toString(),
            listedAt: timestamp.toString(),
            status: 'sold',
            seller: seller,
            views: 0, // No browsing data in the event

            offers: 0, // No quotation data in the event

          });

        } catch (recordError) {
          console.error('❌ 处理销售记录失败:', recordError, log);
        }
      }

      // 7. Merge old and new records

      const mergedRecords = mergeRecords(existingRecords, newSalesRecords);

      // 8. Save to cache

      saveCachedData(address, chainId, mergedRecords, latestBlock);

      // 9. Update status

      setSalesHistory(mergedRecords);
      console.log(`✅ 销售历史更新完成: 总计 ${mergedRecords.length} 条记录`);

    } catch (error) {
      console.error('❌ 获取事件销售历史失败:', error);
      setError(error instanceof Error ? error.message : '获取销售历史失败');
      
      // If there is cached data, the cached data will still be displayed.

      if (address) {
        const cachedData = loadCachedData(address, chainId);
        if (cachedData) {
          console.log('🔄 使用缓存数据作为降级方案');
          setSalesHistory(cachedData.records);
        } else {
          setSalesHistory([]);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, marketAddress, chainId, loadCachedData, saveCachedData, mergeRecords]);

  // Clean up caches for specific users

  const clearCache = useCallback(() => {
    if (address) {
      const cacheKey = getCacheKey(address, chainId);
      localStorage.removeItem(cacheKey);
      console.log('🗑️ 清理缓存数据');
    }
  }, [address, chainId, getCacheKey]);

  // Force refresh (ignoring cache)

  const forceRefresh = useCallback(() => {
    fetchSalesHistory(true);
  }, [fetchSalesHistory]);

  // Listening dependency changes

  useEffect(() => {
    if (address && publicClient && marketAddress) {
      // First try to load cached data

      const cachedData = loadCachedData(address, chainId);
      if (cachedData) {
        setSalesHistory(cachedData.records);
        console.log(`📦 立即显示缓存数据: ${cachedData.records.length} 条记录`);
      }
      
      // Then perform incremental update

      fetchSalesHistory(false);
    } else {
      setSalesHistory([]);
    }
  }, [address, publicClient, marketAddress, chainId, fetchSalesHistory, loadCachedData]);

  // Manual refresh (incremental update)

  const refetch = useCallback(() => {
    fetchSalesHistory(false);
  }, [fetchSalesHistory]);

  return {
    salesHistory,
    isLoading,
    error,
    refetch,        // Incremental refresh

    forceRefresh,   // Force full refresh

    clearCache,     // Clean up the cache

  };
}; 