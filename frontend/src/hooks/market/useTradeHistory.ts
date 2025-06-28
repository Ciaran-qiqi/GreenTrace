'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';

// 交易历史记录接口
export interface TradeRecord {
  tokenId: string;
  seller: string;
  buyer: string;
  price: string;
  timestamp: string;
  txHash?: string;
}

interface UseTradeHistoryParams {
  tokenId?: string; // 可选：特定NFT的交易历史
  userAddress?: string; // 可选：特定用户的交易历史
  limit?: number; // 限制返回数量
}

interface UseTradeHistoryReturn {
  // 数据
  trades: TradeRecord[];
  
  // 状态
  isLoading: boolean;
  error: string | null;
  
  // 操作函数
  refetch: () => void;
}

/**
 * 交易历史 Hook
 * @description 获取NFT的交易历史记录，支持按NFT或用户筛选
 * @param tokenId 可选：特定NFT的ID
 * @param userAddress 可选：特定用户地址
 * @param limit 返回记录数量限制
 * @returns 交易历史相关的数据和状态
 */
export const useTradeHistory = ({
  tokenId,
  userAddress,
  limit = 50
}: UseTradeHistoryParams = {}): UseTradeHistoryReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取市场合约地址
  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const marketAddress = getMarketAddress(chainId);

  // 暂时禁用直接从合约获取交易历史，因为getTradeHistory需要特定tokenId
  // 在实际应用中，应该通过事件监听或外部索引服务获取完整的交易历史

  // 处理交易历史数据
  const processTradeHistory = (rawData: any[]): TradeRecord[] => {
    if (!Array.isArray(rawData)) return [];

    return rawData.map((trade: any, index: number) => ({
      tokenId: trade.tokenId?.toString() || '',
      seller: trade.seller || '',
      buyer: trade.buyer || '',
      price: trade.price?.toString() || '0',
      timestamp: trade.timestamp?.toString() || Date.now().toString(),
      txHash: trade.txHash || '',
    })).filter(trade => {
      // 按用户筛选
      if (userAddress) {
        return trade.seller.toLowerCase() === userAddress.toLowerCase() || 
               trade.buyer.toLowerCase() === userAddress.toLowerCase();
      }
      return true;
    }).slice(0, limit); // 限制数量
  };

  // 获取交易历史
  const fetchTradeHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 暂时返回空数组，等待更好的实现方案
      // 实际项目中应该：
      // 1. 通过区块链事件日志获取
      // 2. 使用外部索引服务（如The Graph）
      // 3. 自建数据库存储交易记录
      console.log('📊 交易历史功能暂时禁用，等待实现');
      setTrades([]);
    } catch (err) {
      console.error('获取交易历史失败:', err);
      setError('获取交易历史失败');
      setTrades([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 手动刷新
  const refetch = () => {
    fetchTradeHistory();
  };

  // 监听数据变化
  useEffect(() => {
    fetchTradeHistory();
  }, [userAddress, tokenId, limit]);

  return {
    // 数据
    trades,
    
    // 状态
    isLoading,
    error,
    
    // 操作函数
    refetch,
  };
}; 