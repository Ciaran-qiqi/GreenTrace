'use client';

import React, { useState } from 'react';
import { useTradeHistory, TradeRecord } from '@/hooks/market/useTradeHistory';
import { formatContractPrice, formatCarbonReduction } from '@/utils/formatUtils';
import { formatContractTimestamp } from '@/utils/formatUtils';
import { useTranslation } from '@/hooks/useI18n';

interface TradeHistoryTableProps {
  tokenId?: string; // Optional: Transaction history for specific nfts

  userAddress?: string; // Optional: Transaction history for specific users

  limit?: number; // Limit the number of return

  className?: string;
}

/**
 * Transaction History Table Component
 * @description Shows the transaction history of NFT, supports filtering by NFT or user
 * @param tokenId Optional: ID of a specific NFT
 * @param userAddress Optional: Specific user address
 * @param limit Returns the limit on record count
 * @param className Style class name
 */
export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  tokenId,
  userAddress,
  limit = 50,
  className = ''
}) => {
  const { t, language } = useTranslation();
  const [sortBy, setSortBy] = useState<'timestamp' | 'price'>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Use transaction history hook

  const {
    trades,
    isLoading,
    error,
    refetch
  } = useTradeHistory({
    tokenId,
    userAddress,
    limit
  });

  // Sort transaction history

  const sortedTrades = React.useMemo(() => {
    return [...trades].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      if (sortBy === 'timestamp') {
        aValue = parseInt(a.timestamp);
        bValue = parseInt(b.timestamp);
      } else {
        aValue = parseFloat(a.price);
        bValue = parseFloat(b.price);
      }

      const result = sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      return result;
    });
  }, [trades, sortBy, sortOrder]);

  // Process sorting

  const handleSort = (field: 'timestamp' | 'price') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Truncated address display

  const shortAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get sort icon

  const getSortIcon = (field: 'timestamp' | 'price') => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-red-600 text-center">
          <div className="text-4xl mb-2">❌</div>
          <div className="font-medium mb-1">加载交易历史失败</div>
          <div className="text-sm mb-4">{error}</div>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* head */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold text-gray-800">
            📊 交易历史
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              共 {sortedTrades.length} 条记录
            </span>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? '刷新中...' : '🔄 刷新'}
            </button>
          </div>
        </div>
        {tokenId && (
          <p className="text-gray-600 text-sm">NFT #{tokenId} 的交易记录</p>
        )}
        {userAddress && (
          <p className="text-gray-600 text-sm">用户 {shortAddress(userAddress)} 的交易记录</p>
        )}
      </div>

      {/* Loading status */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">加载交易历史...</div>
        </div>
      ) : sortedTrades.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📈</div>
          <div className="text-gray-600 text-lg mb-2">暂无交易记录</div>
          <div className="text-gray-500 text-sm">
            {tokenId ? '该NFT尚未有交易记录' : '暂时没有相关的交易历史'}
          </div>
        </div>
      ) : (
        /* Transaction History Form */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NFT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    卖家
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    买家
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center">
                      交易价格 {getSortIcon('price')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center">
                      交易时间 {getSortIcon('timestamp')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedTrades.map((trade, index) => (
                  <tr key={`${trade.tokenId}-${trade.timestamp}-${index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        #{trade.tokenId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {shortAddress(trade.seller)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {shortAddress(trade.buyer)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {formatContractPrice(trade.price)} CARB
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatContractTimestamp(trade.timestamp, language)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        {trade.txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${trade.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="查看交易详情"
                          >
                            🔗
                          </a>
                        )}
                        <button
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="查看NFT详情"
                        >
                          👁️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination information */}
          {sortedTrades.length >= limit && (
            <div className="bg-gray-50 px-6 py-3 text-center">
              <div className="text-sm text-gray-500">
                显示最近 {limit} 条记录
                <button
                  onClick={() => window.location.reload()}
                  className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  查看更多
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 