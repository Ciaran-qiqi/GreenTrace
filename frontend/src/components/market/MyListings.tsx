'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

import { formatCarbonReduction, formatContractTimestamp, formatContractPrice } from '@/utils/formatUtils';
import { useTranslation } from '@/hooks/useI18n';
import { useMyListings, MyListing } from '@/hooks/market/useMyListings';
import { useUserSalesHistory } from '@/hooks/market/useUserSalesHistory';
import { useEventBasedCancelHistory } from '@/hooks/market/useEventBasedCancelHistory';
import { PriceUpdateModal } from './PriceUpdateModal';
import { CancelListingModal } from './CancelListingModal';

// MyListing接口已从useMyListings导入

interface MyListingsProps {
  className?: string;
}

/**
 * 我的挂单管理组件
 * @description 展示用户的所有NFT挂单，支持价格更新、取消挂单等操作
 * @param className 样式类名
 */
export const MyListings: React.FC<MyListingsProps> = ({ className = '' }) => {
  const { t, language } = useTranslation();
  const { address } = useAccount();
  const [selectedTab, setSelectedTab] = useState<'active' | 'sold' | 'cancelled'>('active');
  const [selectedListing, setSelectedListing] = useState<MyListing | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // 使用真实的挂单数据
  const { listings, isLoading, error, refetch } = useMyListings();
  
  // 获取销售历史数据（支持缓存）
  const { 
    salesHistory, 
    isLoading: salesLoading, 
    refetch: refetchSales,
    forceRefresh: forceRefreshSales,
    clearCache: clearSalesCache
  } = useUserSalesHistory();

  // 获取取消挂单历史数据（支持缓存）
  const { 
    cancelHistory, 
    isLoading: cancelLoading, 
    refetch: refetchCancel,
    forceRefresh: forceRefreshCancel,
    clearCache: clearCancelCache
  } = useEventBasedCancelHistory();

  // 合并所有数据（包括销售历史和取消记录）
  const allListings = [...listings, ...salesHistory, ...cancelHistory];
  
  // 过滤挂单
  const filteredListings = allListings.filter(listing => listing.status === selectedTab);

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'sold': return 'text-blue-600 bg-blue-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return t('myListings.status.active', '挂单中');
      case 'sold': return t('myListings.status.sold', '已售出');
      case 'cancelled': return t('myListings.status.cancelled', '已取消');
      default: return t('myListings.status.unknown', '未知');
    }
  };

  // 处理取消挂单
  const handleCancelListing = (listing: MyListing) => {
    setSelectedListing(listing);
    setShowCancelModal(true);
  };

  // 处理价格更新
  const handleUpdatePrice = (listing: MyListing) => {
    setSelectedListing(listing);
    setShowUpdateModal(true);
  };

  // 标签数据（包含销售历史）
  const tabs = [
    { key: 'active', label: t('myListings.tabs.active', '挂单中'), count: allListings.filter(l => l.status === 'active').length },
    { key: 'sold', label: t('myListings.tabs.sold', '已售出'), count: allListings.filter(l => l.status === 'sold').length },
    { key: 'cancelled', label: t('myListings.tabs.cancelled', '已取消'), count: allListings.filter(l => l.status === 'cancelled').length },
  ] as const;

  if (!address) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-4xl mb-4">🔐</div>
        <div className="text-gray-600 text-lg mb-2">{t('myListings.connectWallet', '请连接钱包')}</div>
        <div className="text-gray-500 text-sm">{t('myListings.connectWalletDesc', '连接钱包后查看您的NFT挂单')}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-800">{t('myListings.myListings', '我的挂单')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                refetch();
                refetchSales(); // 增量刷新，保留历史记录
                refetchCancel(); // 刷新取消记录
              }}
              disabled={isLoading || salesLoading || cancelLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {(isLoading || salesLoading || cancelLoading) ? t('common.loading', '刷新中...') : t('myListings.quickRefresh', '🔄 快速刷新')}
            </button>
            <div className="relative group">
              <button
                className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ⚙️
              </button>
              {/* 下拉菜单 */}
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <div className="p-1">
                  <button
                    onClick={() => {
                      refetch();
                      forceRefreshSales(); // 强制全量刷新
                      forceRefreshCancel(); // 强制刷新取消记录
                    }}
                    disabled={isLoading || salesLoading || cancelLoading}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                  >
                    {t('myListings.forceRefresh', '🔄 强制全量刷新')}
                  </button>
                  <button
                    onClick={() => {
                      clearSalesCache();
                      clearCancelCache();
                    }}
                    disabled={isLoading || salesLoading || cancelLoading}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {t('myListings.clearCache', '🗑️ 清理所有缓存')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-gray-600">{t('myListings.manageDescription', '管理您在市场上的NFT挂单')}</p>
        
        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 text-sm">
              ❌ {t('myListings.error', '错误')}: {error}
            </div>
          </div>
        )}

        {/* 标签页说明提示 */}
        <div className="mt-4">
          {selectedTab === 'active' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-700 text-sm">
                {t('myListings.activeTabTip', '🏪 这里显示您正在挂单中的NFT。您可以随时调整价格或取消挂单。')}
              </div>
            </div>
          )}
          {selectedTab === 'sold' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 text-sm">
                {t('myListings.soldTabTip', '💰 这里显示您已成功售出的NFT记录。恭喜您的环保故事得到了认可！')}
              </div>
            </div>
          )}
          {selectedTab === 'cancelled' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-gray-700 text-sm">
                {t('myListings.cancelledTabTip', '❌ 这里显示您已取消的挂单记录。取消的NFT仍归您所有，可以重新挂单。')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab.key
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* 挂单列表 */}
      {filteredListings.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-4">
            {selectedTab === 'active' ? '🏪' : selectedTab === 'sold' ? '✅' : '❌'}
          </div>
          <div className="text-gray-600 text-lg mb-2">
            {selectedTab === 'active' ? t('myListings.empty.active', '暂无挂单') : 
             selectedTab === 'sold' ? t('myListings.empty.sold', '暂无售出记录') : t('myListings.empty.cancelled', '暂无取消记录')}
          </div>
          <div className="text-gray-500 text-sm">
            {selectedTab === 'active' ? t('myListings.empty.activeDesc', '前往资产页面挂单您的NFT') : t('myListings.empty.otherDesc', '相关记录将在此显示')}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredListings.map(listing => (
            <div key={listing.listingId} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                {/* 左侧信息 */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {listing.title}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(listing.status)}`}>
                      {getStatusText(listing.status)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <div className="text-gray-500 mb-1">{t('myListings.tokenId', 'Token ID')}</div>
                      <div className="font-medium">#{listing.tokenId}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">{t('myListings.carbonReduction', '碳减排量')}</div>
                      <div className="font-medium">{formatCarbonReduction(listing.carbonReduction)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">{t('myListings.listedAt', '挂单时间')}</div>
                      <div className="font-medium">{formatContractTimestamp(listing.listedAt, language)}</div>
                    </div>
                  </div>

                  {/* 价格信息 */}
                  <div className="mt-4 flex items-center gap-6">
                    <div>
                      <div className="text-gray-500 text-sm mb-1">{t('myListings.currentPrice', '当前价格')}</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatContractPrice(listing.currentPrice)} CARB
                      </div>
                    </div>
                    {listing.currentPrice !== listing.originalPrice && (
                      <div>
                        <div className="text-gray-500 text-sm mb-1">{t('myListings.originalPrice', '原价格')}</div>
                        <div className="text-gray-600 line-through">
                          {formatContractPrice(listing.originalPrice)} CARB
                        </div>
                      </div>
                    )}
                    {(listing.views || listing.offers) && (
                      <div className="text-sm text-gray-500">
                        {listing.views && <div>👀 {listing.views} {t('myListings.views', '次浏览')}</div>}
                        {listing.offers && <div>💰 {listing.offers} {t('myListings.offers', '个报价')}</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧操作 */}
                {listing.status === 'active' && (
                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleUpdatePrice(listing)}
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {t('myListings.updatePrice', '调整价格')}
                    </button>
                    <button
                      onClick={() => handleCancelListing(listing)}
                      disabled={isLoading}
                      className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {t('myListings.cancelListing', '取消挂单')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 价格更新模态框 */}
      {showUpdateModal && selectedListing && (
        <PriceUpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          onSuccess={() => {
            refetch(); // 刷新挂单数据
          }}
          listing={{
            tokenId: selectedListing.tokenId,
            title: selectedListing.title,
            currentPrice: selectedListing.currentPrice,
            originalPrice: selectedListing.originalPrice,
          }}
        />
      )}

      {/* 取消挂单模态框 */}
      {showCancelModal && selectedListing && (
        <CancelListingModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            refetch(); // 刷新挂单数据
          }}
          listing={{
            tokenId: selectedListing.tokenId,
            title: selectedListing.title,
            currentPrice: selectedListing.currentPrice,
            carbonReduction: selectedListing.carbonReduction,
          }}
        />
      )}
    </div>
  );
}; 