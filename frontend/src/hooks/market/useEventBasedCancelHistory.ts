'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useChainId } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { MyListing } from './useMyListings';

// 缓存数据接口
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
 * 基于事件的取消挂单历史 Hook
 * @description 通过监听 ListingCancelled 事件来获取用户的取消挂单历史
 * @returns 用户取消挂单历史数据
 */
export const useEventBasedCancelHistory = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [cancelHistory, setCancelHistory] = useState<MyListing[]>([]);
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
    return `${CANCEL_CACHE_KEY_PREFIX}${userAddress.toLowerCase()}_${chainId}`;
  }, []);

  // 从本地存储加载缓存数据
  const loadCachedData = useCallback((userAddress: string, chainId: number): CachedCancelHistory | null => {
    try {
      const cacheKey = getCacheKey(userAddress, chainId);
      const cachedData = localStorage.getItem(cacheKey);
      
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData) as CachedCancelHistory;
      
      // 验证缓存数据
      if (
        parsed.version !== CANCEL_CACHE_VERSION ||
        parsed.userAddress.toLowerCase() !== userAddress.toLowerCase() ||
        parsed.chainId !== chainId
      ) {
        console.log('🗄️ 取消挂单缓存版本不匹配或用户变更，清理缓存');
        localStorage.removeItem(cacheKey);
        return null;
      }

      // 将字符串格式的lastBlockNumber转换为BigInt
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

  // 保存数据到本地存储
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

      // 解决BigInt序列化问题
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

  // 合并新旧记录，去重
  const mergeRecords = useCallback((existingRecords: MyListing[], newRecords: MyListing[]): MyListing[] => {
    const recordMap = new Map<string, MyListing>();
    
    // 添加现有记录
    existingRecords.forEach(record => {
      const key = `${record.tokenId}-${record.listedAt}-cancelled`;
      recordMap.set(key, record);
    });

    // 添加新记录（如果已存在则跳过）
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

  // 获取取消挂单历史
  const fetchCancelHistory = useCallback(async (forceRefresh: boolean = false) => {
    if (!address || !publicClient || !marketAddress) {
      setCancelHistory([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 开始获取取消挂单历史...');

      // 1. 加载缓存数据
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

      // 2. 确定查询范围
      const latestBlock = await publicClient.getBlockNumber();
      if (!cachedData || forceRefresh) {
        fromBlock = latestBlock - BigInt(100000);
        console.log(`📅 全量查询取消记录区块范围: ${fromBlock} - ${latestBlock}`);
      }

      // 3. 如果没有新区块，直接返回缓存数据
      if (cachedData && fromBlock >= latestBlock) {
        console.log('✅ 没有新区块，使用取消记录缓存数据');
        setCancelHistory(existingRecords);
        setIsLoading(false);
        return;
      }

      // 4. ListingCancelled 事件的 ABI
      const listingCancelledEvent = parseAbiItem(
        'event ListingCancelled(uint256 indexed tokenId, address indexed seller, uint256 timestamp)'
      );

      // 5. 查询 ListingCancelled 事件（用户作为卖家）
      const cancelLogs = await publicClient.getLogs({
        address: marketAddress as `0x${string}`,
        event: listingCancelledEvent,
        args: {
          seller: address, // 用户作为卖家
        },
        fromBlock: fromBlock,
        toBlock: 'latest',
      });

      console.log(`❌ 找到 ${cancelLogs.length} 条新取消记录`);

      // 6. 构建新的取消记录
      const newCancelRecords: MyListing[] = [];

      for (const log of cancelLogs) {
        try {
          const { tokenId, seller, timestamp } = log.args;
          
          if (!tokenId || !seller || !timestamp) {
            console.warn('⚠️ 取消事件数据不完整:', log);
            continue;
          }

          // 获取NFT元数据（标题等信息）
          let title = `绿色NFT #${tokenId}`;
          let carbonReduction = '0';
          let price = '0';
          
          try {
            // 这里可以通过合约调用获取NFT的详细信息
            // 暂时使用默认值
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

      // 7. 合并新旧记录
      const mergedRecords = mergeRecords(existingRecords, newCancelRecords);

      // 8. 保存到缓存
      saveCachedData(address, chainId, mergedRecords, latestBlock);

      // 9. 更新状态
      setCancelHistory(mergedRecords);
      console.log(`✅ 取消挂单历史更新完成: 总计 ${mergedRecords.length} 条记录`);

    } catch (error) {
      console.error('❌ 获取取消挂单历史失败:', error);
      setError(error instanceof Error ? error.message : '获取取消历史失败');
      
      // 出错时，如果有缓存数据，仍然显示缓存数据
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

  // 清理缓存
  const clearCache = useCallback(() => {
    if (address) {
      const cacheKey = getCacheKey(address, chainId);
      localStorage.removeItem(cacheKey);
      console.log('🗑️ 清理取消挂单缓存数据');
    }
  }, [address, chainId, getCacheKey]);

  // 强制刷新
  const forceRefresh = useCallback(() => {
    fetchCancelHistory(true);
  }, [fetchCancelHistory]);

  // 监听依赖变化
  useEffect(() => {
    if (address && publicClient && marketAddress) {
      // 首先尝试加载缓存数据
      const cachedData = loadCachedData(address, chainId);
      if (cachedData) {
        setCancelHistory(cachedData.records);
        console.log(`📦 立即显示取消记录缓存: ${cachedData.records.length} 条记录`);
      }
      
      // 然后进行增量更新
      fetchCancelHistory(false);
    } else {
      setCancelHistory([]);
    }
  }, [address, publicClient, marketAddress, chainId, fetchCancelHistory, loadCachedData]);

  // 手动刷新
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