'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';

import { formatCarbonReduction, formatContractTimestamp, formatContractPrice } from '@/utils/formatUtils';
import { useMyListings, MyListing } from '@/hooks/market/useMyListings';

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
  const { address } = useAccount();
  const [selectedTab, setSelectedTab] = useState<'active' | 'sold' | 'cancelled'>('active');
  const [selectedListing, setSelectedListing] = useState<MyListing | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  
  // 使用真实的挂单数据
  const { listings, isLoading, error, refetch } = useMyListings();

  // 过滤挂单
  const filteredListings = listings.filter(listing => listing.status === selectedTab);

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
      case 'active': return '挂单中';
      case 'sold': return '已售出';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  // 处理取消挂单
  const handleCancelListing = async (listing: MyListing) => {
    if (!window.confirm('确定要取消挂单吗？')) return;
    
    try {
      // 这里调用智能合约取消挂单
      console.log(`取消挂单: ${listing.listingId}`);
      // TODO: 实现取消挂单功能
      // await cancelListing(listing.listingId);
      
      alert('取消挂单功能开发中...');
      refetch(); // 刷新数据
    } catch (error) {
      console.error('取消挂单失败:', error);
      alert('取消挂单失败');
    }
  };

  // 处理价格更新
  const handleUpdatePrice = (listing: MyListing) => {
    setSelectedListing(listing);
    setShowUpdateModal(true);
  };

  // 标签数据
  const tabs = [
    { key: 'active', label: '挂单中', count: listings.filter(l => l.status === 'active').length },
    { key: 'sold', label: '已售出', count: listings.filter(l => l.status === 'sold').length },
    { key: 'cancelled', label: '已取消', count: listings.filter(l => l.status === 'cancelled').length },
  ] as const;

  if (!address) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-gray-400 text-4xl mb-4">🔐</div>
        <div className="text-gray-600 text-lg mb-2">请连接钱包</div>
        <div className="text-gray-500 text-sm">连接钱包后查看您的NFT挂单</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* 头部 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-800">我的挂单</h2>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>
        <p className="text-gray-600">管理您在市场上的NFT挂单</p>
        
        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-600 text-sm">
              ❌ {error}
            </div>
          </div>
        )}
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
            {selectedTab === 'active' ? '暂无挂单' : 
             selectedTab === 'sold' ? '暂无售出记录' : '暂无取消记录'}
          </div>
          <div className="text-gray-500 text-sm">
            {selectedTab === 'active' ? '前往资产页面挂单您的NFT' : '相关记录将在此显示'}
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
                      <div className="text-gray-500 mb-1">Token ID</div>
                      <div className="font-medium">#{listing.tokenId}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">碳减排量</div>
                      <div className="font-medium">{formatCarbonReduction(listing.carbonReduction)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 mb-1">挂单时间</div>
                      <div className="font-medium">{formatContractTimestamp(listing.listedAt)}</div>
                    </div>
                  </div>

                  {/* 价格信息 */}
                  <div className="mt-4 flex items-center gap-6">
                    <div>
                      <div className="text-gray-500 text-sm mb-1">当前价格</div>
                      <div className="text-xl font-bold text-green-600">
                        {formatContractPrice(listing.currentPrice)} CARB
                      </div>
                    </div>
                    {listing.currentPrice !== listing.originalPrice && (
                      <div>
                        <div className="text-gray-500 text-sm mb-1">原价格</div>
                        <div className="text-gray-600 line-through">
                          {formatContractPrice(listing.originalPrice)} CARB
                        </div>
                      </div>
                    )}
                    {(listing.views || listing.offers) && (
                      <div className="text-sm text-gray-500">
                        {listing.views && <div>👀 {listing.views} 次浏览</div>}
                        {listing.offers && <div>💰 {listing.offers} 个报价</div>}
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
                      调整价格
                    </button>
                    <button
                      onClick={() => handleCancelListing(listing)}
                      disabled={isLoading}
                      className="px-4 py-2 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      取消挂单
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 价格更新模态框 - 简化版本 */}
      {showUpdateModal && selectedListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              调整价格 - #{selectedListing.tokenId}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                新价格 (CARB)
              </label>
              <input
                type="number"
                step="0.01"
                defaultValue={selectedListing.currentPrice}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="请输入新价格"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  // 这里处理价格更新逻辑
                  setShowUpdateModal(false);
                  alert('价格更新功能开发中...');
                }}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                确认更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 