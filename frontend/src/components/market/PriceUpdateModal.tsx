'use client';

import React, { useState, useEffect } from 'react';
import { useUpdatePrice } from '@/hooks/market/useUpdatePrice';
import { formatCarbonPrice } from '@/utils/formatUtils';

interface PriceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  listing: {
    tokenId: string;
    title: string;
    currentPrice: string;
    originalPrice?: string;
  };
}

/**
 * Update price modal box components
 * @description Provides a user interface to update NFT pending order prices
 * @param isOpen Whether to display the modal box
 * @param onClose Close callback
 * @param onSuccess Update successfully callback
 * @param listing NFT order information
 */
export const PriceUpdateModal: React.FC<PriceUpdateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  listing
}) => {
  const [newPrice, setNewPrice] = useState('');
  const [priceError, setPriceError] = useState('');

  // Use update price hook

  const {
    isLoading,
    isSuccess,
    isError,
    errorMessage,
    updatePrice,
    reset
  } = useUpdatePrice({
    onSuccess: () => {
      onSuccess?.();
      handleClose();
    }
  });

  // Initialized price

  useEffect(() => {
    if (isOpen && listing.currentPrice) {
      // Convert wei to Ethernet unit display

      const currentPriceInEth = parseFloat(listing.currentPrice) / 1e18;
      setNewPrice(currentPriceInEth.toString());
    }
  }, [isOpen, listing.currentPrice]);

  // Close the modal box

  const handleClose = () => {
    setNewPrice('');
    setPriceError('');
    reset();
    onClose();
  };

  // Price verification

  const validatePrice = (price: string): boolean => {
    const priceValue = parseFloat(price);
    
    if (isNaN(priceValue)) {
      setPriceError('请输入有效的数字');
      return false;
    }
    
    if (priceValue <= 0) {
      setPriceError('价格必须大于0');
      return false;
    }
    
    if (priceValue > 1000000) {
      setPriceError('价格不能超过1,000,000 CARB');
      return false;
    }

    setPriceError('');
    return true;
  };

  // Process price input

  const handlePriceChange = (value: string) => {
    setNewPrice(value);
    if (value) {
      validatePrice(value);
    } else {
      setPriceError('');
    }
  };

  // Submit update

  const handleSubmit = async () => {
    if (!validatePrice(newPrice)) {
      return;
    }

    const currentPriceInEth = parseFloat(listing.currentPrice) / 1e18;
    const newPriceValue = parseFloat(newPrice);
    
    if (newPriceValue === currentPriceInEth) {
      setPriceError('新价格与当前价格相同');
      return;
    }

    await updatePrice(listing.tokenId, newPrice);
  };

  // Keyboard event handling

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-md w-full relative overflow-hidden">
        {/* Decorative top gradient */}
        <div className="h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500"></div>
        
        {/* head */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-800">
              💰 更新价格
            </h3>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg text-lg"
            >
              ×
            </button>
          </div>
        </div>

        {/* content */}
        <div className="p-6">
          {/* Nft information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">{listing.title}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Token ID: <span className="font-medium">#{listing.tokenId}</span></div>
              <div>当前价格: <span className="font-medium text-blue-600">{formatCarbonPrice(listing.currentPrice)} CARB</span></div>
              {listing.originalPrice && listing.originalPrice !== listing.currentPrice && (
                <div>原价格: <span className="text-gray-500 line-through">{formatCarbonPrice(listing.originalPrice)} CARB</span></div>
              )}
            </div>
          </div>

          {/* Price input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              新价格 (CARB)
            </label>
            <div className="relative">
              <input
                type="number"
                value={newPrice}
                onChange={(e) => handlePriceChange(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入新的价格..."
                step="0.1"
                min="0.1"
                max="1000000"
                disabled={isLoading}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  priceError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              <div className="absolute right-3 top-3 text-gray-400 text-sm">
                CARB
              </div>
            </div>
            
            {/* Error message */}
            {priceError && (
              <div className="mt-2 text-red-500 text-sm">
                ⚠️ {priceError}
              </div>
            )}
            
            {/* Hook error message */}
            {errorMessage && (
              <div className="mt-2 text-red-500 text-sm">
                ❌ {errorMessage}
              </div>
            )}
          </div>

          {/* Price change tips */}
          {newPrice && !priceError && (
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 text-sm">
                <div className="flex items-center justify-between">
                  <span>当前:</span>
                  <span className="font-medium">{formatContractPrice(listing.currentPrice)} CARB</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span>更新为:</span>
                  <span className="font-medium">{parseFloat(newPrice).toFixed(2)} CARB</span>
                </div>
                <hr className="my-2 border-blue-200" />
                <div className="flex items-center justify-between font-medium">
                  <span>变化:</span>
                  <span className={parseFloat(newPrice) > (parseFloat(listing.currentPrice) / 1e18) ? 'text-green-600' : 'text-red-600'}>
                    {parseFloat(newPrice) > (parseFloat(listing.currentPrice) / 1e18) ? '+' : ''}
                    {(parseFloat(newPrice) - (parseFloat(listing.currentPrice) / 1e18)).toFixed(2)} CARB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Operation button */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !!priceError || !newPrice}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  更新中...
                </div>
              ) : (
                '💰 更新价格'
              )}
            </button>
          </div>

          {/* Prompt information */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>💡 更新价格将产生Gas费用</p>
            <p>价格更新后立即生效</p>
          </div>
        </div>
      </div>
    </div>
  );
}; 