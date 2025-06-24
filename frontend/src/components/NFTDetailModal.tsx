'use client';

import React from 'react';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { type MintRecord } from '@/contracts/hooks/useNFTMintRecords';

// 状态标签组件
const StatusBadge: React.FC<{ status: MintRecord['status'] }> = ({ status }) => {
  const statusConfig = {
    pending: {
      label: '审计中',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⏳'
    },
    approved: {
      label: '已通过',
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    rejected: {
      label: '被拒绝',
      className: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
    },
    minted: {
      label: '已铸造',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: '🎉'
    }
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

// NFT详情弹窗组件
interface NFTDetailModalProps {
  record: MintRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onContinueMint?: (record: MintRecord) => void;
}

export const NFTDetailModal: React.FC<NFTDetailModalProps> = ({
  record,
  isOpen,
  onClose,
  onContinueMint
}) => {
  if (!isOpen || !record) return null;

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  // 处理铸造
  const handleContinueMint = () => {
    if (onContinueMint && record) {
      console.log('从详情弹窗开始铸造NFT:', record.tokenId);
      onContinueMint(record);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/50 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ top: 0, left: 0, right: 0, bottom: 0, position: 'fixed' }}>
      <div className="bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-2xl border border-gray-200/50 max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* 装饰性顶部渐变条 */}
        <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
        
        {/* 弹窗头部 */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-gray-50/80 to-white/80 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">🎨</span>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              NFT申请详情
            </h2>
            <StatusBadge status={record.status} />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 弹窗内容 - 添加滚动区域 */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6 space-y-6 bg-gradient-to-br from-white/90 via-gray-50/50 to-white/90">
            {/* 基本信息 */}
            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-xl p-5 border border-gray-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">📋</span>
                </span>
                基本信息
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-500">申请ID:</span>
                  <span className="ml-2 font-medium text-gray-800">#{record.tokenId}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500">申请时间:</span>
                  <span className="ml-2 font-medium text-gray-800">{formatTime(record.timestamp)}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500">申请费用:</span>
                  <span className="ml-2 font-medium text-green-600">{formatFeeAmount(record.totalFee)} CARB</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500">碳减排量:</span>
                  <span className="ml-2 font-medium text-blue-600">{record.carbonReduction} tCO₂e</span>
                </div>
              </div>
            </div>

            {/* NFT信息 */}
            <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-xl p-5 border border-blue-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">🎨</span>
                </span>
                NFT信息
              </h3>
              <div className="space-y-4">
                <div>
                  <span className="text-gray-500 text-sm font-medium">标题:</span>
                  <div className="mt-2 font-semibold text-gray-800 bg-white/70 p-3 rounded-lg border border-gray-200/50">
                    {record.title}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm font-medium">详情描述:</span>
                  <div className="mt-2 text-gray-700 bg-gradient-to-br from-gray-50 to-white p-4 rounded-lg border border-gray-200/50 shadow-inner">
                    {record.details}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm font-medium">元数据URI:</span>
                  <div className="mt-2 font-mono text-xs text-blue-600 bg-blue-50/50 p-3 rounded-lg border border-blue-200/50 break-all">
                    {record.tokenURI}
                  </div>
                </div>
              </div>
            </div>

            {/* 审计信息 */}
            {record.auditor && (
              <div className="bg-gradient-to-br from-white to-green-50/30 rounded-xl p-5 border border-green-200/50 shadow-sm">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                  <span className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center mr-2">
                    <span className="text-white text-xs">✅</span>
                  </span>
                  审计信息
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-500">审计员:</span>
                      <span className="ml-2 font-medium text-gray-800">{record.auditor}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-500">原始申请量:</span>
                      <span className="ml-2 font-medium text-blue-600">{record.carbonReduction} tCO₂e</span>
                    </div>
                  </div>
                  
                  {record.carbonValue && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50/50 border border-green-200 rounded-xl p-4 shadow-inner">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-green-700 font-medium">审计确认价值:</span>
                          <span className="ml-2 text-green-800 font-bold text-lg">
                            {record.carbonValue} tCO₂e
                          </span>
                        </div>
                        {record.carbonValue !== record.carbonReduction && (
                          <div className="flex items-center text-xs">
                            <span className={`px-2 py-1 rounded-full font-medium ${
                              parseFloat(record.carbonValue) > parseFloat(record.carbonReduction) 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {parseFloat(record.carbonValue) > parseFloat(record.carbonReduction) ? '↗ 上调' : '↘ 下调'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {record.carbonValue !== record.carbonReduction && (
                        <div className="text-xs text-green-600 mt-3 bg-white/50 p-2 rounded-lg">
                          审计员将碳减排量从 <span className="font-medium">{record.carbonReduction} tCO₂e</span> 调整为 <span className="font-medium">{record.carbonValue} tCO₂e</span>
                        </div>
                      )}
                      
                      <div className="text-xs text-green-600 mt-2 flex items-center">
                        <span className="w-4 h-4 bg-green-200 rounded-full flex items-center justify-center mr-2">
                          <span className="text-green-700 text-xs">ℹ</span>
                        </span>
                        这是审计员确认的实际碳减排量，将作为NFT的最终价值
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 审计意见 */}
            {record.reason && (
              <div className="bg-gradient-to-br from-white to-red-50/30 rounded-xl p-5 border border-red-200/50 shadow-sm">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                  <span className="w-6 h-6 bg-gradient-to-br from-red-400 to-rose-500 rounded-lg flex items-center justify-center mr-2">
                    <span className="text-white text-xs">❌</span>
                  </span>
                  审计意见
                </h3>
                <div className="bg-gradient-to-br from-red-50 to-rose-50/50 border border-red-200 rounded-xl p-4 shadow-inner">
                  <div className="flex items-start">
                    <span className="w-5 h-5 bg-red-200 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                      <span className="text-red-700 text-xs">!</span>
                    </span>
                    <div className="text-red-800 font-medium">{record.reason}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 状态说明 */}
            <div className="bg-gradient-to-br from-white to-indigo-50/30 rounded-xl p-5 border border-indigo-200/50 shadow-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">💡</span>
                </span>
                状态说明
              </h3>
              <div className={`rounded-xl p-4 shadow-inner border ${
                record.status === 'pending' ? 'bg-gradient-to-br from-yellow-50 to-amber-50/50 border-yellow-200' :
                record.status === 'approved' ? 'bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200' :
                record.status === 'rejected' ? 'bg-gradient-to-br from-red-50 to-rose-50/50 border-red-200' :
                'bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200'
              }`}>
                <div className="flex items-start">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 ${
                    record.status === 'pending' ? 'bg-yellow-200' :
                    record.status === 'approved' ? 'bg-green-200' :
                    record.status === 'rejected' ? 'bg-red-200' :
                    'bg-blue-200'
                  }`}>
                    <span className={`text-xs ${
                      record.status === 'pending' ? 'text-yellow-700' :
                      record.status === 'approved' ? 'text-green-700' :
                      record.status === 'rejected' ? 'text-red-700' :
                      'text-blue-700'
                    }`}>
                      {record.status === 'pending' ? '⏳' :
                       record.status === 'approved' ? '✅' :
                       record.status === 'rejected' ? '❌' : '🎉'}
                    </span>
                  </span>
                  <div className={`font-medium ${
                    record.status === 'pending' ? 'text-yellow-800' :
                    record.status === 'approved' ? 'text-green-800' :
                    record.status === 'rejected' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {record.status === 'pending' && (
                      <>
                        <strong>审计中:</strong> 您的NFT申请已提交，正在等待审计员审核。审核时间通常为1-3个工作日。
                      </>
                    )}
                    {record.status === 'approved' && (
                      <>
                        <strong>已通过:</strong> 恭喜！您的NFT申请已通过审计。现在可以支付铸造费用并完成NFT铸造。
                      </>
                    )}
                    {record.status === 'rejected' && (
                      <>
                        <strong>被拒绝:</strong> 很遗憾，您的NFT申请未通过审计。请根据审计意见修改后重新申请。
                      </>
                    )}
                    {record.status === 'minted' && (
                      <>
                        <strong>已铸造:</strong> 恭喜！您的NFT已成功铸造。您可以在&ldquo;我的资产&rdquo;中查看您的NFT。
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 弹窗底部 */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
          {record.status === 'approved' && onContinueMint && (
            <button
              onClick={handleContinueMint}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              开始铸造
            </button>
          )}
          {record.status === 'rejected' && (
            <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
              重新申请
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 