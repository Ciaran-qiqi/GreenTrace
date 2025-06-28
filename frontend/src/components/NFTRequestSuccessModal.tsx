'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface NFTRequestSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionHash?: string;
  tokenId?: string;
}

export const NFTRequestSuccessModal: React.FC<NFTRequestSuccessModalProps> = ({
  isOpen,
  onClose,
  transactionHash,
  tokenId
}) => {
  const router = useRouter();

  if (!isOpen) return null;

  // 处理继续创建
  const handleContinueCreate = () => {
    onClose();
  };

  // 处理查看记录 - 跳转到created页面
  const handleViewRecords = () => {
    onClose();
    router.push('/created');
  };

  // 生成区块链浏览器链接
  const getExplorerUrl = (hash: string) => {
    // Sepolia测试网浏览器
    return `https://sepolia.etherscan.io/tx/${hash}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
        {/* 成功图标 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">申请提交成功！</h2>
          <p className="text-gray-600">您的NFT铸造申请已成功提交</p>
        </div>

        {/* 申请信息 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="space-y-3">
            {tokenId && (
              <div className="flex justify-between">
                <span className="text-gray-600">申请ID:</span>
                <span className="font-mono text-sm">#{tokenId}</span>
              </div>
            )}
            {transactionHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">交易哈希:</span>
                <a 
                  href={getExplorerUrl(transactionHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-mono text-xs truncate max-w-32"
                  title={transactionHash}
                >
                  {`${transactionHash.slice(0, 6)}...${transactionHash.slice(-4)}`}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* 流程说明 */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">接下来的步骤:</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start">
              <span className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5">✓</span>
              <span>已提交申请并支付申请费用</span>
            </div>
            <div className="flex items-start">
              <span className="bg-gray-300 text-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5">2</span>
              <span>等待审计员审核您的环保行为</span>
            </div>
            <div className="flex items-start">
              <span className="bg-gray-300 text-gray-600 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-2 mt-0.5">3</span>
              <span>审核通过后支付铸造费用完成NFT创建</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          <button
            onClick={handleContinueCreate}
            className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            继续创建
          </button>
          <button
            onClick={handleViewRecords}
            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            查看记录
          </button>
        </div>
      </div>
    </div>
  );
}; 