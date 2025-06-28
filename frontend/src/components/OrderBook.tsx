'use client'

import { useEffect, useState } from 'react'
import { useCarbonUSDTMarket } from '@/hooks/useCarbonUSDTMarket'
import { useOrderData } from '@/hooks/useOrderData'
import { useAccount } from 'wagmi'
import { useTranslation } from '@/hooks/useI18n'
import toast from 'react-hot-toast'

/**
 * 订单簿组件
 * 显示市场订单和用户订单，支持成交和取消操作
 * 集成新的CarbonUSDTMarket合约功能
 */
export default function OrderBook() {
  const { t } = useTranslation()
  const { address } = useAccount()
  const { marketAddress, cancelOrder, fillOrder } = useCarbonUSDTMarket()
  const { orders, loading, loadOrders, refreshOrders, totalOrders } = useOrderData(marketAddress)
  const [activeTab, setActiveTab] = useState<'market' | 'my'>('market')

  // 初始化时加载订单
  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // 监听订单簿刷新事件
  useEffect(() => {
    const handleRefresh = () => {
      refreshOrders()
    }
    
    window.addEventListener('refreshOrderBook', handleRefresh)
    return () => window.removeEventListener('refreshOrderBook', handleRefresh)
  }, [refreshOrders])

  /**
   * 处理取消订单
   * @param orderId 订单ID
   */
  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId)
      toast.success('取消订单已提交')
      // 重新加载订单
      setTimeout(refreshOrders, 2000)
    } catch (error) {
      console.error('取消订单失败:', error)
      toast.error('取消订单失败')
    }
  }

  /**
   * 处理成交订单
   * @param orderId 订单ID
   */
  const handleFillOrder = async (orderId: string) => {
    try {
      await fillOrder(orderId)
      toast.success('成交订单已提交')
      // 重新加载订单
      setTimeout(refreshOrders, 2000)
    } catch (error) {
      console.error('成交订单失败:', error)
      toast.error('成交订单失败')
    }
  }

  // 根据用户地址筛选订单
  const userAddress = address?.toLowerCase()
  const myOrders = orders.filter(order => order.user.toLowerCase() === userAddress)
  const marketOrders = orders.filter(order => order.user.toLowerCase() !== userAddress)

  // 根据当前标签选择要显示的订单
  const displayOrders = activeTab === 'my' ? myOrders : marketOrders
  
  // 分离买单和卖单，并按价格排序
  const buyOrders = displayOrders
    .filter(order => order.orderType === 'Buy')
    .sort((a, b) => Number(b.price) - Number(a.price)) // 买单按价格从高到低
  
  const sellOrders = displayOrders
    .filter(order => order.orderType === 'Sell')
    .sort((a, b) => Number(a.price) - Number(b.price)) // 卖单按价格从低到高

  return (
    <div className="bg-white/90 rounded-2xl shadow-xl border border-white/20">
      {/* 标签切换 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('market')}
          className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
            activeTab === 'market'
              ? 'bg-blue-500 text-white rounded-tl-2xl'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          📊 {t('orderBook.marketOrders')} ({marketOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
            activeTab === 'my'
              ? 'bg-green-500 text-white rounded-tr-2xl'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          👤 {t('orderBook.myOrders')} ({myOrders.length})
        </button>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {activeTab === 'market' ? `📊 ${t('orderBook.marketOrders')}` : `👤 ${t('orderBook.myOrders')}`} ({displayOrders.length}{t('orderBook.ordersCount')})
          </h2>
          <button
            onClick={refreshOrders}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? t('orderBook.refreshing') : t('orderBook.refresh')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 买单区域 */}
          <div>
            <h3 className="text-lg font-semibold text-green-600 mb-4 flex items-center gap-2">
              📈 {t('orderBook.buyOrders')} ({buyOrders.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {buyOrders.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {totalOrders === 0 ? t('orderBook.noOrdersYet') : (activeTab === 'my' ? t('orderBook.noMyBuyOrders') : t('orderBook.noMarketBuyOrders'))}
                </div>
              ) : (
                buyOrders.map((order) => (
                  <div key={order.id} className="border border-green-200 rounded-lg p-3 bg-green-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-green-700">
                          {Number(order.amount).toFixed(2)} {t('orderBook.carbonToken')} @ {Number(order.price).toFixed(2)} USDT
                        </div>
                        <div className="text-sm text-gray-600">
                          {t('orderBook.totalValue')}: {(Number(order.amount) * Number(order.price)).toFixed(2)} USDT
                        </div>
                        {/* 显示剩余数量 */}
                        {Number(order.remainingAmount) < Number(order.amount) && (
                          <div className="text-xs text-orange-600">
                            {t('orderBook.remaining')}: {Number(order.remainingAmount).toFixed(2)} {t('orderBook.carbonToken')}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">#{order.id}</div>
                        <div className="text-xs text-gray-500">{order.timestamp}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">
                        {t('orderBook.listingFee')}: {Number(order.orderFee).toFixed(2)} USDT
                      </div>
                      <div className="flex gap-2">
                        {activeTab === 'my' ? (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            {t('orderBook.cancel')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFillOrder(order.id)}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            {t('orderBook.fill')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 卖单区域 */}
          <div>
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
              📉 {t('orderBook.sellOrders')} ({sellOrders.length})
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sellOrders.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {totalOrders === 0 ? t('orderBook.noOrdersYet') : (activeTab === 'my' ? t('orderBook.noMySellOrders') : t('orderBook.noMarketSellOrders'))}
                </div>
              ) : (
                sellOrders.map((order) => (
                  <div key={order.id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-red-700">
                          {Number(order.amount).toFixed(2)} {t('orderBook.carbonToken')} @ {Number(order.price).toFixed(2)} USDT
                        </div>
                        <div className="text-sm text-gray-600">
                          {t('orderBook.totalValue')}: {(Number(order.amount) * Number(order.price)).toFixed(2)} USDT
                        </div>
                        {/* 显示剩余数量 */}
                        {Number(order.remainingAmount) < Number(order.amount) && (
                          <div className="text-xs text-orange-600">
                            {t('orderBook.remaining')}: {Number(order.remainingAmount).toFixed(2)} {t('orderBook.carbonToken')}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">#{order.id}</div>
                        <div className="text-xs text-gray-500">{order.timestamp}</div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-600">
                        {t('orderBook.listingFee')}: {Number(order.orderFee).toFixed(2)} USDT
                      </div>
                      <div className="flex gap-2">
                        {activeTab === 'my' ? (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            {t('orderBook.cancel')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFillOrder(order.id)}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            {t('orderBook.fill')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 订单说明 */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">{t('orderBook.orderExplanation')}</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>{t('orderBook.explanations.sorting')}</div>
            <div>{t('orderBook.explanations.remaining')}</div>
            <div>{t('orderBook.explanations.fees')}</div>
            <div>{t('orderBook.explanations.permissions')}</div>
          </div>
        </div>
      </div>
    </div>
  )
} 