'use client';

import React, { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { useAuditDetails } from '@/hooks/useAuditDetails';
import { formatContractTimestamp } from '@/utils/timeUtils';
import { formatEther } from 'viem';

// 审计状态映射
const auditStatusMap = {
  0: { label: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  1: { label: '已批准', color: 'bg-green-100 text-green-800', icon: '✅' },
  2: { label: '已拒绝', color: 'bg-red-100 text-red-800', icon: '❌' },
};

// 审计类型映射
const auditTypeMap = {
  0: { label: '铸造申请', color: 'bg-blue-100 text-blue-800', icon: '🔨' },
  1: { label: '兑换申请', color: 'bg-green-100 text-green-800', icon: '💰' },
};

// 标签页类型
type TabType = 'pending' | 'mint' | 'cash' | 'all';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
}

const tabs: TabConfig[] = [
  {
    id: 'pending',
    label: '待审核',
    icon: '⏳',
    description: '需要处理的申请',
  },
  {
    id: 'mint',
    label: '铸造审计',
    icon: '🔨',
    description: '所有铸造申请记录',
  },
  {
    id: 'cash',
    label: '兑换审计',
    icon: '💰',
    description: '所有兑换申请记录',
  },
  {
    id: 'all',
    label: '全部记录',
    icon: '📋',
    description: '查看所有审计记录',
  },
];

/**
 * 审计数据管理组件
 * @description 查看和管理所有审计记录，支持按类型和状态筛选
 */
export const AuditDataManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);

  const {
    systemStats,
    pendingMintAudits,
    pendingCashAudits,
    allAuditedMintRequests,
    allAuditedCashRequests,
    pendingMintLoading,
    pendingCashLoading,
    auditedMintLoading,
    auditedCashLoading,
    isAuditor,
    refetchAll,
  } = useAdminData();

  const { getAuditDetails, auditDetailsCache, loadingDetails } = useAuditDetails();

  // 获取当前标签页的数据
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'pending':
        return {
          data: [...pendingMintAudits, ...pendingCashAudits],
          loading: pendingMintLoading || pendingCashLoading,
          type: 'pending' as const,
        };
      case 'mint':
        return {
          data: allAuditedMintRequests,
          loading: auditedMintLoading,
          type: 'mint' as const,
        };
      case 'cash':
        return {
          data: allAuditedCashRequests,
          loading: auditedCashLoading,
          type: 'cash' as const,
        };
      case 'all':
        return {
          data: [...allAuditedMintRequests, ...allAuditedCashRequests],
          loading: auditedMintLoading || auditedCashLoading,
          type: 'all' as const,
        };
      default:
        return { data: [], loading: false, type: 'all' as const };
    }
  };

  const { data: currentData, loading: currentLoading, type: currentType } = getCurrentTabData();

  // 获取审计记录详情
  const handleViewDetails = (requestId: string) => {
    setSelectedAudit(requestId);
    const isExchange = activeTab === 'cash' || 
      (activeTab === 'pending' && pendingCashAudits.some(id => id.toString() === requestId)) ||
      (activeTab === 'all' && allAuditedCashRequests.some(id => id.toString() === requestId));
    getAuditDetails(requestId, isExchange);
  };

  // 渲染审计记录卡片
  const renderAuditCard = (requestId: bigint, index: number) => {
    const requestIdStr = requestId.toString();
    const isExchange = activeTab === 'cash' || 
      (activeTab === 'pending' && pendingCashAudits.includes(requestId)) ||
      (activeTab === 'all' && allAuditedCashRequests.includes(requestId));

    const auditDetails = auditDetailsCache[requestIdStr];
    const isPending = activeTab === 'pending' || 
      (auditDetails && auditDetails.status === 0);

    return (
      <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">{auditTypeMap[isExchange ? 1 : 0].icon}</span>
            <div>
              <div className="font-medium text-gray-800">
                申请 #{requestIdStr}
              </div>
              <div className="text-sm text-gray-500">
                {auditTypeMap[isExchange ? 1 : 0].label}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {auditDetails && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                auditStatusMap[auditDetails.status]?.color || 'bg-gray-100 text-gray-800'
              }`}>
                {auditStatusMap[auditDetails.status]?.icon} {auditStatusMap[auditDetails.status]?.label}
              </span>
            )}
            <button
              onClick={() => handleViewDetails(requestIdStr)}
              className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm transition-colors"
            >
              查看详情
            </button>
          </div>
        </div>

        {auditDetails && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">申请人:</span>
                <span className="ml-2 font-mono">
                  {auditDetails.requester.slice(0, 6)}...{auditDetails.requester.slice(-4)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">申请时间:</span>
                <span className="ml-2">
                  {formatContractTimestamp(auditDetails.requestTimestamp)}
                </span>
              </div>
            </div>

            {auditDetails.status !== 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500">审计员:</span>
                  <span className="ml-2 font-mono">
                    {auditDetails.auditor.slice(0, 6)}...{auditDetails.auditor.slice(-4)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">审计时间:</span>
                  <span className="ml-2">
                    {formatContractTimestamp(auditDetails.auditTimestamp)}
                  </span>
                </div>
              </div>
            )}

            {auditDetails.carbonValue !== '0' && (
              <div>
                <span className="text-gray-500">碳价值:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {formatEther(BigInt(auditDetails.carbonValue))} CARB
                </span>
              </div>
            )}

            {auditDetails.requestData.title && (
              <div>
                <span className="text-gray-500">标题:</span>
                <span className="ml-2">{auditDetails.requestData.title}</span>
              </div>
            )}

            {auditDetails.auditComment && (
              <div>
                <span className="text-gray-500">审计意见:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                  {auditDetails.auditComment}
                </div>
              </div>
            )}
          </div>
        )}

        {!auditDetails && (
          <div className="text-center py-2">
            <button
              onClick={() => handleViewDetails(requestIdStr)}
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              点击加载详情
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">审计数据管理</h2>
        <p className="text-gray-600">查看和管理所有审计记录，跟踪申请处理状态</p>
      </div>

      {/* 权限说明 */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">👤</span>
          <div>
            <div className="font-medium text-blue-800">
              当前权限: {isAuditor ? '审计员' : '访客'}
            </div>
            <div className="text-sm text-blue-700">
              {isAuditor 
                ? '您可以查看所有审计记录和详细信息'
                : '您只能查看公开的审计统计信息'
              }
            </div>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      {systemStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {systemStats.pendingMintRequests + systemStats.pendingCashRequests}
                </div>
                <div className="text-orange-700 font-medium">待审核</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔨</span>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {systemStats.totalMintRequests}
                </div>
                <div className="text-blue-700 font-medium">铸造申请</div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {systemStats.totalCashRequests}
                </div>
                <div className="text-green-700 font-medium">兑换申请</div>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {systemStats.approvedMintRequests + systemStats.approvedCashRequests}
                </div>
                <div className="text-purple-700 font-medium">已批准</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          {tabs.find(tab => tab.id === activeTab)?.description}
        </div>
      </div>

      {/* 操作栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-600">
          {currentLoading ? '加载中...' : `共 ${currentData.length} 条记录`}
        </div>
        <button
          onClick={refetchAll}
          disabled={currentLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          🔄 刷新数据
        </button>
      </div>

      {/* 审计记录列表 */}
      <div className="bg-white border border-gray-200 rounded-xl">
        {currentLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <div className="text-gray-600 mt-2">加载审计数据...</div>
          </div>
        ) : currentData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <div>暂无{tabs.find(tab => tab.id === activeTab)?.label}记录</div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {currentData.map((requestId, index) => renderAuditCard(requestId, index))}
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedAudit && auditDetailsCache[selectedAudit] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">
                  审计详情 #{selectedAudit}
                </h3>
                <button
                  onClick={() => setSelectedAudit(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* 这里可以添加更详细的审计信息展示 */}
              <div className="space-y-4">
                <div className="text-center text-gray-500">
                  详细审计信息将在这里显示
                </div>
                <div className="text-center">
                  <button
                    onClick={() => setSelectedAudit(null)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 