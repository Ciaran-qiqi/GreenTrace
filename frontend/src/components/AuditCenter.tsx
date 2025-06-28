'use client';

import React, { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { useAuditData, AuditRequest } from '@/hooks/useAuditData';
import { useExchangeAuditData, ExchangeAuditRequest } from '@/hooks/useExchangeAuditData';
import { AuditForm } from './AuditForm';
import { ExchangeAuditForm } from './ExchangeAuditForm';
import { RequestDetailModal, type RequestRecord } from './RequestDetailModal';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { NFTViewButton } from './NFTViewButton';
import { getGreenTalesNFTAddress } from '@/contracts/addresses';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';

// 标签页类型 - 分离铸造和兑换历史
type TabType = 'mint-pending' | 'exchange-pending' | 'mint-history' | 'exchange-history';

// 检查NFT是否存在的Hook（用于判断是否已被兑换销毁）
const useCheckNFTExists = (tokenId: string | undefined) => {
  const chainId = useChainId();
  const nftContractAddress = getGreenTalesNFTAddress(chainId);
  
  return useReadContract({
    address: nftContractAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'ownerOf',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: !!tokenId,
      retry: false, // 不重试，因为NFT不存在会抛出错误
    }
  });
};

// 状态徽章组件
const StatusBadge: React.FC<{ status: AuditRequest['auditStatus'] | ExchangeAuditRequest['auditStatus'] }> = ({ status }) => {
  const statusMap = {
    pending: { label: '待审计', className: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
    approved: { label: '已通过', className: 'bg-green-100 text-green-800', icon: '✅' },
    rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800', icon: '❌' },
    exchanged: { label: '已兑换', className: 'bg-blue-100 text-blue-800', icon: '🎉' },
  };
  
  const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

// 根据链ID获取GreenTrace合约地址
const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // 本地Foundry测试网
      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// 审计中心组件
export const AuditCenter: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedRequest, setSelectedRequest] = useState<AuditRequest | null>(null);
  const [selectedExchangeRequest, setSelectedExchangeRequest] = useState<ExchangeAuditRequest | null>(null);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [showExchangeAuditForm, setShowExchangeAuditForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('mint-pending');
  
  // 获取合约地址
  const greenTraceAddress = getGreenTraceAddress(chainId);
  
  // 检查是否为审计员 - 使用和Navigation相同的逻辑
  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  });
  
  // 获取铸造审计数据
  const { 
    loading: mintLoading, 
    refresh: refreshMint, 
    forceRefresh: forceRefreshMint, 
    isClient, 
    getAuditStats, 
    getPendingRequests, 
    getCompletedRequests 
  } = useAuditData();
  
  // 获取兑换审计数据
  const { 
    loading: exchangeLoading, 
    refresh: refreshExchange, 
    forceRefresh: forceRefreshExchange, 
    getExchangeAuditStats, 
    getPendingExchangeRequests, 
    getCompletedExchangeRequests 
  } = useExchangeAuditData();

  // 将AuditRequest转换为RequestRecord格式
  const convertToRequestRecord = (request: AuditRequest): RequestRecord => {
    return {
      tokenId: request.tokenId,
      title: request.title,
      details: request.details,
      carbonReduction: request.carbonReduction,
      tokenURI: request.tokenURI,
      totalFee: request.totalFee,
      status: request.auditStatus as 'pending' | 'approved' | 'rejected',
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
  const mintStats = getAuditStats();
  const exchangeStats = getExchangeAuditStats();
  const pendingMintRequests = getPendingRequests();
  const completedMintRequests = getCompletedRequests();
  const pendingExchangeRequests = getPendingExchangeRequests();
  const completedExchangeRequests = getCompletedExchangeRequests();
  
  // 合并统计数据
  const totalStats = {
    totalCount: mintStats.totalCount + exchangeStats.totalCount,
    pendingCount: mintStats.pendingCount + exchangeStats.pendingCount,
    approvedCount: mintStats.approvedCount + exchangeStats.approvedCount,
    rejectedCount: mintStats.rejectedCount + exchangeStats.rejectedCount,
    exchangedCount: 0, // 兑换特有的状态，暂时设为0
  };

  // 处理开始铸造审计
  const handleStartMintAudit = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowAuditForm(true);
  };

  // 处理开始兑换审计
  const handleStartExchangeAudit = (request: ExchangeAuditRequest) => {
    setSelectedExchangeRequest(request);
    setShowExchangeAuditForm(true);
  };

  // 处理查看详情
  const handleViewDetails = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // 处理铸造审计完成
  const handleMintAuditComplete = () => {
    setShowAuditForm(false);
    setSelectedRequest(null);
    // 刷新数据
    refreshMint();
  };

  // 处理兑换审计完成
  const handleExchangeAuditComplete = () => {
    setShowExchangeAuditForm(false);
    setSelectedExchangeRequest(null);
    // 刷新数据
    refreshExchange();
  };

  // 关闭详情弹窗
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  // 刷新所有数据
  const refreshAll = () => {
    refreshMint();
    refreshExchange();
  };

  // 强制刷新所有数据
  const forceRefreshAll = () => {
    forceRefreshMint();
    forceRefreshExchange();
  };

  // 监听全局NFT兑换事件，实时更新状态
  React.useEffect(() => {
    const handleNFTExchanged = (event: CustomEvent) => {
      console.log('审计中心检测到NFT兑换事件:', event.detail);
      // 立即强制刷新数据以反映兑换状态
      forceRefreshAll();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      
      return () => {
        window.removeEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      };
    }
  }, [forceRefreshMint, forceRefreshExchange]);

  // 当前是否在加载中
  const loading = mintLoading || exchangeLoading;

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
    
    // 客户端使用本地化时间
    return date.toLocaleString();
  };

  // 带NFT存在性检查的铸造申请卡片组件
  const MintRequestCard: React.FC<{ request: AuditRequest; isPending: boolean }> = ({ request, isPending }) => {
    const { error: nftError } = useCheckNFTExists(request.nftTokenId);
    const nftExists = !nftError;

    return (
      <div
        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                #{request.tokenId} {request.title}
              </h3>
              <StatusBadge status={request.auditStatus} />
              {/* 对于已兑换的NFT，显示额外的兑换标签 */}
              {request.nftTokenId && !nftExists && request.auditStatus === 'approved' && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                  🔥 已兑换
                </span>
              )}
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
                  onClick={() => handleStartMintAudit(request)}
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
              <>
                <button 
                  onClick={() => handleViewDetails(request)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  查看详情
                </button>
                {/* 如果NFT已铸造，始终显示查看NFT按钮（NFTInfoSection会自动处理已销毁的情况） */}
                {request.nftTokenId && (
                  <NFTViewButton 
                    nftTokenId={request.nftTokenId}
                    buttonText="查看NFT"
                    buttonStyle="secondary"
                    size="sm"
                    nftExists={nftExists}
                  />
                )}
              </>
            )}
          </div>
          
          {/* 状态说明 - 根据NFT存在性显示不同状态 */}
          {!isPending && (
            <div className="text-sm">
              {request.auditStatus === 'pending' && (
                <span className="text-yellow-600">
                  ⏳ 等待审计
                </span>
              )}
              {request.auditStatus === 'approved' && (
                <>
                  {request.nftTokenId ? (
                    nftExists ? (
                      <span className="text-purple-600 font-medium">
                        🎨 已铸造NFT #{request.nftTokenId}
                      </span>
                    ) : (
                      <span className="text-orange-600 font-medium">
                        🔥 已销毁NFT #{request.nftTokenId}
                      </span>
                    )
                  ) : (
                    <span className="text-green-600">
                      ✅ 审计通过，等待用户铸造
                    </span>
                  )}
                </>
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
                  {request.nftTokenId 
                    ? nftExists
                      ? `🎨 NFT已铸造完成 (#${request.nftTokenId})`
                      : `🔥 NFT已兑换销毁 (#${request.nftTokenId})`
                    : request.auditStatus === 'approved' 
                      ? '⏳ 已审核通过，等待铸造' 
                      : '完整的申请历史记录'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染铸造申请卡片
  const renderMintRequestCard = (request: AuditRequest, isPending: boolean = false) => (
    <MintRequestCard key={request.transactionHash || `${request.tokenId}-${request.blockTimestamp}`} request={request} isPending={isPending} />
  );

  // 带NFT存在性检查的兑换申请卡片组件
  const ExchangeRequestCard: React.FC<{ request: ExchangeAuditRequest; isPending: boolean }> = ({ request, isPending }) => {
    const { error: nftError } = useCheckNFTExists(request.nftTokenId);
    const nftExists = !nftError;

    return (
      <div
        className="border border-purple-200 rounded-lg p-6 hover:shadow-md transition-shadow bg-gradient-to-br from-purple-50/30 to-white"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                🔄 兑换申请 #{request.cashId}
              </h3>
              <StatusBadge status={request.auditStatus} />
              {/* 显示NFT兑换状态 - 已兑换的申请显示额外的兑换标签 */}
              {!nftExists && request.auditStatus === 'approved' && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                  🔥 已兑换
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">
              NFT #{request.nftTokenId} 申请兑换
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{formatTime(request.blockTimestamp)}</div>
            <div className="mt-1">
              手续费: {formatFeeAmount(request.requestFee)} CARB
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
            <span className="text-gray-500">NFT Token ID:</span>
            <span className="ml-2 font-medium">#{request.nftTokenId}</span>
          </div>
          <div>
            <span className="text-gray-500">NFT当前价格:</span>
            <span className="ml-2 font-medium text-green-600">{formatFeeAmount(request.basePrice)} CARB</span>
          </div>
          {!isPending && request.auditStatus === 'approved' && request.auditedCarbonValue && (
            <div>
              <span className="text-gray-500">审计确认价值:</span>
              <span className="ml-2 font-medium text-green-600">
                {formatFeeAmount(request.auditedCarbonValue)} CARB
              </span>
            </div>
          )}
        </div>

        {/* 操作按钮和状态说明 */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            {isPending ? (
              <>
                <button
                  onClick={() => handleStartExchangeAudit(request)}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
                >
                  开始审计
                </button>
                <button 
                  onClick={() => {
                    // 查看NFT信息
                  }}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  查看NFT
                </button>
              </>
            ) : (
              <>
                <NFTViewButton 
                  nftTokenId={request.nftTokenId}
                  buttonText="查看NFT"
                  buttonStyle="secondary"
                  size="sm"
                  nftExists={nftExists}
                />
              </>
            )}
          </div>
          
          {/* 状态说明 - 根据NFT存在性显示不同状态 */}
          {!isPending && (
            <div className="text-sm">
              {request.auditStatus === 'pending' && (
                <span className="text-yellow-600">
                  ⏳ 等待审计
                </span>
              )}
              {request.auditStatus === 'approved' && (
                <>
                  {nftExists ? (
                    <span className="text-green-600">
                      ✅ 审计通过，等待用户兑换
                    </span>
                  ) : (
                    <span className="text-blue-600 font-medium">
                      💰 兑换已完成，NFT已销毁
                    </span>
                  )}
                </>
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
          <div className="mt-3 pt-3 border-t border-purple-100">
            <div className="text-xs text-gray-500">
              <div className="flex justify-between items-center">
                <span>兑换申请状态: 基于区块链事件记录</span>
                <span>
                  {request.auditStatus === 'approved' 
                    ? nftExists 
                      ? '✅ 已审核通过，等待兑换' 
                      : '🎉 兑换已完成，NFT已销毁'
                    : '完整的兑换申请历史记录'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染兑换审计申请卡片
  const renderExchangeRequestCard = (request: ExchangeAuditRequest, isPending: boolean = false) => (
    <ExchangeRequestCard key={request.transactionHash || `${request.cashId}-${request.blockTimestamp}`} request={request} isPending={isPending} />
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

  // 判断用户权限 - 和Navigation组件保持一致
  const isAuthorizedAuditor = Boolean(address && isAuditor);
  
  // 调试信息
  console.log('AuditCenter权限检查:', {
    address,
    isConnected,
    isAuditor,
    isAuthorizedAuditor,
    chainId,
    greenTraceAddress
  });
  
  // 如果未连接钱包
  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔌</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">未连接钱包</h3>
            <p className="text-gray-500">请先连接钱包以访问审计中心</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果不是审计员
  if (!isAuthorizedAuditor) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">权限不足</h3>
            <p className="text-gray-500">您不是授权的审计员，无法访问审计中心</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>当前地址: {address}</p>
              <p>审计员状态: {isAuditor ? '是' : '否'}</p>
              <p>合约地址: {greenTraceAddress}</p>
            </div>
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
              {totalStats.totalCount}
            </div>
            <div className="text-gray-600">总申请数</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              {totalStats.pendingCount}
            </div>
            <div className="text-gray-600">待审计申请</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {totalStats.approvedCount}
            </div>
            <div className="text-gray-600">已通过审计</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {totalStats.rejectedCount}
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
              onClick={() => setActiveTab('mint-pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'mint-pending'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              铸造审计申请 ({mintStats.pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('exchange-pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'exchange-pending'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              兑换审计申请 ({exchangeStats.pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('mint-history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'mint-history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              铸造历史 ({completedMintRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('exchange-history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'exchange-history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              兑换历史 ({completedExchangeRequests.length})
            </button>
          </div>
          
          {/* 刷新按钮 */}
          <div className="flex gap-2">
            <button
              onClick={() => refreshAll()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '刷新中...' : '刷新'}
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
            {activeTab === 'mint-pending' ? (
              // 铸造审计申请
              pendingMintRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无待审计铸造申请</h3>
                  <p className="text-gray-500">所有铸造申请都已处理完成</p>
                </div>
              ) : (
                pendingMintRequests.map((request) => renderMintRequestCard(request, true))
              )
            ) : activeTab === 'exchange-pending' ? (
              // 待兑换审计申请
              pendingExchangeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无待兑换审计申请</h3>
                  <p className="text-gray-500">所有申请都已处理完成</p>
                </div>
              ) : (
                pendingExchangeRequests.map((request) => renderExchangeRequestCard(request, true))
              )
            ) : activeTab === 'mint-history' ? (
              // 铸造历史申请
              completedMintRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无铸造历史申请</h3>
                  <p className="text-gray-500">还没有任何铸造申请记录</p>
                </div>
              ) : (
                completedMintRequests.map((request) => renderMintRequestCard(request, false))
              )
            ) : (
              // 兑换历史申请
              completedExchangeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无兑换历史申请</h3>
                  <p className="text-gray-500">还没有任何兑换申请记录</p>
                </div>
              ) : (
                completedExchangeRequests.map((request) => renderExchangeRequestCard(request, false))
              )
            )}
          </div>
        )}
      </div>

      {/* 审计表单弹窗 */}
      {showAuditForm && selectedRequest && (
        <AuditForm
          request={selectedRequest}
          onClose={() => setShowAuditForm(false)}
          onComplete={handleMintAuditComplete}
        />
      )}

      {/* 兑换审计表单弹窗 */}
      {showExchangeAuditForm && selectedExchangeRequest && (
        <ExchangeAuditForm
          request={selectedExchangeRequest}
          isOpen={showExchangeAuditForm}
          onClose={() => setShowExchangeAuditForm(false)}
          onComplete={handleExchangeAuditComplete}
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