'use client';

import React from 'react';
import { useAdminData } from '@/hooks/useAdminData';
import { useI18n } from '@/hooks/useI18n';

/**
 * 管理仪表板组件
 * @description 展示系统概览统计、趋势分析和快速操作
 */
export const AdminDashboard: React.FC = () => {
  const { t } = useI18n();
  const {
    systemStats,
    statsLoading,
    pendingMintAudits,
    pendingCashAudits,
    pendingMintLoading,
    pendingCashLoading,
    isAuditor,
  } = useAdminData();

  // 计算审计通过率
  const calculateApprovalRate = (approved: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((approved / total) * 100);
  };

  // 加载状态
  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!systemStats) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 text-4xl mb-4">📊</div>
        <div className="text-gray-600">{t('admin.dashboard.cannotLoadStats')}</div>
      </div>
    );
  }

  const mintApprovalRate = calculateApprovalRate(
    systemStats.approvedMintRequests,
    systemStats.totalMintRequests
  );

  const cashApprovalRate = calculateApprovalRate(
    systemStats.approvedCashRequests,
    systemStats.totalCashRequests
  );

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('admin.dashboard.title')}</h2>
        <p className="text-gray-600">{t('admin.dashboard.subtitle')}</p>
      </div>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* 总申请数 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">
                {systemStats.totalMintRequests + systemStats.totalCashRequests}
              </div>
              <div className="text-blue-100">{t('admin.dashboard.totalApplications')}</div>
            </div>
            <div className="text-4xl opacity-80">📋</div>
          </div>
          <div className="mt-4 text-sm text-blue-100">
            {t('admin.dashboard.mint')} {systemStats.totalMintRequests} + {t('admin.dashboard.exchange')} {systemStats.totalCashRequests}
          </div>
        </div>

        {/* 待审核申请 */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">
                {systemStats.pendingMintRequests + systemStats.pendingCashRequests}
              </div>
              <div className="text-orange-100">{t('admin.dashboard.pendingReview')}</div>
            </div>
            <div className="text-4xl opacity-80">⏳</div>
          </div>
          <div className="mt-4 text-sm text-orange-100">
            {t('admin.dashboard.mint')} {systemStats.pendingMintRequests} + {t('admin.dashboard.exchange')} {systemStats.pendingCashRequests}
          </div>
        </div>

        {/* 已批准申请 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">
                {systemStats.approvedMintRequests + systemStats.approvedCashRequests}
              </div>
              <div className="text-green-100">{t('admin.dashboard.approved')}</div>
            </div>
            <div className="text-4xl opacity-80">✅</div>
          </div>
          <div className="mt-4 text-sm text-green-100">
            {t('admin.dashboard.mint')} {systemStats.approvedMintRequests} + {t('admin.dashboard.exchange')} {systemStats.approvedCashRequests}
          </div>
        </div>

        {/* 总体通过率 */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">
                {calculateApprovalRate(
                  systemStats.approvedMintRequests + systemStats.approvedCashRequests,
                  systemStats.totalMintRequests + systemStats.totalCashRequests
                )}%
              </div>
              <div className="text-purple-100">{t('admin.dashboard.overallApprovalRate')}</div>
            </div>
            <div className="text-4xl opacity-80">📈</div>
          </div>
          <div className="mt-4 text-sm text-purple-100">
            {t('admin.dashboard.auditQualityAssessment')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 申请类型分析 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('admin.dashboard.applicationTypeAnalysis')}</h3>
          
          <div className="space-y-6">
            {/* 铸造申请 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">{t('admin.dashboard.mintApplications')}</span>
                <span className="text-sm text-gray-500">
                  {systemStats.totalMintRequests} {t('admin.dashboard.applications')}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ 
                      width: `${systemStats.totalMintRequests > 0 ? 
                        (systemStats.approvedMintRequests / systemStats.totalMintRequests) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('admin.dashboard.pendingReviewCount')} {systemStats.pendingMintRequests}</span>
                <span>{t('admin.dashboard.approvedCount')} {systemStats.approvedMintRequests}</span>
                <span>{t('admin.dashboard.approvalRate')} {mintApprovalRate}%</span>
              </div>
            </div>

            {/* 兑换申请 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">{t('admin.dashboard.exchangeApplications')}</span>
                <span className="text-sm text-gray-500">
                  {systemStats.totalCashRequests} {t('admin.dashboard.applications')}
                </span>
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ 
                      width: `${systemStats.totalCashRequests > 0 ? 
                        (systemStats.approvedCashRequests / systemStats.totalCashRequests) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('admin.dashboard.pendingReviewCount')} {systemStats.pendingCashRequests}</span>
                <span>{t('admin.dashboard.approvedCount')} {systemStats.approvedCashRequests}</span>
                <span>{t('admin.dashboard.approvalRate')} {cashApprovalRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('admin.dashboard.quickActions')}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 待审核铸造申请 */}
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">🔄</div>
              <div className="font-medium text-blue-800 mb-1">
                {systemStats.pendingMintRequests}
              </div>
              <div className="text-sm text-blue-600">{t('admin.dashboard.pendingMintReview')}</div>
            </div>

            {/* 待审核兑换申请 */}
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">💱</div>
              <div className="font-medium text-green-800 mb-1">
                {systemStats.pendingCashRequests}
              </div>
              <div className="text-sm text-green-600">{t('admin.dashboard.pendingExchangeReview')}</div>
            </div>

            {/* 系统统计 */}
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-medium text-purple-800 mb-1">
                {systemStats.totalMintRequests + systemStats.totalCashRequests}
              </div>
              <div className="text-sm text-purple-600">{t('admin.dashboard.totalApplicationsCount')}</div>
            </div>

            {/* 通过率 */}
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="font-medium text-orange-800 mb-1">
                {calculateApprovalRate(
                  systemStats.approvedMintRequests + systemStats.approvedCashRequests,
                  systemStats.totalMintRequests + systemStats.totalCashRequests
                )}%
              </div>
              <div className="text-sm text-orange-600">{t('admin.dashboard.overallApprovalRatePercent')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 近期活动 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">近期活动</h3>
        
        {(pendingMintLoading || pendingCashLoading) ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <div className="text-gray-600 mt-2">加载活动数据...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 待审核的铸造申请 */}
            {pendingMintAudits.length > 0 && (
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="font-medium text-gray-800">
                  待审核铸造申请 ({pendingMintAudits.length} 个)
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  申请ID: {pendingMintAudits.slice(0, 3).map(id => `#${id.toString()}`).join(', ')}
                  {pendingMintAudits.length > 3 && ` 等${pendingMintAudits.length}个`}
                </div>
              </div>
            )}

            {/* 待审核的兑换申请 */}
            {pendingCashAudits.length > 0 && (
              <div className="border-l-4 border-green-500 pl-4">
                <div className="font-medium text-gray-800">
                  待审核兑换申请 ({pendingCashAudits.length} 个)
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  申请ID: {pendingCashAudits.slice(0, 3).map(id => `#${id.toString()}`).join(', ')}
                  {pendingCashAudits.length > 3 && ` 等${pendingCashAudits.length}个`}
                </div>
              </div>
            )}

            {/* 无待审核申请 */}
            {pendingMintAudits.length === 0 && pendingCashAudits.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">✨</div>
                <div>暂无待审核申请</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 