'use client';

import React, { useState } from 'react';
import { NFTInfoSection } from './NFTInfoSection';

// NFT查看按钮组件Props
interface NFTViewButtonProps {
  nftTokenId: string;
  buttonText?: string;
  buttonStyle?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  nftExists?: boolean; // 可选：NFT是否存在的预检查结果
}

// NFT查看按钮组件
export const NFTViewButton: React.FC<NFTViewButtonProps> = ({
  nftTokenId,
  buttonText = '查看NFT',
  buttonStyle = 'primary',
  size = 'md',
  className = '',
  nftExists
}) => {
  const [showNFTModal, setShowNFTModal] = useState(false);

  // 获取弹窗主题色
  const getModalTheme = () => {
    switch (buttonStyle) {
      case 'primary':
        return {
          headerGradient: 'from-blue-400 to-blue-600',
          titleGradient: 'from-blue-600 to-blue-800',
          iconColor: 'text-blue-600'
        };
      case 'secondary':
        return {
          headerGradient: 'from-purple-400 to-purple-600',
          titleGradient: 'from-purple-600 to-purple-800',
          iconColor: 'text-purple-600'
        };
      case 'outline':
        return {
          headerGradient: 'from-blue-400 to-blue-600',
          titleGradient: 'from-blue-600 to-blue-800',
          iconColor: 'text-blue-600'
        };
      default:
        return {
          headerGradient: 'from-blue-400 to-blue-600',
          titleGradient: 'from-blue-600 to-blue-800',
          iconColor: 'text-blue-600'
        };
    }
  };

  const modalTheme = getModalTheme();

  // 获取按钮样式类名
  const getButtonClasses = () => {
    const baseClasses = 'font-medium rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center space-x-2';
    
    // 尺寸样式
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    // 样式主题
    const styleClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg',
      secondary: 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg',
      outline: 'border border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700'
    };

    return `${baseClasses} ${sizeClasses[size]} ${styleClasses[buttonStyle]} ${className}`;
  };

  return (
    <>
      {/* NFT查看按钮 */}
      <button
        onClick={() => setShowNFTModal(true)}
        className={getButtonClasses()}
      >
        <span>🎨</span>
        <span>{buttonText}</span>
      </button>

      {/* NFT信息专用弹窗 */}
      {showNFTModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-lg border-b border-gray-200/30 p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 bg-gradient-to-br ${modalTheme.headerGradient} rounded-full flex items-center justify-center`}>
                    <span className="text-white text-lg">🎨</span>
                  </div>
                  <h2 className={`text-3xl font-bold bg-gradient-to-r ${modalTheme.titleGradient} bg-clip-text text-transparent`}>
                    NFT #{nftTokenId}
                  </h2>
                </div>
                <button
                  onClick={() => setShowNFTModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200"
                >
                  <span className="text-xl">×</span>
                </button>
              </div>
            </div>
            
            {/* 弹窗内容 */}
            <div className="p-6">
              <NFTInfoSection 
                nftTokenId={nftTokenId}
                theme={buttonStyle === 'primary' || buttonStyle === 'outline' ? 'blue' : 'purple'}
                className="border-0 shadow-none bg-transparent p-0"
                nftExists={nftExists}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 