'use client';

import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import { useMarketNFTs } from './useMarketNFTs';
import { useEventBasedSalesHistory } from './useEventBasedSalesHistory';
import { formatCarbonPrice } from '@/utils/formatUtils';

// Market statistics interface

export interface MarketStats {
  totalListings: number;     // Total number of pending orders

  totalUsers: number;        // Number of active users

  totalVolume: string;       // Total transaction volume (calculated based on historical transaction events)

  averagePrice: string;      // Average price (average price for currently pending orders NFT)

}

// Hook return type interface

export interface UseMarketStatsReturn {
  stats: MarketStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook for obtaining market statistics
 * @description Obtain key market statistics and calculate transaction volume and price statistics by querying historical events
 * @returns Market statistics and operation methods
 */
export const useMarketStats = (): UseMarketStatsReturn => {
  const chainId = useChainId();
  
  // Get market nft data (used to calculate average price)

  const { nfts } = useMarketNFTs(100); // Get more data for statistics

  
  // Get the market-wide sales history (used to calculate the total transaction volume)

  const { salesHistory } = useEventBasedSalesHistory();

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

  const marketAddress = getMarketAddress(chainId);

  // Get market statistics

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
      // Refresh data every 30 seconds

      refetchInterval: 30000,
    }
  });

  // Calculate the total transaction volume

  const calculateTotalVolume = (): string => {
    if (!salesHistory || salesHistory.length === 0) return '0';
    
    console.log('🔍 计算总交易额，销售历史数据:', salesHistory.slice(0, 3)); // View the first 3 data

    
    const total = salesHistory.reduce((sum, sale) => {
      // Use format carbon price to correctly handle price in wei format

      const rawPrice = sale.currentPrice || '0';
      const formattedPrice = formatCarbonPrice(rawPrice);
      // Remove the comma separator first when parsing to avoid parse float only before commas

      const numPrice = parseFloat(formattedPrice.replace(/,/g, ''));
      
      console.log('💰 价格转换:', {
        raw: rawPrice,
        formatted: formattedPrice,
        parsed: numPrice,
        解析前: formattedPrice,
        解析后: numPrice
      });
      
      return sum + numPrice;
    }, 0);
    
    console.log('📊 总交易额计算结果:', total);
    // Returns the actual transaction amount without wei conversion

    return total.toString();
  };

  // Calculate the average price

  const calculateAveragePrice = (): string => {
    if (!nfts || nfts.length === 0) return '0';
    
    console.log('🔍 计算平均价格，所有NFT数据:', nfts.length, '个NFT'); // View the total number

    console.log('📋 所有NFT详情:', nfts.map(nft => ({
      tokenId: nft.tokenId,
      priceRaw: nft.price,
      storyTitle: nft.storyTitle
    })));
    
    // 定义价格详情数组的类型
    const priceDetails: Array<{
      tokenId: string;
      title: string;
      raw: string;
      formatted: string;
      parsed: number;
      修复前解析: number;
      修复后解析: number;
    }> = [];
    
    const total = nfts.reduce((sum, nft) => {
      // Use format carbon price to correctly handle price in wei format

      const rawPrice = nft.price || '0';
      const formattedPrice = formatCarbonPrice(rawPrice);
      // Remove the comma separator first when parsing to avoid parse float only before commas

      const numPrice = parseFloat(formattedPrice.replace(/,/g, ''));
      
      const detail = {
        tokenId: nft.tokenId,
        title: nft.storyTitle,
        raw: rawPrice,
        formatted: formattedPrice,
        parsed: numPrice,
        修复前解析: parseFloat(formattedPrice), // Show error results before repair for comparison

        修复后解析: numPrice
      };
      priceDetails.push(detail);
      
      console.log('💰 NFT价格转换:', detail);
      
      return sum + numPrice;
    }, 0);
    
    const average = total / nfts.length;
    console.log('📊 平均价格计算详情:', { 
      参与计算的NFT数量: nfts.length,
      所有价格: priceDetails,
      总价格: total, 
      平均价格: average,
      数学验证: `(${priceDetails.map(p => p.parsed).join(' + ')}) / ${nfts.length} = ${average}`
    });
    
    // Returns the actual average price without wei conversion

    return average.toString();
  };

  // Process statistics

  const processedStats: MarketStats | null = marketStats ? {
    totalListings: Number((marketStats as [bigint, bigint])[0]),
    totalUsers: Number((marketStats as [bigint, bigint])[1]),
    // Real-time calculated statistics

    totalVolume: calculateTotalVolume(),
    averagePrice: calculateAveragePrice(),
  } : null;

  return {
    stats: processedStats,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}; 