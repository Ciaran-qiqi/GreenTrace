'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { MyListing } from './useMyListings';

// 缓存数据接口
interface CachedSalesHistory {
  version: string;
  userAddress: string;
  chainId: number;
  lastUpdated: number;
  lastBlockNumber: bigint | string; // 支持字符串格式（从JSON解析）
  records: MyListing[];
}

// 缓存键名
const CACHE_KEY_PREFIX = 'sales_history_';
const CACHE_VERSION = '1.0.0';

/**
 * 基于事件的销售历史 Hook（支持本地缓存）
 * @description 通过监听区块链事件来获取用户的真实NFT销售历史，支持本地缓存和增量更新
 * @returns 用户销售历史数据
 */
export const useEventBasedSalesHistory = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [salesHistory, setSalesHistory] = useState<MyListing[]>([]);
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

  // 获取缓存键
  const getCacheKey = useCallback((userAddress: string, chainId: number): string => {
    return `${CACHE_KEY_PREFIX}${userAddress.toLowerCase()}_${chainId}`;
  }, []);

  // 从本地存储加载缓存数据
  const loadCachedData = useCallback((userAddress: string, chainId: number): CachedSalesHistory | null => {
    try {
      const cacheKey = getCacheKey(userAddress, chainId);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData) as CachedSalesHistory;
      
      // 验证缓存数据
      if (
        parsed.version !== CACHE_VERSION ||
        parsed.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
        parsed.chainId !== chainId
      ) {
        console.log('🗄️ 缓存版本不匹配或用户变更，清理缓存');
        localStorage.removeItem(cacheKey);
        return null;
      }

             // 将字符串格式的lastBlockNumber转换为BigInt
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

  // 保存数据到本地存储
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
        records: records.sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt)), // 按时间排序
      };

      // 解决BigInt序列化问题
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

  // 合并新旧记录，去重
  const mergeRecords = useCallback((existingRecords: MyListing[], newRecords: MyListing[]): MyListing[] => {
    const recordMap = new Map<string, MyListing>();
    
    // 添加现有记录
    existingRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-${record.status}`;
      recordMap.set(key, record);
    });

    // 添加新记录（如果已存在则跳过）
    let newCount = 0;
    newRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-${record.status}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, record);
        newCount++;
      }
    });

    console.log(`🔄 合并记录: 现有 ${existingRecords.length} 条，新增 ${newCount} 条，总计 ${recordMap.size} 条`);
    
    // 转换为数组并按时间排序
    return Array.from(recordMap.values()).sort((a, b) => parseInt(b.listedAt) - parseInt(a.listedAt));
  }, []);

  // 获取销售历史（支持增量更新）
  const fetchSalesHistory = useCallback(async (forceRefresh: boolean = false) => {
    if (!address || !publicClient || !marketAddress) {
      setSalesHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 开始获取基于事件的销售历史...');

      // 1. 加载缓存数据
      let cachedData: CachedSalesHistory | null = null;
      let existingRecords: MyListing[] = [];
      let fromBlock: bigint;
      
      if (!forceRefresh) {
        cachedData = loadCachedData(address, chainId);
        if (cachedData) {
          existingRecords = cachedData.records;
          fromBlock = cachedData.lastBlockNumber; // 从上次查询的区块开始
          console.log(`📅 增量查询从区块 ${fromBlock} 开始`);
        }
      }

      // 2. 确定查询范围
      const latestBlock = await publicClient.getBlockNumber();
      if (!cachedData || forceRefresh) {
        // 首次查询或强制刷新，查询最近100,000个区块
        fromBlock = latestBlock - BigInt(100000);
        console.log(`📅 全量查询区块范围: ${fromBlock} - ${latestBlock}`);
      } else {
        console.log(`📅 增量查询区块范围: ${fromBlock} - ${latestBlock}`);
      }

      // 3. 如果没有新区块，直接返回缓存数据
      if (cachedData && fromBlock >= latestBlock) {
        console.log('✅ 没有新区块，使用缓存数据');
        setSalesHistory(existingRecords);
        setIsLoading(false);
        return;
      }

      // 4. NFTSold 事件的 ABI
      const nftSoldEvent = parseAbiItem(
        'event NFTSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 platformFee, uint256 sellerAmount, uint256 timestamp)'
      );

      // NFTListed 事件的 ABI（用于获取原始挂单价格）
      const nftListedEvent = parseAbiItem(
        'event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, uint256 timestamp)'
      );

      // 5. 查询 NFTSold 事件（用户作为卖家）
      const soldLogs = await publicClient.getLogs({
        address: marketAddress as `0x${string}`,
        event: nftSoldEvent,
        args: {
          seller: address, // 用户作为卖家
        },
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(`💰 找到 ${soldLogs.length} 条新销售记录`);

      // 6. 构建新的销售历史记录
      const newSalesRecords: MyListing[] = [];

      for (const log of soldLogs) {
        try {
          const { tokenId, seller, buyer, price, sellerAmount, timestamp } = log.args;
          
          if (!tokenId || !seller || !buyer || !price || !timestamp) {
            console.warn('⚠️ 事件数据不完整:', log);
            continue;
          }

          // 尝试获取原始挂单价格（通过查询该NFT的最后一次挂单事件）
          let originalPrice = price; // 默认使用成交价
          
          try {
            const listingLogs = await publicClient.getLogs({
              address: marketAddress as `0x${string}`,
              event: nftListedEvent,
              args: {
                tokenId: tokenId,
                seller: seller,
              },
              fromBlock: latestBlock - BigInt(100000), // 查询更大的范围找到挂单记录
              toBlock: log.blockNumber, // 只查询到售出之前
            });

            // 获取最新的挂单价格
            if (listingLogs.length > 0) {
              const latestListingLog = listingLogs[listingLogs.length - 1];
              originalPrice = latestListingLog.args.price || price;
            }
          } catch (listingError) {
            console.warn(`⚠️ 获取NFT #${tokenId} 挂单价格失败:`, listingError);
          }

          // 获取NFT元数据（标题等信息）
          let title = `绿色NFT #${tokenId}`;
          let carbonReduction = '0';
          
          try {
            // 这里可以通过合约调用获取NFT的详细信息
            // 暂时使用默认值，实际项目中可以调用NFT合约的tokenURI或metadata相关方法
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
            views: 0, // 事件中没有浏览数据
            offers: 0, // 事件中没有报价数据
          });

        } catch (recordError) {
          console.error('❌ 处理销售记录失败:', recordError, log);
        }
      }

      // 7. 合并新旧记录
      const mergedRecords = mergeRecords(existingRecords, newSalesRecords);

      // 8. 保存到缓存
      saveCachedData(address, chainId, mergedRecords, latestBlock);

      // 9. 更新状态
      setSalesHistory(mergedRecords);
      console.log(`✅ 销售历史更新完成: 总计 ${mergedRecords.length} 条记录`);

    } catch (error) {
      console.error('❌ 获取事件销售历史失败:', error);
      setError(error instanceof Error ? error.message : '获取销售历史失败');
      
      // 出错时，如果有缓存数据，仍然显示缓存数据
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

  // 清理特定用户的缓存
  const clearCache = useCallback(() => {
    if (address) {
      const cacheKey = getCacheKey(address, chainId);
      localStorage.removeItem(cacheKey);
      console.log('🗑️ 清理缓存数据');
    }
  }, [address, chainId, getCacheKey]);

  // 强制刷新（忽略缓存）
  const forceRefresh = useCallback(() => {
    fetchSalesHistory(true);
  }, [fetchSalesHistory]);

  // 监听依赖变化
  useEffect(() => {
    if (address && publicClient && marketAddress) {
      // 首先尝试加载缓存数据
      const cachedData = loadCachedData(address, chainId);
      if (cachedData) {
        setSalesHistory(cachedData.records);
        console.log(`📦 立即显示缓存数据: ${cachedData.records.length} 条记录`);
      }
      
      // 然后进行增量更新
      fetchSalesHistory(false);
    } else {
      setSalesHistory([]);
    }
  }, [address, publicClient, marketAddress, chainId, fetchSalesHistory, loadCachedData]);

  // 手动刷新（增量更新）
  const refetch = useCallback(() => {
    fetchSalesHistory(false);
  }, [fetchSalesHistory]);

  return {
    salesHistory,
    isLoading,
    error,
    refetch,        // 增量刷新
    forceRefresh,   // 强制全量刷新
    clearCache,     // 清理缓存
  };
}; 