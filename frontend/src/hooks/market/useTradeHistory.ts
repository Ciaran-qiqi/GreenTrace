'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';

// Transaction history interface

export interface TradeRecord {
  tokenId: string;
  seller: string;
  buyer: string;
  price: string;
  timestamp: string;
  txHash?: string;
}

interface UseTradeHistoryParams {
  tokenId?: string; // Optional: Transaction history for specific nfts

  userAddress?: string; // Optional: Transaction history for specific users

  limit?: number; // Limit the number of return

}

interface UseTradeHistoryReturn {
  // data

  trades: TradeRecord[];
  
  // state

  isLoading: boolean;
  error: string | null;
  
  // Operation functions

  refetch: () => void;
}

/**
 * Transaction History Hook
 * @description Get the transaction history of NFT, support filtering by NFT or user
 * @param tokenId Optional: ID of a specific NFT
 * @param userAddress Optional: Specific user address
 * @param limit Returns the limit on record count
 * @returns Data and status related to transaction history
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

  // Get the market contract address

  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const marketAddress = getMarketAddress(chainId);

  // Temporarily disable getting transaction history directly from the contract, because getTradeHistory requires a specific tokenId
  // In actual applications, the complete transaction history should be obtained through event listening or external indexing services


  // Process transaction history data

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
      // Filter by user

      if (userAddress) {
        return trade.seller.toLowerCase() === userAddress.toLowerCase() || 
               trade.buyer.toLowerCase() === userAddress.toLowerCase();
      }
      return true;
    }).slice(0, limit); // Limit quantity

  };

  // Get transaction history

  const fetchTradeHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Temporarily return an empty array, waiting for a better implementation solution
      // In actual projects, it should be:
      // 1. Get through blockchain event log
      // 2. Use external indexing services (such as The Graph)
      // 3. Built a self-built database to store transaction records

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

  // Manual refresh

  const refetch = () => {
    fetchTradeHistory();
  };

  // Listen to data changes

  useEffect(() => {
    fetchTradeHistory();
  }, [userAddress, tokenId, limit]);

  return {
    // data

    trades,
    
    // state

    isLoading,
    error,
    
    // Operation functions

    refetch,
  };
}; 