import { useState, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'

// Order interface definition -Matching front-end display requirements
interface Order {
  id: string
  user: string
  orderType: 'Buy' | 'Sell'
  amount: string
  remainingAmount: string // Remaining untransactions
  price: string
  timestamp: string
  status: 'Active' | 'Filled' | 'Cancelled'
  orderFee: string
}

/**
 * Order Data Management Hook
 * Responsible for obtaining and managing order data from CarbonUSDTMarket contracts
 * @param marketAddress Market contract address
 */
export const useOrderData = (marketAddress: string) => {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [totalOrders, setTotalOrders] = useState(0)

  // Get market statistics to get order quantity
  const { data: marketStats, refetch: refetchStats } = useReadContract({
    address: marketAddress as `0x${string}`,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getDetailedMarketStats',
    query: {
      enabled: !!marketAddress,
    },
  })

  /**
   * Get specific order information -use getOrder function
   * @param orderId Order ID
   * @returns Order details or null
   */
  const getOrder = useCallback(async (orderId: number) => {
    if (!marketAddress) return null
    
    try {
      // Dynamically import wagmi's read contract function
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      // Use the 'getOrder' function to get order details
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
   * Loading order data -Get active orders from contracts
   * Prioritize the use of pagination API for performance
   */
  const loadOrders = useCallback(async () => {
    if (!marketStats || !marketAddress) return
    
    setLoading(true)
    const orderList: Order[] = []
    
    try {
      // Dynamically import wagmi's read contract function
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      // Get active orders using pagination api (more efficient)
      const result = await readContract(config, {
        address: marketAddress as `0x${string}`,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getActiveOrdersPaginated',
        args: [BigInt(0), BigInt(50)], // Get the top 50 active orders
      })
      
      const orderIds = (result as any)[0] as bigint[]
      const orderInfos = (result as any)[1] as any[]
      
      console.log('分页订单数据:', {
        orderCount: orderIds.length,
        orderIds: orderIds.map(id => id.toString()),
        orderInfos
      })
      
      // Processing order data
      orderInfos.forEach((orderData, index) => {
        if (orderData && orderData.user && orderData.status === 0) { // Process only active orders
          const formattedOrder: Order = {
            id: orderIds[index].toString(), // Use the actual order id
            user: orderData.user,
            orderType: orderData.orderType === 0 ? 'Buy' : 'Sell',
            amount: formatUnits(orderData.amount, 18),
            remainingAmount: formatUnits(orderData.remainingAmount, 18),
            price: orderData.price.toString(), // Price is the basic unit, used directly
            timestamp: new Date(Number(orderData.timestamp) * 1000).toLocaleString(),
            status: 'Active',
            orderFee: formatUnits(orderData.orderFee, 18) // The order fee is in wei format and needs to be formatted
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
      
      // Rollback solution: Use traditional methods to get orders
      const nextOrderId = Number((marketStats as any)[7]) // Next order id is the 8th field
      setTotalOrders(nextOrderId)
      
      console.log('开始加载订单，总订单数:', nextOrderId)
      
      // Load only the most recent 20 orders
      const loadCount = Math.min(20, nextOrderId)
      const startId = Math.max(0, nextOrderId - loadCount)
      
      for (let i = startId; i < nextOrderId; i++) {
        try {
          console.log(`正在获取订单 ${i}...`)
          const orderData = await getOrder(i)
          console.log(`订单 ${i} 原始数据:`, orderData)
          
          if (orderData) {
            // The contract returns the structure format
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
            
            // Check whether the order is valid (user address is not 0 and the status is active)
            if (orderStruct.user && 
                orderStruct.user !== '0x0000000000000000000000000000000000000000' && 
                orderStruct.status === 0) {
              const formattedOrder: Order = {
                id: i.toString(),
                user: orderStruct.user,
                orderType: orderStruct.orderType === 0 ? 'Buy' : 'Sell',
                amount: formatUnits(orderStruct.amount, 18),
                remainingAmount: formatUnits(orderStruct.remainingAmount, 18),
                price: orderStruct.price?.toString(), // Price is the basic unit, used directly
                timestamp: new Date(Number(orderStruct.timestamp) * 1000).toLocaleString(),
                status: 'Active',
                orderFee: formatUnits(orderStruct.orderFee, 18) // The order fee is in wei format and needs to be formatted
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
   * Refresh order data -Re-get the latest order
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