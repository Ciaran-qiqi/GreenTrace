'use client';

import React from 'react';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';

// 通用申请记录接口
export interface RequestRecord {
  tokenId: number | string;
  title: string;
  details: string;
  carbonReduction: string;
  tokenURI?: string;
  totalFee: string;
  status: 'pending' | 'approved' | 'rejected' | 'minted';
  timestamp: number | string;
  auditor?: string;
  carbonValue?: string;
  reason?: string;
  transactionHash?: string;
  source?: 'event' | 'contract';
  // 审计中心特有字段
  auditStatus?: 'pending' | 'approved' | 'rejected';
  auditedCarbonValue?: string;
  auditComment?: string;
  nftTokenId?: string;
  requester?: string;
  blockTimestamp?: string;
  requestId?: string;
}

// 状态标签组件
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: '待审计',
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          icon: '⏳'
        };
      case 'approved':
        return {
          label: '已通过',
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: '✅'
        };
      case 'rejected':
        return {
          label: '已拒绝',
          className: 'bg-red-100 text-red-800 border-red-200',
          icon: '❌'
        };
      case 'minted':
        return {
          label: '已铸造',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: '🎨'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: '❓'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

// 通用申请详情弹窗组件
interface RequestDetailModalProps {
  record: RequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onContinueMint?: (record: RequestRecord) => void; // NFT创建记录专用
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  record,
  isOpen,
  onClose,
  onContinueMint
}) => {
  if (!isOpen || !record) return null;

  // 使用统一的时间格式化工具

  // 获取显示的状态
  const getDisplayStatus = () => {
    if (record.auditStatus) {
      return record.auditStatus; // 审计中心使用
    }
    return record.status; // NFT创建记录使用
  };

  // 获取申请人地址
  const getRequesterAddress = () => {
    if (record.requester) {
      return record.requester; // 审计中心有完整地址
    }
    return '当前用户'; // NFT创建记录是用户自己的
  };

  // 获取时间戳
  const getTimestamp = () => {
    if (record.blockTimestamp) {
      return record.blockTimestamp; // 审计中心使用
    }
    return record.timestamp; // NFT创建记录使用
  };

  // 获取审计确认价值
  const getAuditedValue = () => {
    return record.auditedCarbonValue || record.carbonValue;
  };

  // 获取审计意见
  const getAuditComment = () => {
    return record.auditComment || record.reason;
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/20 p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📋</span>
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
              申请详情
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 border border-green-200/30 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg">🔍</span>
              <h3 className="text-xl font-bold text-green-800">基本信息</h3>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-green-700 font-medium text-sm">申请ID</span>
                <div className="text-gray-800 font-bold text-lg">#{record.tokenId}</div>
              </div>
              <div className="space-y-1">
                <span className="text-green-700 font-medium text-sm">状态</span>
                <div>
                  <StatusBadge status={getDisplayStatus()} />
                </div>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="text-green-700 font-medium text-sm">申请人</span>
                <div className="font-mono text-sm bg-white/70 px-3 py-2 rounded-lg border border-green-100 text-gray-800">
                  {getRequesterAddress()}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-green-700 font-medium text-sm">申请时间</span>
                <div className="text-gray-800 font-semibold">{formatTimestamp(getTimestamp())}</div>
              </div>
              <div className="space-y-1">
                <span className="text-green-700 font-medium text-sm">申请费用</span>
                <div className="text-green-600 font-bold text-lg">{formatFeeAmount(record.totalFee)} CARB</div>
              </div>
              {record.transactionHash && (
                <div className="space-y-1 col-span-2">
                  <span className="text-green-700 font-medium text-sm">交易哈希</span>
                  <div className="font-mono text-sm bg-white/70 px-3 py-2 rounded-lg border border-green-100 text-gray-800 break-all">
                    {record.transactionHash}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 项目信息 */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200/40 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-lg">🌱</span>
              <h3 className="text-xl font-bold text-emerald-800">项目信息</h3>
            </div>
            <div className="space-y-5">
              <div>
                <span className="text-emerald-700 font-medium text-sm block mb-2">项目标题</span>
                <div className="text-gray-800 font-bold text-xl leading-relaxed">{record.title}</div>
              </div>
              <div>
                <span className="text-emerald-700 font-medium text-sm block mb-2">项目详情</span>
                <div className="bg-white/80 p-4 rounded-xl border border-emerald-100 text-gray-700 leading-relaxed whitespace-pre-wrap shadow-sm">
                  {record.details}
                </div>
              </div>
              <div>
                <span className="text-emerald-700 font-medium text-sm block mb-2">申请碳减排量</span>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {record.carbonReduction}
                  </span>
                  <span className="text-emerald-700 font-semibold">tCO₂e</span>
                  <span className="text-emerald-500">🌿</span>
                </div>
              </div>
              {record.tokenURI && (
                <div>
                  <span className="text-emerald-700 font-medium text-sm block mb-2">元数据链接</span>
                  <a 
                    href={record.tokenURI} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-emerald-600 hover:text-emerald-800 font-medium transition-colors duration-200"
                  >
                    <span className="text-sm">🔗</span>
                    <span className="underline">{record.tokenURI}</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 审计信息 */}
          {(getDisplayStatus() !== 'pending' || getAuditedValue() || getAuditComment()) && (
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200/40 shadow-sm">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-lg">⚖️</span>
                <h3 className="text-xl font-bold text-blue-800">审计信息</h3>
              </div>
              <div className="space-y-5">
                {record.auditor && (
                  <div>
                    <span className="text-blue-700 font-medium text-sm block mb-2">审计员</span>
                    <div className="font-mono text-sm bg-white/70 px-3 py-2 rounded-lg border border-blue-100 text-gray-800 break-all">
                      {record.auditor}
                    </div>
                  </div>
                )}
                {getAuditedValue() && (
                  <div>
                    <span className="text-blue-700 font-medium text-sm block mb-2">审计确认价值</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-green-600">
                        {getAuditedValue()}
                      </span>
                      <span className="text-green-700 font-semibold">tCO₂e</span>
                      <span className="text-green-500">✅</span>
                    </div>
                    {getAuditedValue() !== record.carbonReduction && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center space-x-2 text-amber-800 text-sm">
                          <span>⚠️</span>
                          <span className="font-medium">
                            审计员将原申请 {record.carbonReduction} tCO₂e 调整为 {getAuditedValue()} tCO₂e
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {getAuditComment() && (
                  <div>
                    <span className="text-blue-700 font-medium text-sm block mb-2">审计意见</span>
                    <div className="bg-white/80 p-4 rounded-xl border border-blue-100 text-gray-700 leading-relaxed whitespace-pre-wrap shadow-sm">
                      {getAuditComment()}
                    </div>
                  </div>
                )}
                {record.nftTokenId && (
                  <div>
                    <span className="text-blue-700 font-medium text-sm block mb-2">NFT状态</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-purple-600">#{record.nftTokenId}</span>
                      <span className="inline-flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                        <span>🎨</span>
                        <span>已铸造</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="mt-8 flex justify-end space-x-3">
          {/* NFT创建记录专用的继续铸造按钮 */}
          {onContinueMint && record.status === 'approved' && (
            <button
              onClick={() => onContinueMint(record)}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              继续铸造
            </button>
          )}
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}; 