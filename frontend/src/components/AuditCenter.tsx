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
import { useTranslation } from '@/hooks/useI18n';

// Tag Page Type -Separate Casting and Redemption History
type TabType = 'mint-pending' | 'exchange-pending' | 'mint-history' | 'exchange-history';

// Check whether nft exists hook (used to determine whether it has been redeemed and destroyed)
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
      retry: false, // Don't try again, because nft does not exist will throw an error
    }
  });
};

// Status Badge Component
const StatusBadge: React.FC<{ status: AuditRequest['auditStatus'] | ExchangeAuditRequest['auditStatus'] }> = ({ status }) => {
  const { t } = useTranslation();
  
  const statusMap = {
    pending: { label: t('audit.status.pending', '待审计'), className: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
    approved: { label: t('audit.status.approved', '已通过'), className: 'bg-green-100 text-green-800', icon: '✅' },
    rejected: { label: t('audit.status.rejected', '已拒绝'), className: 'bg-red-100 text-red-800', icon: '❌' },
    exchanged: { label: t('audit.status.exchanged', '已兑换'), className: 'bg-blue-100 text-blue-800', icon: '🎉' },
  };
  
  const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

// Get the green trace contract address according to the chain id
const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network
      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia Test Network
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // Local foundry test network
      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// Audit Center Components
export const AuditCenter: React.FC = () => {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [selectedRequest, setSelectedRequest] = useState<AuditRequest | null>(null);
  const [selectedExchangeRequest, setSelectedExchangeRequest] = useState<ExchangeAuditRequest | null>(null);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [showExchangeAuditForm, setShowExchangeAuditForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('mint-pending');
  
  // Get the contract address
  const greenTraceAddress = getGreenTraceAddress(chainId);
  
  // Check if it is an auditor -Use the same logic as Navigation
  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  });
  
  // Obtain casting audit data
  const { 
    loading: mintLoading, 
    refresh: refreshMint, 
    forceRefresh: forceRefreshMint, 
    isClient, 
    getAuditStats, 
    getPendingRequests, 
    getCompletedRequests 
  } = useAuditData();
  
  // Obtain redemption audit data
  const { 
    loading: exchangeLoading, 
    refresh: refreshExchange, 
    forceRefresh: forceRefreshExchange, 
    getExchangeAuditStats, 
    getPendingExchangeRequests, 
    getCompletedExchangeRequests 
  } = useExchangeAuditData();

  // Convert audit request to request record format
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
      // Audit Center-specific fields
      auditStatus: request.auditStatus,
      auditedCarbonValue: request.auditedCarbonValue,
      auditComment: request.auditComment,
      nftTokenId: request.nftTokenId,
      requester: request.requester,
      blockTimestamp: request.blockTimestamp,
      requestId: request.requestId
    };
  };
  
  // Calculate statistics and obtain classified data
  const mintStats = getAuditStats();
  const exchangeStats = getExchangeAuditStats();
  const pendingMintRequests = getPendingRequests();
  const completedMintRequests = getCompletedRequests();
  const pendingExchangeRequests = getPendingExchangeRequests();
  const completedExchangeRequests = getCompletedExchangeRequests();
  
  // Merge statistics
  const totalStats = {
    totalCount: mintStats.totalCount + exchangeStats.totalCount,
    pendingCount: mintStats.pendingCount + exchangeStats.pendingCount,
    approvedCount: mintStats.approvedCount + exchangeStats.approvedCount,
    rejectedCount: mintStats.rejectedCount + exchangeStats.rejectedCount,
    exchangedCount: 0, // Redeem unique status, temporarily set to 0
  };

  // Processing starts casting audit
  const handleStartMintAudit = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowAuditForm(true);
  };

  // Processing starts redemption audit
  const handleStartExchangeAudit = (request: ExchangeAuditRequest) => {
    setSelectedExchangeRequest(request);
    setShowExchangeAuditForm(true);
  };

  // Processing to view details
  const handleViewDetails = (request: AuditRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // Handling casting audit completed
  const handleMintAuditComplete = () => {
    setShowAuditForm(false);
    setSelectedRequest(null);
    // Refresh data
    refreshMint();
  };

  // Processing and redemption audit completed
  const handleExchangeAuditComplete = () => {
    setShowExchangeAuditForm(false);
    setSelectedExchangeRequest(null);
    // Refresh data
    refreshExchange();
  };

  // Close the details pop-up window
  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
  };

  // Refresh all data
  const refreshAll = () => {
    refreshMint();
    refreshExchange();
  };

  // Force refresh all data
  const forceRefreshAll = () => {
    forceRefreshMint();
    forceRefreshExchange();
  };

  // Listen to global nft redemption events and update status in real time
  React.useEffect(() => {
    const handleNFTExchanged = (event: CustomEvent) => {
      console.log('审计中心检测到NFT兑换事件:', event.detail);
      // Force refresh the data immediately to reflect the redemption status
      forceRefreshAll();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      
      return () => {
        window.removeEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      };
    }
  }, [forceRefreshMint, forceRefreshExchange]);

  // Is it currently loading
  const loading = mintLoading || exchangeLoading;

  // Format time -Fix SSR hydration issues
  const formatTime = (timestamp: string) => {
    // Block timestamp is already a millisecond-level timestamp, no need to multiply by 1000
    const date = new Date(parseInt(timestamp));
    
    // Check if the timestamp is valid
    if (isNaN(date.getTime())) {
      return '无效时间';
    }
    
    // When rendering on the server, only the dates in fixed format are displayed to avoid locale differences
    if (typeof window === 'undefined') {
      return date.toISOString().slice(0, 19).replace('T', ' ');
    }
    
    // Client usage localization time
    return date.toLocaleString();
  };

  // Casting application card assembly with nft existence check
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
              {/* For redeemed nft, display additional redemption tags */}
              {request.nftTokenId && !nftExists && request.auditStatus === 'approved' && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                  🔥 {t('audit.exchanged', '已兑换')}
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
              {t('audit.fee', '费用')}: {formatFeeAmount(request.totalFee)} CARB
            </div>
          </div>
        </div>

        {/* Application details */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">{t('audit.applicant', '申请人')}:</span>
            <span className="ml-2 font-medium">
              {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{t('audit.carbonReduction', '申请碳减排量')}:</span>
            <span className="ml-2 font-medium">{request.carbonReduction} tCO₂e</span>
          </div>
          <div>
            <span className="text-gray-500">{t('audit.transactionHash', '交易哈希')}:</span>
            <span className="ml-2 font-medium">
              {request.transactionHash.slice(0, 10)}...
            </span>
          </div>
          {!isPending && request.auditStatus === 'approved' && (
            <div>
              <span className="text-gray-500">{t('audit.auditedValue', '审计确认价值')}:</span>
              <span className="ml-2 font-medium text-green-600">
                {request.auditedCarbonValue || request.carbonReduction} tCO₂e
              </span>
              {request.auditedCarbonValue && request.auditedCarbonValue !== request.carbonReduction && (
                <div className="text-xs text-gray-400 mt-1">
                  * {t('audit.originalRequest', '原申请')}: {request.carbonReduction} tCO₂e，{t('audit.auditorAdjusted', '审计员调整为')}: {request.auditedCarbonValue} tCO₂e
                </div>
              )}
            </div>
          )}
        </div>

        {/* Operation buttons and status descriptions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            {isPending ? (
              <>
                <button
                  onClick={() => handleStartMintAudit(request)}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  {t('audit.startAudit', '开始审计')}
                </button>
                <button 
                  onClick={() => handleViewDetails(request)}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  {t('audit.viewDetails', '查看详情')}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => handleViewDetails(request)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t('audit.viewDetails', '查看详情')}
                </button>
                {/* If nft is cast, the view nft button is always displayed (nft info section will automatically handle the destroyed situation) */}
                {request.nftTokenId && (
                  <NFTViewButton 
                    nftTokenId={request.nftTokenId}
                    buttonText={t('audit.viewNFT', '查看NFT')}
                    buttonStyle="secondary"
                    size="sm"
                    nftExists={nftExists}
                  />
                )}
              </>
            )}
          </div>
          
          {/* Status Description -Display different states according to NFT existence */}
          {!isPending && (
            <div className="text-sm">
              {request.auditStatus === 'pending' && (
                <span className="text-yellow-600">
                  ⏳ {t('audit.waitingForAudit', '等待审计')}
                </span>
              )}
              {request.auditStatus === 'approved' && (
                <>
                  {request.nftTokenId ? (
                    nftExists ? (
                      <span className="text-purple-600 font-medium">
                        🎨 {t('audit.nftMinted', '已铸造NFT')} #{request.nftTokenId}
                      </span>
                    ) : (
                      <span className="text-orange-600 font-medium">
                        🔥 {t('audit.nftDestroyed', '已销毁NFT')} #{request.nftTokenId}
                      </span>
                    )
                  ) : (
                    <span className="text-green-600">
                      ✅ {t('audit.auditPassed', '审计通过，等待用户铸造')}
                    </span>
                  )}
                </>
              )}
              {request.auditStatus === 'rejected' && (
                <span className="text-red-600">
                  ❌ {t('audit.auditRejected', '审计被拒绝')}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Description of the unique historical application */}
        {!isPending && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              <div className="flex justify-between items-center">
                <span>{t('audit.applicationStatus', '申请状态')}: {t('audit.basedOnBlockchain', '基于区块链事件记录')}</span>
                <span>
                  {request.nftTokenId 
                    ? nftExists
                      ? `🎨 ${t('audit.nftMintedComplete', 'NFT已铸造完成')} (#${request.nftTokenId})`
                      : `🔥 ${t('audit.nftExchangedDestroyed', 'NFT已兑换销毁')} (#${request.nftTokenId})`
                    : request.auditStatus === 'approved' 
                      ? `⏳ ${t('audit.auditPassedWaiting', '已审核通过，等待铸造')}` 
                      : t('audit.completeHistory', '完整的申请历史记录')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render casting application card
  const renderMintRequestCard = (request: AuditRequest, isPending: boolean = false) => (
    <MintRequestCard key={request.transactionHash || `${request.tokenId}-${request.blockTimestamp}`} request={request} isPending={isPending} />
  );

  // Redemption application card component with nft existence check
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
                🔄 {t('audit.exchangeRequest', '兑换申请')} #{request.cashId}
              </h3>
              <StatusBadge status={request.auditStatus} />
              {/* Show NFT redemption status -redeemed applications show additional redemption tags */}
              {!nftExists && request.auditStatus === 'approved' && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                  🔥 {t('audit.exchanged', '已兑换')}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">
              NFT #{request.nftTokenId} {t('audit.applyForExchange', '申请兑换')}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{formatTime(request.blockTimestamp)}</div>
            <div className="mt-1">
              {t('audit.processingFee', '手续费')}: {formatFeeAmount(request.requestFee)} CARB
            </div>
          </div>
        </div>

        {/* Application details */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">{t('audit.applicant', '申请人')}:</span>
            <span className="ml-2 font-medium">
              {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{t('audit.nftTokenId', 'NFT Token ID')}:</span>
            <span className="ml-2 font-medium">#{request.nftTokenId}</span>
          </div>
          <div>
            <span className="text-gray-500">{t('audit.nftCurrentPrice', 'NFT当前价格')}:</span>
            <span className="ml-2 font-medium text-green-600">{formatFeeAmount(request.basePrice)} CARB</span>
          </div>
          {!isPending && request.auditStatus === 'approved' && request.auditedCarbonValue && (
            <div>
              <span className="text-gray-500">{t('audit.auditedValue', '审计确认价值')}:</span>
              <span className="ml-2 font-medium text-green-600">
                {formatFeeAmount(request.auditedCarbonValue)} CARB
              </span>
            </div>
          )}
        </div>

        {/* Operation buttons and status descriptions */}
        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            {isPending ? (
              <>
                <button
                  onClick={() => handleStartExchangeAudit(request)}
                  className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
                >
                  {t('audit.startAudit', '开始审计')}
                </button>
                <button 
                  onClick={() => {
                    // View nft information
                  }}
                  className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  {t('audit.viewNFT', '查看NFT')}
                </button>
              </>
            ) : (
              <>
                <NFTViewButton 
                  nftTokenId={request.nftTokenId}
                  buttonText={t('audit.viewNFT', '查看NFT')}
                  buttonStyle="secondary"
                  size="sm"
                  nftExists={nftExists}
                />
              </>
            )}
          </div>
          
          {/* Status Description -Display different states according to NFT existence */}
          {!isPending && (
            <div className="text-sm">
              {request.auditStatus === 'pending' && (
                <span className="text-yellow-600">
                  ⏳ {t('audit.waitingForAudit', '等待审计')}
                </span>
              )}
              {request.auditStatus === 'approved' && (
                <>
                  {nftExists ? (
                    <span className="text-green-600">
                      ✅ {t('audit.auditPassedWaitingExchange', '审计通过，等待用户兑换')}
                    </span>
                  ) : (
                    <span className="text-blue-600 font-medium">
                      💰 {t('audit.exchangeCompleted', '兑换已完成，NFT已销毁')}
                    </span>
                  )}
                </>
              )}
              {request.auditStatus === 'rejected' && (
                <span className="text-red-600">
                  ❌ {t('audit.auditRejected', '审计被拒绝')}
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Description of the unique historical application */}
        {!isPending && (
          <div className="mt-3 pt-3 border-t border-purple-100">
            <div className="text-xs text-gray-500">
              <div className="flex justify-between items-center">
                <span>{t('audit.exchangeApplicationStatus', '兑换申请状态')}: {t('audit.basedOnBlockchain', '基于区块链事件记录')}</span>
                <span>
                  {request.auditStatus === 'approved' 
                    ? nftExists 
                      ? `✅ ${t('audit.auditPassedWaiting', '已审核通过，等待兑换')}` 
                      : `🎉 ${t('audit.exchangeCompletedDestroyed', '兑换已完成，NFT已销毁')}`
                    : t('audit.completeExchangeHistory', '完整的兑换申请历史记录')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Rendering and redemption audit application card
  const renderExchangeRequestCard = (request: ExchangeAuditRequest, isPending: boolean = false) => (
    <ExchangeRequestCard key={request.transactionHash || `${request.cashId}-${request.blockTimestamp}`} request={request} isPending={isPending} />
  );

  // Waiting for client rendering
  if (!isClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('audit.loading', '正在加载...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // If the wallet is not connected
  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.connectWallet', '请先连接钱包')}</h3>
            <p className="text-gray-500">{t('audit.connectWalletDesc', '连接钱包后访问审计中心')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine user permissions -keep consistent with Navigation components
  const isAuthorizedAuditor = Boolean(address && isAuditor);
  
  // Debugging information
  console.log('AuditCenter权限检查:', {
    address,
    isConnected,
    isAuditor,
    isAuthorizedAuditor,
    chainId,
    greenTraceAddress
  });
  
  // If the wallet is not connected
  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔌</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.walletNotConnected', '未连接钱包')}</h3>
            <p className="text-gray-500">{t('audit.walletNotConnectedDesc', '请先连接钱包以访问审计中心')}</p>
          </div>
        </div>
      </div>
    );
  }

  // If not an auditor
  if (!isAuthorizedAuditor) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.insufficientPermissions', '权限不足')}</h3>
            <p className="text-gray-500">{t('audit.notAuthorizedAuditor', '您不是授权的审计员，无法访问审计中心')}</p>
            <div className="mt-4 text-sm text-gray-400">
              <p>{t('audit.currentAddress', '当前地址')}: {address}</p>
              <p>{t('audit.auditorStatus', '审计员状态')}: {isAuditor ? t('audit.yes', '是') : t('audit.no', '否')}</p>
              <p>{t('audit.contractAddress', '合约地址')}: {greenTraceAddress}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Statistical information */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {totalStats.totalCount}
            </div>
            <div className="text-gray-600">{t('audit.totalApplications', '总申请数')}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600 mb-2">
              {totalStats.pendingCount}
            </div>
            <div className="text-gray-600">{t('audit.pendingApplications', '待审计申请')}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {totalStats.approvedCount}
            </div>
            <div className="text-gray-600">{t('audit.approvedApplications', '已通过审计')}</div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">
              {totalStats.rejectedCount}
            </div>
            <div className="text-gray-600">{t('audit.rejectedApplications', '已拒绝申请')}</div>
          </div>
        </div>
      </div>

      {/* Tags and application list */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {/* Tag header */}
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
              {t('audit.mintAuditApplications', '铸造审计申请')} ({mintStats.pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('exchange-pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'exchange-pending'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('audit.exchangeAuditApplications', '兑换审计申请')} ({exchangeStats.pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('mint-history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'mint-history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('audit.mintHistory', '铸造历史')} ({completedMintRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('exchange-history')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'exchange-history'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('audit.exchangeHistory', '兑换历史')} ({completedExchangeRequests.length})
            </button>
          </div>
          
          {/* Refresh button */}
          <div className="flex gap-2">
            <button
              onClick={() => refreshAll()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? t('audit.refreshing', '刷新中...') : t('audit.refresh', '刷新')}
            </button>
          </div>
        </div>

        {/* Tag page content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('audit.loadingData', '正在加载数据...')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'mint-pending' ? (
              // Casting audit application
              pendingMintRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.noPendingMintApplications', '暂无待审计铸造申请')}</h3>
                  <p className="text-gray-500">{t('audit.allMintApplicationsProcessed', '所有铸造申请都已处理完成')}</p>
                </div>
              ) : (
                pendingMintRequests.map((request) => renderMintRequestCard(request, true))
              )
            ) : activeTab === 'exchange-pending' ? (
              // Application for redemption audit
              pendingExchangeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.noPendingExchangeApplications', '暂无待兑换审计申请')}</h3>
                  <p className="text-gray-500">{t('audit.allApplicationsProcessed', '所有申请都已处理完成')}</p>
                </div>
              ) : (
                pendingExchangeRequests.map((request) => renderExchangeRequestCard(request, true))
              )
            ) : activeTab === 'mint-history' ? (
              // Casting History Application
              completedMintRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.noMintHistory', '暂无铸造历史申请')}</h3>
                  <p className="text-gray-500">{t('audit.noMintRecords', '还没有任何铸造申请记录')}</p>
                </div>
              ) : (
                completedMintRequests.map((request) => renderMintRequestCard(request, false))
              )
            ) : (
              // Redeem history application
              completedExchangeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('audit.noExchangeHistory', '暂无兑换历史申请')}</h3>
                  <p className="text-gray-500">{t('audit.noExchangeRecords', '还没有任何兑换申请记录')}</p>
                </div>
              ) : (
                completedExchangeRequests.map((request) => renderExchangeRequestCard(request, false))
              )
            )}
          </div>
        )}
      </div>

      {/* Audit form pop-up window */}
      {showAuditForm && selectedRequest && (
        <AuditForm
          request={selectedRequest}
          onClose={() => setShowAuditForm(false)}
          onComplete={handleMintAuditComplete}
        />
      )}

      {/* Redemption audit form pop-up window */}
      {showExchangeAuditForm && selectedExchangeRequest && (
        <ExchangeAuditForm
          request={selectedExchangeRequest}
          isOpen={showExchangeAuditForm}
          onClose={() => setShowExchangeAuditForm(false)}
          onComplete={handleExchangeAuditComplete}
        />
      )}

      {/* View pop-up window for details */}
      <RequestDetailModal
        record={selectedRequest ? convertToRequestRecord(selectedRequest) : null}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
      />
    </div>
  );
}; 