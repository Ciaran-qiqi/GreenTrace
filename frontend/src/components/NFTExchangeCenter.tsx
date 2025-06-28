'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { useRequestExchangeNFT } from '@/contracts/hooks/useGreenTrace';
import { useExchangeAuditData } from '@/hooks/useExchangeAuditData';
import { FinalExchangeButton } from './FinalExchangeButton';
import { NFTViewButton } from './NFTViewButton';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';
import { getGreenTalesNFTAddress } from '@/contracts/addresses';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { useTranslation } from '@/hooks/useI18n';

// 检查NFT是否存在的Hook
const useCheckNFTExists = (tokenId: string) => {
  const chainId = useChainId();
  const nftContractAddress = getGreenTalesNFTAddress(chainId);
  
  return useReadContract({
    address: nftContractAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'ownerOf',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!tokenId,
      retry: false, // 不重试，因为NFT不存在会抛出错误
    }
  });
};

// NFT兑换中心组件
export const NFTExchangeCenter: React.FC = () => {
  const { t } = useTranslation();
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');

  // 获取兑换审计数据
  const { exchangeAuditRequests, loading, forceRefresh } = useExchangeAuditData();

  // 请求兑换NFT的Hook
  const { isConfirmed, error } = useRequestExchangeNFT();

  // 只在客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 处理兑换申请完成
  useEffect(() => {
    if (isConfirmed) {
      alert(t('exchange.success.applicationSubmitted', '兑换申请提交成功！请等待审计员审核。'));
      forceRefresh();
    }
  }, [isConfirmed, forceRefresh, t]);

  // 处理错误
  useEffect(() => {
    if (error) {
      console.error('兑换申请错误:', error);
      alert(t('exchange.errors.applicationFailed', '兑换申请失败: {error}', { error: error.message }));
    }
  }, [error, t]);

  // 筛选用户的兑换申请
  const userExchangeRequests = React.useMemo(() => {
    if (!address) return [];
    return exchangeAuditRequests.filter((record: any) => 
      record.requester.toLowerCase() === address.toLowerCase()
    );
  }, [exchangeAuditRequests, address]);

  // 按状态分组
  const requestsByStatus = React.useMemo(() => {
    return {
      pending: userExchangeRequests.filter((req: any) => req.auditStatus === 'pending'),
      approved: userExchangeRequests.filter((req: any) => req.auditStatus === 'approved'),
      rejected: userExchangeRequests.filter((req: any) => req.auditStatus === 'rejected')
    };
  }, [userExchangeRequests]);

  // 状态徽章组件
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const getStatusConfig = (status: string) => {
      switch (status) {
        case 'pending':
          return { text: `⏳ ${t('exchange.status.pending', '待审核')}`, className: 'bg-yellow-100 text-yellow-800' };
        case 'approved':
          return { text: `✅ ${t('exchange.status.approved', '已批准')}`, className: 'bg-green-100 text-green-800' };
        case 'rejected':
          return { text: `❌ ${t('exchange.status.rejected', '已拒绝')}`, className: 'bg-red-100 text-red-800' };
        default:
          return { text: t('exchange.status.unknown', '未知状态'), className: 'bg-gray-100 text-gray-800' };
      }
    };

    const config = getStatusConfig(status);
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.text}
      </span>
    );
  };

  // 带NFT存在性检查的兑换申请卡片组件
  const ExchangeRequestCard = ({ request }: { request: any }) => {
    const { data: nftOwner, error: nftError } = useCheckNFTExists(request.nftTokenId);
    const nftExists = !nftError && nftOwner;

    return (
      <div
        className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-white to-gray-50/30"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                🔄 {t('exchange.request.title', '兑换申请')} #{request.cashId}
              </h3>
              <StatusBadge status={request.auditStatus} />
              {/* 显示NFT状态 */}
              {!nftExists && (
                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                  🔥 {t('exchange.request.exchanged', '已兑换')}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">
              NFT #{request.nftTokenId}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>{formatTimestamp(request.blockTimestamp)}</div>
            <div className="mt-1">
              {t('exchange.request.fee', '手续费:')} {formatFeeAmount(request.requestFee)} CARB
            </div>
          </div>
        </div>

        {/* 申请详情 */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-gray-500">{t('exchange.request.currentPrice', 'NFT当前价格:')}</span>
            <span className="ml-2 font-medium text-green-600">{formatFeeAmount(request.basePrice)} CARB</span>
          </div>
          {request.auditStatus === 'approved' && request.auditedCarbonValue && (
            <div>
              <span className="text-gray-500">{t('exchange.request.auditedValue', '审计确认价值:')}</span>
              <span className="ml-2 font-medium text-green-600">
                {formatFeeAmount(request.auditedCarbonValue)} CARB
              </span>
            </div>
          )}
          {request.auditor && (
            <div className="col-span-2">
              <span className="text-gray-500">{t('exchange.request.auditor', '审计员:')}</span>
              <span className="ml-2 font-mono text-xs">
                {request.auditor.slice(0, 6)}...{request.auditor.slice(-4)}
              </span>
            </div>
          )}
        </div>

        {/* 审计意见 */}
        {request.auditComment && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800">
              <span className="font-medium">{t('exchange.request.auditComment', '审计意见:')} </span>
              <span className="italic">&ldquo;{request.auditComment}&rdquo;</span>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {/* 根据NFT存在状态显示不同的查看按钮 */}
          {nftExists ? (
            <NFTViewButton 
              nftTokenId={request.nftTokenId}
              buttonText={t('exchange.request.viewNFT', '查看NFT')}
              buttonStyle="secondary"
              size="sm"
            />
          ) : (
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded text-sm font-medium border border-orange-200">
              🔥 {t('exchange.request.nftDestroyed', 'NFT已销毁')}
            </div>
          )}
          
          {/* 根据状态和NFT存在性显示不同的按钮 */}
          {nftExists && request.auditStatus === 'approved' && request.auditedCarbonValue && (
            <FinalExchangeButton
              exchangeRequest={{
                cashId: request.cashId,
                nftTokenId: request.nftTokenId,
                auditedCarbonValue: request.auditedCarbonValue,
                auditor: request.auditor,
                auditComment: request.auditComment
              }}
              onExchangeSuccess={() => {
                // 立即刷新多个数据源以同步状态
                forceRefresh();
                
                // 通知其他页面也刷新数据
                if (typeof window !== 'undefined') {
                  // 发送全局事件通知其他组件刷新
                  window.dispatchEvent(new CustomEvent('nft-exchanged', {
                    detail: { nftTokenId: request.nftTokenId, cashId: request.cashId }
                  }));
                }
                
                alert(t('exchange.success.exchangeCompleted', '兑换完成！NFT已销毁，CARB代币已到账。'));
              }}
              buttonText={t('exchange.request.executeExchange', '执行兑换')}
              className="flex-1"
            />
          )}
          
          {!nftExists && request.auditStatus === 'approved' && (
            <div className="flex-1 bg-green-100 text-green-800 px-4 py-2 rounded-lg text-center text-sm font-medium border border-green-200">
              ✅ {t('exchange.request.exchangeCompleted', '兑换已完成')}
            </div>
          )}
          
          {request.auditStatus === 'pending' && (
            <div className="flex-1 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-center text-sm font-medium">
              {t('exchange.request.waitingAudit', '等待审计中...')}
            </div>
          )}
          
          {request.auditStatus === 'rejected' && (
            <div className="flex-1 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-center text-sm font-medium">
              {t('exchange.request.applicationRejected', '申请被拒绝')}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 等待客户端渲染
  if (!isClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('exchange.loading', '正在加载...')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('exchange.connectWallet', '请先连接钱包')}</h3>
            <p className="text-gray-500">{t('exchange.connectWalletDesc', '连接钱包后查看您的兑换记录')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* 标签切换 */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('info')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔄 {t('exchange.tabs.info', '兑换说明')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 {t('exchange.tabs.history', '我的兑换记录')} ({userExchangeRequests.length})
            </button>
          </nav>
        </div>

        {/* 标签内容 */}
        <div className="p-8">
          {activeTab === 'info' && (
            <div>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">{t('exchange.info.title', 'NFT兑换说明')}</h2>
                <p className="text-lg text-gray-600">{t('exchange.info.subtitle', '了解如何将您的绿色NFT兑换为CARB代币')}</p>
              </div>

              {/* 兑换流程说明 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 mb-8 border border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-4">{t('exchange.info.process.title', '兑换流程')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">1</div>
                    <h4 className="font-semibold text-blue-800 mb-2">{t('exchange.info.process.step1.title', '提交申请')}</h4>
                    <p className="text-sm text-blue-600">{t('exchange.info.process.step1.desc', '在资产页面选择NFT并提交兑换申请')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">2</div>
                    <h4 className="font-semibold text-blue-800 mb-2">{t('exchange.info.process.step2.title', '等待审计')}</h4>
                    <p className="text-sm text-blue-600">{t('exchange.info.process.step2.desc', '审计员评估NFT实际价值并确定兑换金额')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">3</div>
                    <h4 className="font-semibold text-blue-800 mb-2">{t('exchange.info.process.step3.title', '执行兑换')}</h4>
                    <p className="text-sm text-blue-600">{t('exchange.info.process.step3.desc', '审计通过后，在此页面执行最终兑换')}</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">4</div>
                    <h4 className="font-semibold text-green-800 mb-2">{t('exchange.info.process.step4.title', '完成兑换')}</h4>
                    <p className="text-sm text-green-600">{t('exchange.info.process.step4.desc', 'NFT销毁，获得相应的CARB代币')}</p>
                  </div>
                </div>
              </div>

              {/* 费用说明 */}
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 rounded-xl p-6 border border-yellow-200">
                <h3 className="text-xl font-semibold text-yellow-800 mb-4">{t('exchange.info.fees.title', '费用说明')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl mb-2">📝</div>
                    <div className="font-medium text-yellow-800 mb-1">{t('exchange.info.fees.applicationFee', '申请手续费')}</div>
                    <div className="text-yellow-600">{t('exchange.info.fees.applicationFeeDesc', '碳减排量1%或1个CARB中的较大值')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-2">💰</div>
                    <div className="font-medium text-yellow-800 mb-1">{t('exchange.info.fees.systemFee', '系统手续费')}</div>
                    <div className="text-yellow-600">{t('exchange.info.fees.systemFeeDesc', '兑换价值的1%')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-2">👨‍💼</div>
                    <div className="font-medium text-yellow-800 mb-1">{t('exchange.info.fees.auditFee', '审计费用')}</div>
                    <div className="text-yellow-600">{t('exchange.info.fees.auditFeeDesc', '兑换价值的4%')}</div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-yellow-100/50 rounded-lg">
                  <p className="text-sm text-yellow-700">
                    <strong>{t('exchange.info.fees.finalAmount', '最终到账：')}</strong>{t('exchange.info.fees.finalAmountDesc', '审计确认价值的95%（扣除系统手续费和审计费用）')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{t('exchange.history.title', '我的兑换记录')}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={forceRefresh}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {loading ? t('exchange.history.refreshing', '刷新中...') : t('exchange.history.refresh', '刷新')}
                  </button>
                  <button
                    onClick={() => window.location.href = '/assets'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    {t('exchange.history.applyExchange', '去申请兑换')}
                  </button>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-yellow-600 text-sm">{t('exchange.history.stats.pending', '待审核')}</div>
                  <div className="text-2xl font-bold text-yellow-800">{requestsByStatus.pending.length}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-600 text-sm">{t('exchange.history.stats.approved', '可兑换')}</div>
                  <div className="text-2xl font-bold text-green-800">{requestsByStatus.approved.length}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-red-600 text-sm">{t('exchange.history.stats.rejected', '已拒绝')}</div>
                  <div className="text-2xl font-bold text-red-800">{requestsByStatus.rejected.length}</div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">{t('exchange.history.loading', '正在加载兑换记录...')}</p>
                </div>
              ) : userExchangeRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔄</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('exchange.history.noRecords', '暂无兑换记录')}</h3>
                  <p className="text-gray-500 mb-6">{t('exchange.history.noRecordsDesc', '您还没有提交任何NFT兑换申请')}</p>
                  <button
                    onClick={() => window.location.href = '/assets'}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {t('exchange.history.viewMyNFTs', '查看我的NFT')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {userExchangeRequests.map(request => (
                    <ExchangeRequestCard key={request.cashId} request={request} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 