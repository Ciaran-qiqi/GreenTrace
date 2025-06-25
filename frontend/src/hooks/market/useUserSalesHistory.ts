'use client';

import { useEventBasedSalesHistory } from './useEventBasedSalesHistory';

/**
 * 用户销售历史 Hook
 * @description 专门用于获取用户的NFT销售历史记录，通过区块链事件获取真实数据
 * @returns 用户销售历史数据
 */
export const useUserSalesHistory = () => {
  // 直接使用基于事件的销售历史Hook（支持缓存）
  const { 
    salesHistory, 
    isLoading, 
    error,
    refetch,        // 增量刷新
    forceRefresh,   // 强制全量刷新
    clearCache      // 清理缓存
  } = useEventBasedSalesHistory();

  return {
    salesHistory,
    isLoading,
    error,
    refetch,        // 增量刷新（保留历史记录）
    forceRefresh,   // 强制全量刷新
    clearCache,     // 清理缓存
  };
}; 