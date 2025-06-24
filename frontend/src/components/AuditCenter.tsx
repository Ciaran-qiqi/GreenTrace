'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { useIsAuditor } from '@/contracts/hooks/useGreenTrace';
import { useAuditData, AuditRequest } from '@/hooks/useAuditData';
import { AuditForm } from './AuditForm';
import { RequestDetailModal, type RequestRecord } from './RequestDetailModal';
import { formatFeeAmount } from '@/utils/tokenUtils';

// 标签页类型
type TabType = 'pending' | 'history';

// 状态标签组件
const StatusBadge: React.FC<{ status: AuditRequest['auditStatus'] }> = ({ status }) => {
  const statusConfig = {
    pending: {
      label: '待审计',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: '⏳'
    },
    approved: {
      label: '已通过',
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    },
    rejected: {
      label: '已拒绝',
      className: 'bg-red-100 text-red-800 border-red-200',
      icon: '❌'
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

// 审计中心组件
export const AuditCenter: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [selectedRequest, setSelectedRequest] = useState<AuditRequest | null>(null);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  
  // 检查是否为审计员
  const { data: isAuditor } = useIsAuditor(address as `0x${string}`);
  
  // 获取审计数据
  const { loading, refresh, forceRefresh, isClient, getAuditStats, getPendingRequests, getCompletedRequests } = useAuditData();

  // 将AuditRequest转换为RequestRecord格式
  const convertToRequestRecord = (request: AuditRequest): RequestRecord => {
    return {
      tokenId: request.tokenId,
      title: request.title,
      details: request.details,
      carbonReduction: request.carbonReduction,
      tokenURI: request.tokenURI,
      totalFee: request.totalFee,
      status: request.auditStatus as 'pending' | 'approved' | 'rejected' | 'minted',
      timestamp: request.blockTimestamp,
      auditor: request.auditor,
      carbonValue: request.auditedCarbonValue,
      reason: request.auditComment,
      transactionHash: request.transactionHash,
      source: request.source,
      // 审计中心特有字段
      auditStatus: request.auditStatus,
      auditedCarbonValue: request.auditedCarbonValue,
      auditComment: request.auditComment,
      nftTokenId: request.nftTokenId,
      requester: request.requester,
      blockTimestamp: request.blockTimestamp,
      requestId: request.requestId
    };
  };
  
  // 计算统计数据和获取分类数据
  const stats = getAuditStats();
  const pendingRequests = getPendingRequests();
  const completedRequests = getCompletedRequests();

  // 处理开始审计
  const handleStartAudit = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowAuditForm(true);
  };

  // 处理查看详情
  const handleViewDetails = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // 处理审计完成
  const handleAuditComplete = () => {
    setShowAuditForm(false);
    setSelectedRequest(null);
    // 刷新数据
    refresh();
  };

  // 关闭详情弹窗
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  // 格式化时间 - 修复SSR hydration问题
  const formatTime = (timestamp: string) => {
    // blockTimestamp已经是毫秒级时间戳，不需要再乘以1000
    const date = new Date(parseInt(timestamp));
    
    // 检查时间戳是否有效
    if (isNaN(date.getTime())) {
      return '无效时间';
    }
    
    // 在服务端渲染时，只显示固定格式的日期，避免locale差异
    if (typeof window === 'undefined') {
      return date.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    // 在客户端渲染时，显示本地化时间
    return date.toLocaleString('zh-CN');
  };

  // 渲染申请卡片
  const renderRequestCard = (request: AuditRequest, isPending: boolean = false) => (
    <div
      key={request.transactionHash || `${request.tokenId}-${request.blockTimestamp}`}
      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-800">
              #{request.tokenId} {request.title}
            </h3>
            <StatusBadge status={request.auditStatus} />
          </div>
          <p className="text-gray-600 text-sm line-clamp-2">
            {request.details}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{formatTime(request.blockTimestamp)}</div>
          <div className="mt-1">
            费用: {formatFeeAmount(request.totalFee)} CARB
          </div>
        </div>
      </div>

      {/* 申请详情 */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">申请人:</span>
          <span className="ml-2 font-medium">
            {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">申请碳减排量:</span>
          <span className="ml-2 font-medium">{request.carbonReduction} tCO₂e</span>
        </div>
        <div>
          <span className="text-gray-500">交易哈希:</span>
          <span className="ml-2 font-medium">
            {request.transactionHash.slice(0, 10)}...
          </span>
        </div>
        {!isPending && request.auditStatus === 'approved' && (
          <div>
            <span className="text-gray-500">审计确认价值:</span>
            <span className="ml-2 font-medium text-green-600">
              {request.auditedCarbonValue || request.carbonReduction} tCO₂e
            </span>
            {request.auditedCarbonValue && request.auditedCarbonValue !== request.carbonReduction && (
              <div className="text-xs text-gray-400 mt-1">
                * 原申请: {request.carbonReduction} tCO₂e，审计员调整为: {request.auditedCarbonValue} tCO₂e
              </div>
            )}
          </div>
        )}
      </div>

      {/* 操作按钮和状态说明 */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          {isPending ? (
            <>
              <button
                onClick={() => handleStartAudit(request)}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
              >
                开始审计
              </button>
              <button 
                onClick={() => handleViewDetails(request)}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                查看详情
              </button>
            </>
          ) : (
            <button 
              onClick={() => handleViewDetails(request)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              查看详情
            </button>
          )}
        </div>
        
        {/* 状态说明 */}
        {!isPending && (
          <div className="text-sm">
            {request.auditStatus === 'pending' && (
              <span className="text-yellow-600">
                ⏳ 等待审计
              </span>
            )}
            {request.auditStatus === 'approved' && (
              <span className="text-green-600">
                ✅ 审计通过，等待用户铸造
              </span>
            )}
            {request.auditStatus === 'rejected' && (
              <span className="text-red-600">
                ❌ 审计被拒绝
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* 历史申请特有的说明 */}
      {!isPending && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            <div className="flex justify-between items-center">
              <span>申请状态: 基于区块链事件记录</span>
              <span>
                {request.auditStatus === 'approved' 
                  ? '注意：如已铸造NFT，审计记录可能已从合约中删除' 
                  : '完整的申请历史记录'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 等待客户端渲染
  if (!isClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载...</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果没有连接钱包
  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">请先连接钱包</h3>
            <p className="text-gray-500">连接钱包后访问审计中心</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果不是审计员
  if (!isAuditor) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">权限不足</h3>
            <p className="text-gray-500">您不是授权的审计员，无法访问审计中心</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 统计信息 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {stats.totalCount}
            </div>
            <div className="text-gray-600">总申请数</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              {stats.pendingCount}
            </div>
            <div className="text-gray-600">待审计申请</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {stats.approvedCount}
            </div>
            <div className="text-gray-600">已通过审计</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {stats.rejectedCount}
            </div>
            <div className="text-gray-600">已拒绝申请</div>
          </div>
        </div>
      </div>

      {/* 标签页和申请列表 */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* 标签页头部 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              待审计申请 ({stats.pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              历史申请 ({stats.totalCount})
            </button>
          </div>
          
          {/* 刷新按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '刷新中...' : '刷新'}
            </button>
            <button
              onClick={() => forceRefresh()}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              title="强制刷新所有历史数据"
            >
              🔄
            </button>
          </div>
        </div>

        {/* 标签页内容 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载数据...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'pending' ? (
              // 待审计申请
              pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无待审计申请</h3>
                  <p className="text-gray-500">所有申请都已处理完成</p>
                </div>
              ) : (
                pendingRequests.map((request) => renderRequestCard(request, true))
              )
            ) : (
              <>
                {/* 历史申请说明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <div className="text-blue-600 text-xl mr-3">ℹ️</div>
                    <div>
                      <h4 className="text-blue-800 font-semibold mb-2">历史申请说明</h4>
                      <div className="text-blue-700 text-sm space-y-1">
                        <p>• <strong>数据来源</strong>：直接从智能合约查询，结合实时事件监听，确保数据准确性和实时性</p>
                        <p>• <strong>数据范围</strong>：包含待审计和已审计的所有申请记录，提供完整的审计历史档案</p>
                        <p>• <strong>状态同步</strong>：实时监听区块链事件，自动更新申请状态变化（提交审计、审计完成等）</p>
                        <p>• <strong>排序方式</strong>：按申请时间倒序排列，最新申请在前，便于审计员优先处理</p>
                        <p>• <strong>缓存优化</strong>：智能本地缓存机制，提升加载速度，后台自动刷新保持数据同步</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 历史申请列表 */}
                {(pendingRequests.length + completedRequests.length) === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无历史申请</h3>
                    <p className="text-gray-500">还没有任何NFT申请记录</p>
                  </div>
                ) : (
                  // 显示所有申请：待审计 + 已完成的
                  [...pendingRequests, ...completedRequests]
                    .sort((a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp))
                    .map((request) => renderRequestCard(request, false))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 审计表单弹窗 */}
      {showAuditForm && selectedRequest && (
        <AuditForm
          request={selectedRequest}
          onClose={() => setShowAuditForm(false)}
          onComplete={handleAuditComplete}
        />
      )}

      {/* 详情查看弹窗 */}
      <RequestDetailModal
        record={selectedRequest ? convertToRequestRecord(selectedRequest) : null}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}; 