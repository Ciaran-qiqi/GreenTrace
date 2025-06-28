'use client';

import React, { useState } from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { useAuditDetails } from '@/hooks/useAuditDetails';
import { formatContractTimestamp } from '@/utils/formatUtils';
import { useTranslation } from '@/hooks/useI18n';
import { formatEther } from 'viem';

// 审计状态映射
const getAuditStatusMap = (t: any) => ({
  0: { label: t('audit.status.pending'), color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  1: { label: t('audit.status.approved'), color: 'bg-green-100 text-green-800', icon: '✅' },
  2: { label: t('audit.status.rejected'), color: 'bg-red-100 text-red-800', icon: '❌' },
});

// 审计类型映射
const getAuditTypeMap = (t: any) => ({
  0: { label: t('admin.auditDataManagement.mintAudits'), color: 'bg-blue-100 text-blue-800', icon: '🔨' },
  1: { label: t('admin.auditDataManagement.exchangeAudits'), color: 'bg-green-100 text-green-800', icon: '💰' },
});

// 标签页类型
type TabType = 'pending' | 'mint' | 'cash' | 'all';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
}

/**
 * 审计数据管理组件
 * @description 查看和管理所有审计记录，支持按类型和状态筛选
 */
export const AuditDataManagement: React.FC = () => {
  const { t, language } = useTranslation();
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

  // 构建标签页配置
  const tabs: TabConfig[] = [
    {
      id: 'pending',
      label: t('admin.auditDataManagement.pendingAudits'),
      icon: '⏳',
      description: t('audit.status.pending'),
    },
    {
      id: 'mint',
      label: t('admin.auditDataManagement.mintAudits'),
      icon: '🔨',
      description: t('admin.auditDataManagement.mintAudits'),
    },
    {
      id: 'cash',
      label: t('admin.auditDataManagement.exchangeAudits'),
      icon: '💰',
      description: t('admin.auditDataManagement.exchangeAudits'),
    },
    {
      id: 'all',
      label: t('admin.auditDataManagement.allAudits'),
      icon: '📋',
      description: t('admin.auditDataManagement.allAudits'),
    },
  ];

  // 获取状态和类型映射
  const auditStatusMap = getAuditStatusMap(t);
  const auditTypeMap = getAuditTypeMap(t);

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
                {t('admin.auditDataManagement.applicationId')} #{requestIdStr}
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
              {t('audit.viewDetails')}
            </button>
          </div>
        </div>

        {auditDetails && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">{t('audit.applicant')}:</span>
                <span className="ml-2 font-mono">
                  {auditDetails.requester.slice(0, 6)}...{auditDetails.requester.slice(-4)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{t('admin.auditDataManagement.submittedAt')}:</span>
                <span className="ml-2">
                  {formatContractTimestamp(auditDetails.requestTimestamp, language)}
                </span>
              </div>
            </div>

            {auditDetails.status !== 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500">{t('audit.auditor')}:</span>
                  <span className="ml-2 font-mono">
                    {auditDetails.auditor.slice(0, 6)}...{auditDetails.auditor.slice(-4)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">{t('admin.auditDataManagement.auditedAt')}:</span>
                  <span className="ml-2">
                    {formatContractTimestamp(auditDetails.auditTimestamp, language)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">{t('audit.carbonReduction')}:</span>
                <span className="ml-2">
                  {formatEther(auditDetails.carbonReduction)} tCO₂e
                </span>
              </div>
              {auditDetails.status !== 0 && (
                <div>
                  <span className="text-gray-500">{t('audit.auditedValue')}:</span>
                  <span className="ml-2">
                    {formatEther(auditDetails.auditedValue)} tCO₂e
                  </span>
                </div>
              )}
            </div>

            {auditDetails.status !== 0 && auditDetails.comment && (
              <div>
                <span className="text-gray-500">{t('audit.auditComment')}:</span>
                <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                  {auditDetails.comment}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('admin.auditDataManagement.title')}</h2>
        <p className="text-gray-600">{t('admin.auditDataManagement.subtitle')}</p>
      </div>

      {/* 标签页导航 */}
      <div className="mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
          <nav className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 p-3 rounded-lg transition-all text-center relative ${
                  activeTab === tab.id
                    ? 'bg-green-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">{tab.icon}</span>
                  <div className="font-medium text-sm">{tab.label}</div>
                  <div className={`text-xs ${
                    activeTab === tab.id ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {tab.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* 数据统计 */}
      <div className="mb-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{currentData.length}</div>
                <div className="text-sm text-gray-600">{t('admin.auditDataManagement.totalRecords')}</div>
              </div>
              {currentLoading && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                  <span className="text-sm">{t('admin.auditDataManagement.loadingAuditData')}</span>
                </div>
              )}
            </div>
            <button
              onClick={refetchAll}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              🔄 {t('common.refresh')}
            </button>
          </div>
        </div>
      </div>

      {/* 审计记录列表 */}
      <div className="space-y-4">
        {currentLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <div className="text-gray-600">{t('admin.auditDataManagement.loadingAuditData')}</div>
          </div>
        ) : currentData.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-4">📋</div>
            <div className="text-gray-600">{t('admin.auditDataManagement.noAuditData')}</div>
          </div>
        ) : (
          currentData.map((requestId, index) => renderAuditCard(requestId, index))
        )}
      </div>
    </div>
  );
}; 