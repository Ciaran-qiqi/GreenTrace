'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { TradeHistoryTable } from './TradeHistoryTable';

interface PurchaseHistoryProps {
  className?: string;
}

/**
 * Purchase history components
 * @description Display the current user's NFT purchase history
 * @param className Style class name
 */
export const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({
  className = ''
}) => {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-4xl mb-4">🔐</div>
        <div className="text-gray-600 text-lg mb-2">请连接钱包</div>
        <div className="text-gray-500 text-sm">连接钱包后查看您的购买历史</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Head instructions */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <div className="text-blue-500 text-2xl mr-3">🛒</div>
          <div>
            <div className="text-blue-800 font-medium mb-1">
              购买历史记录
            </div>
            <div className="text-blue-700 text-sm">
              这里显示您购买的所有NFT记录，包括交易价格、时间和卖家信息。
            </div>
          </div>
        </div>
      </div>

      {/* Use the trade history table component to filter the records of the current user as the buyer */}
      <TradeHistoryTable
        userAddress={address}
        limit={100}
        className="purchase-history"
      />
    </div>
  );
}; 