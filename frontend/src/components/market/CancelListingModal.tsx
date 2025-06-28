'use client';

import React from 'react';
import { useCancelListing } from '@/hooks/market/useCancelListing';
import { formatContractPrice, formatCarbonReduction } from '@/utils/formatUtils';

interface CancelListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  listing: {
    tokenId: string;
    title: string;
    currentPrice: string;
    carbonReduction?: string;
    description?: string;
  };
}

/**
 * 取消挂单确认模态框组件
 * @description 提供取消NFT挂单的确认界面和操作
 * @param isOpen 是否显示模态框
 * @param onClose 关闭回调
 * @param onSuccess 取消成功回调
 * @param listing NFT挂单信息
 */
export const CancelListingModal: React.FC<CancelListingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  listing
}) => {
  // 使用取消挂单Hook
  const {
    isLoading,
    isSuccess,
    isError,
    errorMessage,
    cancelListing,
    reset
  } = useCancelListing({
    onSuccess: () => {
      onSuccess?.();
      handleClose();
    }
  });

  // 关闭模态框
  const handleClose = () => {
    reset();
    onClose();
  };

  // 确认取消挂单
  const handleConfirm = async () => {
    await cancelListing(listing.tokenId);
  };

  // 键盘事件处理
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-md w-full relative overflow-hidden">
        {/* 装饰性顶部渐变 */}
        <div className="h-1 bg-gradient-to-r from-red-400 via-orange-500 to-yellow-500"></div>
        
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              ❌ 取消挂单
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* 警告提示 */}
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start">
              <div className="text-orange-500 text-2xl mr-3">⚠️</div>
              <div>
                <div className="text-orange-800 font-medium mb-1">
                  确认取消挂单
                </div>
                <div className="text-orange-700 text-sm">
                  取消后，您的NFT将从市场下架，其他用户将无法购买。您可以稍后重新挂单。
                </div>
              </div>
            </div>
          </div>

          {/* NFT信息 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{listing.title}</h4>
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>Token ID:</span>
                <span className="font-medium">#{listing.tokenId}</span>
              </div>
              <div className="flex justify-between">
                <span>挂单价格:</span>
                <span className="font-medium text-red-600">{formatContractPrice(listing.currentPrice)} CARB</span>
              </div>
              {listing.carbonReduction && (
                <div className="flex justify-between">
                  <span>碳减排量:</span>
                  <span className="font-medium text-green-600">{formatCarbonReduction(listing.carbonReduction)}</span>
                </div>
              )}
            </div>
          </div>

          {/* 说明信息 */}
          <div className="mb-6 space-y-3">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 text-sm">
                <div className="font-medium mb-1">💡 取消挂单后</div>
                <ul className="space-y-1 text-xs">
                  <li>• NFT将立即从市场移除</li>
                  <li>• NFT将返回到您的资产中</li>
                  <li>• 您可以随时重新挂单</li>
                  <li>• 取消操作需要支付Gas费</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 错误提示 */}
          {errorMessage && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm">
                ❌ {errorMessage}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保留挂单
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              onKeyPress={handleKeyPress}
              className="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  取消中...
                </div>
              ) : (
                '❌ 确认取消'
              )}
            </button>
          </div>

          {/* 提示信息 */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>💡 取消挂单将产生Gas费用</p>
            <p>此操作不可撤销，请谨慎操作</p>
          </div>
        </div>
      </div>
    </div>
  );
}; 