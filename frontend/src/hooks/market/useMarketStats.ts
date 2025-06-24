'use client';

import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';

// 市场统计数据接口
export interface MarketStats {
  totalListings: number;     // 总挂单数
  totalUsers: number;        // 活跃用户数
  totalVolume?: string;      // 总交易额（未来扩展）
  averagePrice?: string;     // 平均价格（未来扩展）
}

// Hook返回类型接口
export interface UseMarketStatsReturn {
  stats: MarketStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * 获取市场统计数据的Hook
 * @description 获取市场的关键统计信息，如总挂单数、活跃用户数等
 * @returns 市场统计数据和操作方法
 */
export const useMarketStats = (): UseMarketStatsReturn => {
  const chainId = useChainId();

  // 获取合约地址
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

  const marketAddress = getMarketAddress(chainId);

  // 获取市场统计信息
  const { 
    data: marketStats, 
    isLoading, 
    error, 
    refetch 
  } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: GreenTalesMarketABI.abi,
    functionName: 'getListingStats',
    query: {
      enabled: !!marketAddress,
      // 每30秒刷新一次数据
      refetchInterval: 30000,
    }
  });

  // 处理统计数据
  const processedStats: MarketStats | null = marketStats ? {
    totalListings: Number((marketStats as [bigint, bigint])[0]),
    totalUsers: Number((marketStats as [bigint, bigint])[1]),
    // 未来可以扩展更多统计数据
    totalVolume: undefined,
    averagePrice: undefined,
  } : null;

  return {
    stats: processedStats,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}; 