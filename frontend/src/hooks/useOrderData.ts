import { useState, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'

// 订单接口定义 - 与前端显示需求匹配
interface Order {
  id: string
  user: string
  orderType: 'Buy' | 'Sell'
  amount: string
  remainingAmount: string // 剩余未成交数量
  price: string
  timestamp: string
  status: 'Active' | 'Filled' | 'Cancelled'
  orderFee: string
}

/**
 * 订单数据管理Hook
 * 负责从CarbonUSDTMarket合约获取和管理订单数据
 * @param marketAddress 市场合约地址
 */
export const useOrderData = (marketAddress: string) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [totalOrders, setTotalOrders] = useState(0)

  // 获取市场统计来获取订单数量
  const { data: marketStats, refetch: refetchStats } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getDetailedMarketStats',
    query: {
      enabled: !!marketAddress,
    },
  })

  /**
   * 获取特定订单信息 - 使用getOrder函数
   * @param orderId 订单ID
   * @returns 订单详细信息或null
   */
  const getOrder = useCallback(async (orderId: number) => {
    if (!marketAddress) return null
    
    try {
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      // 使用 'getOrder' 函数获取订单详情
      const orderData = await readContract(config, {
        address: marketAddress as `0x${string}`,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getOrder',
        args: [BigInt(orderId)],
      })
      
      return orderData
    } catch (error) {
      console.error(`获取订单 ${orderId} 失败:`, error)
      return null
    }
  }, [marketAddress])

  /**
   * 加载订单数据 - 从合约获取活跃订单
   * 优先使用分页API以提高性能
   */
  const loadOrders = useCallback(async () => {
    if (!marketStats || !marketAddress) return
    
    setLoading(true)
    const orderList: Order[] = []
    
    try {
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      // 使用分页API获取活跃订单（更高效）
      const result = await readContract(config, {
        address: marketAddress as `0x${string}`,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getActiveOrdersPaginated',
        args: [BigInt(0), BigInt(50)], // 获取前50个活跃订单
      })
      
      const orderIds = (result as any)[0] as bigint[]
      const orderInfos = (result as any)[1] as any[]
      
      console.log('分页订单数据:', {
        orderCount: orderIds.length,
        orderIds: orderIds.map(id => id.toString()),
        orderInfos
      })
      
      // 处理订单数据
      orderInfos.forEach((orderData, index) => {
        if (orderData && orderData.user && orderData.status === 0) { // 只处理活跃订单
          const formattedOrder: Order = {
            id: orderIds[index].toString(), // 使用实际订单ID
            user: orderData.user,
            orderType: orderData.orderType === 0 ? 'Buy' : 'Sell',
            amount: formatUnits(orderData.amount, 18),
            remainingAmount: formatUnits(orderData.remainingAmount, 18),
            price: orderData.price.toString(), // 价格是基础单位，直接使用
            timestamp: new Date(Number(orderData.timestamp) * 1000).toLocaleString(),
            status: 'Active',
            orderFee: formatUnits(orderData.orderFee, 18) // 挂单费是Wei格式，需要格式化
          }
          
          console.log(`订单 ${orderIds[index]} 挂单费调试:`, {
            orderId: orderIds[index].toString(),
            orderType: orderData.orderType === 0 ? 'Buy' : 'Sell',
            rawOrderFee: orderData.orderFee?.toString(),
            formattedOrderFee: formatUnits(orderData.orderFee, 18),
            amount: formatUnits(orderData.amount, 18),
            price: orderData.price.toString(),
            totalValue: (Number(formatUnits(orderData.amount, 18)) * Number(orderData.price)).toFixed(2),
            expectedFee: ((Number(formatUnits(orderData.amount, 18)) * Number(orderData.price)) * 0.005).toFixed(4)
          })
          
          orderList.push(formattedOrder)
        }
      })
      
      console.log('处理后的订单列表:', orderList)
      
    } catch (error) {
      console.error('获取分页订单失败，回退到传统方式:', error)
      
      // 回退方案：使用传统方式获取订单
      const nextOrderId = Number((marketStats as any)[7]) // nextOrderId是第8个字段
      setTotalOrders(nextOrderId)
      
      console.log('开始加载订单，总订单数:', nextOrderId)
      
      // 只加载最近的20个订单
      const loadCount = Math.min(20, nextOrderId)
      const startId = Math.max(0, nextOrderId - loadCount)
      
      for (let i = startId; i < nextOrderId; i++) {
        try {
          console.log(`正在获取订单 ${i}...`)
          const orderData = await getOrder(i)
          console.log(`订单 ${i} 原始数据:`, orderData)
          
          if (orderData) {
            // 合约返回的是结构体格式
            const orderStruct = orderData as any
            
            console.log(`订单 ${i} 结构体数据:`, {
              user: orderStruct.user,
              orderType: orderStruct.orderType,
              amount: orderStruct.amount?.toString(),
              remainingAmount: orderStruct.remainingAmount?.toString(),
              price: orderStruct.price?.toString(),
              timestamp: orderStruct.timestamp?.toString(),
              status: orderStruct.status,
              orderFee: orderStruct.orderFee?.toString()
            })
            
            // 检查订单是否有效（用户地址不为0且状态为Active）
            if (orderStruct.user && 
                orderStruct.user !== '0x0000000000000000000000000000000000000000' && 
                orderStruct.status === 0) {
              const formattedOrder: Order = {
                id: i.toString(),
                user: orderStruct.user,
                orderType: orderStruct.orderType === 0 ? 'Buy' : 'Sell',
                amount: formatUnits(orderStruct.amount, 18),
                remainingAmount: formatUnits(orderStruct.remainingAmount, 18),
                price: orderStruct.price?.toString(), // 价格是基础单位，直接使用
                timestamp: new Date(Number(orderStruct.timestamp) * 1000).toLocaleString(),
                status: 'Active',
                orderFee: formatUnits(orderStruct.orderFee, 18) // 挂单费是Wei格式，需要格式化
              }
              console.log(`添加订单 ${i} 到列表:`, formattedOrder)
              orderList.push(formattedOrder)
            } else {
              console.log(`订单 ${i} 无效或状态不是活跃:`, {
                user: orderStruct.user,
                status: orderStruct.status,
                isZeroAddress: orderStruct.user === '0x0000000000000000000000000000000000000000'
              })
            }
          } else {
            console.log(`订单 ${i} 数据为空`)
          }
        } catch (error) {
          console.error(`订单 ${i} 获取失败:`, error)
        }
      }
    }
    
    console.log('最终加载到的订单:', orderList)
    setOrders(orderList)
    setLoading(false)
  }, [marketStats, marketAddress, getOrder])

  /**
   * 刷新订单数据 - 重新获取最新订单
   */
  const refreshOrders = useCallback(() => {
    refetchStats()
    loadOrders()
  }, [refetchStats, loadOrders])

  return {
    orders,
    loading,
    loadOrders,
    refreshOrders,
    totalOrders,
  }
} 