'use client';

import { useEventBasedSalesHistory } from './useEventBasedSalesHistory';

/**
 * User Sales History Hook
 * @description Specifically used to obtain users' NFT sales history and obtain real data through blockchain events
 * @returns User sales history data
 */
export const useUserSalesHistory = () => {
  // Directly use event-based sales history hooks (support cache)

  const { 
    salesHistory, 
    isLoading, 
    error,
    refetch,        // Incremental refresh

    forceRefresh,   // Force full refresh

    clearCache      // Clean up the cache

  } = useEventBasedSalesHistory();

  return {
    salesHistory,
    isLoading,
    error,
    refetch,        // Incremental refresh (retain history)

    forceRefresh,   // Force full refresh

    clearCache,     // Clean up the cache

  };
}; 