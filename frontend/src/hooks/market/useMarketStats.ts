'use client';

import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import { useMarketNFTs } from './useMarketNFTs';
import { useEventBasedSalesHistory } from './useEventBasedSalesHistory';
import { formatCarbonPrice } from '@/utils/formatUtils';

// 市场统计数据接口
export interface MarketStats {
  totalListings: number;     // 总挂单数
  totalUsers: number;        // 活跃用户数
  totalVolume: string;       // 总交易额（基于历史交易事件计算）
  averagePrice: string;      // 平均价格（当前挂单NFT的平均价格）
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
 * @description 获取市场的关键统计信息，通过查询历史事件计算交易额和价格统计
 * @returns 市场统计数据和操作方法
 */
export const useMarketStats = (): UseMarketStatsReturn => {
  const chainId = useChainId();
  
  // 获取市场NFT数据（用于计算平均价格）
  const { nfts } = useMarketNFTs(100); // 获取更多数据用于统计
  
  // 获取全市场销售历史（用于计算总交易额）
  const { salesHistory } = useEventBasedSalesHistory();

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

  // 计算总交易额
  const calculateTotalVolume = (): string => {
    if (!salesHistory || salesHistory.length === 0) return '0';
    
    console.log('🔍 计算总交易额，销售历史数据:', salesHistory.slice(0, 3)); // 查看前3条数据
    
    const total = salesHistory.reduce((sum, sale) => {
      // 使用formatCarbonPrice来正确处理wei格式的价格
      const rawPrice = sale.currentPrice || '0';
      const formattedPrice = formatCarbonPrice(rawPrice);
      // 解析时先移除逗号分隔符，避免parseFloat只解析到逗号前
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
    // 返回实际的交易总额，不进行wei转换
    return total.toString();
  };

  // 计算平均价格
  const calculateAveragePrice = (): string => {
    if (!nfts || nfts.length === 0) return '0';
    
    console.log('🔍 计算平均价格，所有NFT数据:', nfts.length, '个NFT'); // 查看总数
    console.log('📋 所有NFT详情:', nfts.map(nft => ({
      tokenId: nft.tokenId,
      priceRaw: nft.price,
      storyTitle: nft.storyTitle
    })));
    
    const priceDetails = [];
    const total = nfts.reduce((sum, nft) => {
      // 使用formatCarbonPrice来正确处理wei格式的价格
      const rawPrice = nft.price || '0';
      const formattedPrice = formatCarbonPrice(rawPrice);
      // 解析时先移除逗号分隔符，避免parseFloat只解析到逗号前
      const numPrice = parseFloat(formattedPrice.replace(/,/g, ''));
      
      const detail = {
        tokenId: nft.tokenId,
        title: nft.storyTitle,
        raw: rawPrice,
        formatted: formattedPrice,
        parsed: numPrice,
        修复前解析: parseFloat(formattedPrice), // 显示修复前的错误结果用于对比
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
    
    // 返回实际的平均价格，不进行wei转换
    return average.toString();
  };

  // 处理统计数据
  const processedStats: MarketStats | null = marketStats ? {
    totalListings: Number((marketStats as [bigint, bigint])[0]),
    totalUsers: Number((marketStats as [bigint, bigint])[1]),
    // 实时计算的统计数据
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