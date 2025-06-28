import React, { useState, useEffect } from 'react'
import { useCarbonUSDTMarket, Order } from '@/hooks/useCarbonUSDTMarket'
import { useAccount } from 'wagmi'
import toast from 'react-hot-toast'

interface OrderBookPanelProps {
  onFillOrder?: (orderId: string) => void
}

/**
 * 订单簿面板组件
 * 显示买卖单列表和用户订单管理
 */
export default function OrderBookPanel({ onFillOrder }: OrderBookPanelProps) {
  const { address: userAddress } = useAccount()
  const [activeTab, setActiveTab] = useState<'market' | 'user'>('market')
  const [orders, setOrders] = useState<Order[]>([])
  const [userOrders, setUserOrders] = useState<Order[]>([])

  const {
    marketStats,
    fillOrder,
    cancelOrder,
    getOrder,
    formatTokenAmount,
    isWritePending,
    isConfirming,
  } = useCarbonUSDTMarket()

  // 模拟获取订单数据 (实际项目中应该从合约事件或后端API获取)
  // 暂时注释掉，因为getOrder还没有实现
  // useEffect(() => {
  //   const fetchOrders = async () => {
  //     if (!marketStats?.nextOrderId) return

  //     const orderPromises = []
      
  //     // 获取最近的订单
  //     const startId = Math.max(0, Number(marketStats.nextOrderId) - 20)
      
  //     for (let i = startId; i < Number(marketStats.nextOrderId); i++) {
  //       orderPromises.push(getOrder(i.toString()))
  //     }

  //     try {
  //       const orderResults = await Promise.all(orderPromises)
  //       const validOrders = orderResults.filter((order): order is Order => 
  //         order !== null && order.status === 'Active'
  //       )
        
  //       setOrders(validOrders)
        
  //       // 筛选用户订单
  //       if (userAddress) {
  //         const userValidOrders = validOrders.filter(order => 
  //           order.user.toLowerCase() === userAddress.toLowerCase()
  //         )
  //         setUserOrders(userValidOrders)
  //       }
  //     } catch (error) {
  //       console.error('Failed to fetch orders:', error)
  //     }
  //   }

  //   fetchOrders()
  // }, [marketStats?.nextOrderId, getOrder, userAddress])

  const handleFillOrder = async (orderId: string) => {
    try {
      await fillOrder(orderId)
      if (onFillOrder) {
        onFillOrder(orderId)
      }
    } catch (error) {
      console.error('Failed to fill order:', error)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder(orderId)
      toast.success('订单取消成功')
    } catch (error) {
      console.error('Failed to cancel order:', error)
    }
  }

  const OrderRow = ({ order, orderId, showActions = true, isUserOrder = false }: { 
    order: Order, 
    orderId: string, 
    showActions?: boolean,
    isUserOrder?: boolean 
  }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          order.orderType === 'Buy' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {order.orderType === 'Buy' ? '买入' : '卖出'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {formatTokenAmount(order.amount)}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {formatTokenAmount(order.price)}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatTokenAmount(order.amount * order.price)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {new Date(Number(order.timestamp) * 1000).toLocaleString()}
      </td>
      {showActions && (
        <td className="px-4 py-3 text-sm">
          {isUserOrder ? (
            <button
              onClick={() => handleCancelOrder(orderId)}
              disabled={isWritePending || isConfirming}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-xs"
            >
              {isWritePending || isConfirming ? '处理中...' : '取消'}
            </button>
          ) : (
            <button
              onClick={() => handleFillOrder(orderId)}
              disabled={isWritePending || isConfirming || !userAddress}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-xs"
            >
              {isWritePending || isConfirming ? '处理中...' : '成交'}
            </button>
          )}
        </td>
      )}
    </tr>
  )

  // 分离买单和卖单
  const buyOrders = orders.filter(order => order.orderType === 'Buy').slice(0, 10)
  const sellOrders = orders.filter(order => order.orderType === 'Sell').slice(0, 10)

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
          📊 市场订单
        </button>
        <button
          onClick={() => setActiveTab('user')}
          className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
            activeTab === 'user'
              ? 'bg-green-500 text-white rounded-tr-2xl'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
        >
          👤 我的订单
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'market' && (
          <div className="space-y-6">
            {/* 买单列表 */}
            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center gap-2">
                🟢 买单列表
                <span className="text-sm text-gray-500">({buyOrders.length} 个活跃订单)</span>
              </h3>
              
              {buyOrders.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">数量</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总价值</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {buyOrders.map((order, index) => (
                        <OrderRow 
                          key={index} 
                          order={order} 
                          orderId={index.toString()}
                          isUserOrder={userAddress && order.user.toLowerCase() === userAddress.toLowerCase()}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  📭 暂无买单
                </div>
              )}
            </div>

            {/* 卖单列表 */}
            <div>
              <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
                🔴 卖单列表
                <span className="text-sm text-gray-500">({sellOrders.length} 个活跃订单)</span>
              </h3>
              
              {sellOrders.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-red-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">数量</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总价值</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sellOrders.map((order, index) => (
                        <OrderRow 
                          key={index} 
                          order={order} 
                          orderId={index.toString()}
                          isUserOrder={userAddress && order.user.toLowerCase() === userAddress.toLowerCase()}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  📭 暂无卖单
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'user' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              👤 我的订单
              <span className="text-sm text-gray-500">({userOrders.length} 个活跃订单)</span>
            </h3>
            
            {userOrders.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">数量</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">价格</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">总价值</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userOrders.map((order, index) => (
                      <OrderRow 
                        key={index} 
                        order={order} 
                        orderId={index.toString()}
                        isUserOrder={true}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <div className="text-gray-500 mb-2">暂无订单</div>
                <div className="text-sm text-gray-400">去创建您的第一个限价单吧！</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 