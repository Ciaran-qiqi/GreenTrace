import { useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits, Address } from 'viem'
import toast from 'react-hot-toast'
import { getCarbonUSDTMarketAddress, getCarbonTokenAddress, getUSDTAddress } from '@/contracts/addresses'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json'
import USDTABI from '@/contracts/abi/USDT.json'
import { useChainId } from 'wagmi'

// 订单类型枚举 - 与合约保持一致
export type OrderType = 'Buy' | 'Sell'
export type OrderStatus = 'Active' | 'Filled' | 'Cancelled'

// 订单结构体 - 与合约保持一致
export interface Order {
  user: Address
  orderType: OrderType
  amount: bigint
  remainingAmount: bigint // 剩余未成交数量
  price: bigint
  timestamp: bigint
  status: OrderStatus
  orderFee: bigint
}

// 市场统计信息 - 与合约保持一致
export interface MarketStats {
  totalOrdersCreated: bigint
  totalOrdersFilled: bigint
  totalOrdersCancelled: bigint
  totalVolumeTraded: bigint
  totalFeesCollected: bigint
  totalLimitOrderFees: bigint // 总挂单手续费
  totalFillOrderFees: bigint  // 总成交手续费
  nextOrderId: bigint
}

// 手续费率信息 - 与合约保持一致
export interface FeeRates {
  platformFee: bigint
  limitOrderFee: bigint
  fillOrderFee: bigint
}

// 市价单预估信息
export interface MarketOrderEstimate {
  estimatedAmount: bigint
  platformFee: bigint
  totalAmount: bigint
}

// 价格偏离检查结果
export interface PriceDeviationCheck {
  isBlocked: boolean
  deviation: bigint
  referencePrice: bigint
}

// 用户余额信息
export interface UserBalances {
  carbonBalance: string
  carbonBalanceRaw: bigint
  usdtBalance: string
  usdtBalanceRaw: bigint
}

export const useCarbonUSDTMarket = () => {
  const { address: userAddress, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract()
  
  // 获取合约地址 - 使用新的辅助函数
  const marketAddress = getCarbonUSDTMarketAddress(chainId) as Address
  const carbonTokenAddress = getCarbonTokenAddress(chainId) as Address
  const usdtTokenAddress = getUSDTAddress(chainId) as Address

  // 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // 读取用户碳币余额
  const { data: carbonBalance } = useReadContract({
    address: carbonTokenAddress,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // 读取用户USDT余额
  const { data: usdtBalance } = useReadContract({
    address: usdtTokenAddress,
    abi: USDTABI.abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // 地址验证函数
  const isValidAddress = (address: string): boolean => {
    return !!(address && address !== '0x' && address.length === 42)
  }

  // 检查市场地址是否有效
  const isMarketAddressValid = marketAddress && isValidAddress(marketAddress)

  // 读取市场统计 - 使用新的getDetailedMarketStats函数
  const { data: marketStatsData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getDetailedMarketStats',
    query: { enabled: isMarketAddressValid }
  })

  // 读取手续费率
  const { data: feeRatesData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getFeeRates',
    query: { enabled: isMarketAddressValid }
  })

  // 读取活跃订单列表
  const { data: activeOrdersData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getActiveOrders',
    query: { enabled: isMarketAddressValid }
  })

  // 读取订单簿信息
  const { data: orderBookData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getOrderBook',
    query: { enabled: isMarketAddressValid }
  })

  /**
   * 创建买单 - 支持自动撮合
   * @param amount 要购买的碳币数量（字符串格式）
   * @param price 出价（USDT基础单位，例如：88表示88 USDT）
   */
  const createBuyOrder = useCallback(async (amount: string, price: string) => {
    if (!userAddress || !amount || !price) {
      toast.error('请先连接钱包并输入有效的数量和价格')
      return
    }

    try {
      const amountWei = parseUnits(amount, 18)
      // 价格传递基础数值（不带精度），合约中直接相乘：amount(wei) * price(basic) = USDT(wei)
      const priceBasic = BigInt(Math.round(Number(price)))
      
      console.log('创建买单参数:', {
        amount,
        price,
        amountWei: amountWei.toString(),
        priceBasic: priceBasic.toString(),
        expectedUSDTWei: (amountWei * priceBasic).toString(),
        expectedUSDT: (Number(amount) * Number(price)).toString()
      })
    
      writeContract({
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'createBuyOrder',
        args: [amountWei, priceBasic],
      })
      
      toast.success('买单已提交，等待确认...')
    } catch (error) {
      console.error('Create buy order failed:', error)
      toast.error('创建买单失败，请检查余额和授权')
    }
  }, [userAddress, marketAddress, writeContract])

  /**
   * 创建卖单 - 支持自动撮合
   * @param amount 要出售的碳币数量（字符串格式）
   * @param price 出价（USDT基础单位，例如：88表示88 USDT）
   */
  const createSellOrder = useCallback(async (amount: string, price: string) => {
    if (!userAddress || !amount || !price) {
      toast.error('请先连接钱包并输入有效的数量和价格')
      return
    }

    try {
      const amountWei = parseUnits(amount, 18)
      // 价格传递基础数值（不带精度），合约中直接相乘：amount(wei) * price(basic) = USDT(wei)
      const priceBasic = BigInt(Math.round(Number(price)))
      
      console.log('创建卖单参数:', {
        amount,
        price,
        amountWei: amountWei.toString(),
        priceBasic: priceBasic.toString(),
        expectedUSDTWei: (amountWei * priceBasic).toString(),
        expectedUSDT: (Number(amount) * Number(price)).toString()
      })
    
      writeContract({
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'createSellOrder',
        args: [amountWei, priceBasic],
      })
      
      toast.success('卖单已提交，等待确认...')
    } catch (error) {
      console.error('Create sell order failed:', error)
      toast.error('创建卖单失败，请检查余额和授权')
    }
  }, [userAddress, marketAddress, writeContract])

  /**
   * 成交订单 - 手动匹配其他用户的订单
   * @param orderId 要成交的订单ID
   */
  const fillOrder = useCallback(async (orderId: string) => {
    if (!userAddress || !orderId) {
      toast.error('请先连接钱包并选择要成交的订单')
      return
    }

    try {
      writeContract({
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'fillOrder',
        args: [BigInt(Number(orderId))],
      })
      
      toast.success('订单成交已提交，等待确认...')
    } catch (error) {
      console.error('Fill order failed:', error)
      toast.error('订单成交失败，请检查余额和授权')
    }
  }, [userAddress, marketAddress, writeContract])

  /**
   * 取消订单 - 撤销自己的挂单
   * @param orderId 要取消的订单ID
   */
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!userAddress || !orderId) {
      toast.error('请先连接钱包并选择要取消的订单')
      return
    }

    try {
      writeContract({
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'cancelOrder',
        args: [BigInt(Number(orderId))],
      })
      
      toast.success('取消订单已提交，等待确认...')
    } catch (error) {
      console.error('Cancel order failed:', error)
      toast.error('取消订单失败，请重试')
    }
  }, [userAddress, marketAddress, writeContract])

  /**
   * 检查价格偏离 - 验证价格是否在允许范围内
   * @param price 要检查的价格
   * @returns 价格偏离检查结果
   */
  const checkPriceDeviation = useCallback(async (price: string): Promise<PriceDeviationCheck | null> => {
    if (!price || !isMarketAddressValid) return null

    try {
      const priceBasic = BigInt(Math.round(Number(price)))
      
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      const result = await readContract(config, {
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'checkPriceDeviation',
        args: [priceBasic],
      })
      
      return {
        isBlocked: (result as any)[0],
        deviation: (result as any)[1],
        referencePrice: (result as any)[2],
      }
    } catch (error) {
      console.error('Price deviation check failed:', error)
      return null
    }
  }, [marketAddress, isMarketAddressValid])

  /**
   * 获取订单信息 - 根据订单ID获取详细信息
   * @param orderId 订单ID
   * @returns 订单详细信息
   */
  const getOrder = useCallback(async (orderId: string) => {
    if (!orderId || !isMarketAddressValid) return null

    try {
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      const orderData = await readContract(config, {
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getOrder',
        args: [BigInt(Number(orderId))],
      })
      
      return orderData
    } catch (error) {
      console.error(`获取订单 ${orderId} 失败:`, error)
      return null
    }
  }, [marketAddress, isMarketAddressValid])

  /**
   * 获取用户订单列表 - 获取指定用户的所有订单ID
   * @param user 用户地址
   * @returns 用户订单ID数组
   */
  const getUserOrders = useCallback(async (user: Address) => {
    if (!user || !isMarketAddressValid) return []

    try {
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      const orderIds = await readContract(config, {
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getUserOrders',
        args: [user],
      })
      
      return orderIds as bigint[]
    } catch (error) {
      console.error(`获取用户订单失败:`, error)
      return []
    }
  }, [marketAddress, isMarketAddressValid])

  /**
   * 获取分页订单簿 - 更高效的订单数据获取方式
   * @param offset 起始位置
   * @param limit 数量限制
   * @param orderType 订单类型过滤（0=买单，1=卖单，2=全部）
   * @returns 订单列表和是否还有更多数据
   */
  const getOrderBookPaginated = useCallback(async (offset: number, limit: number, orderType: number) => {
    if (!isMarketAddressValid) return { orderList: [], hasMore: false }

    try {
      // 动态导入wagmi的readContract函数
      const { readContract } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi')
      
      const result = await readContract(config, {
        address: marketAddress,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getOrderBookPaginated',
        args: [BigInt(offset), BigInt(limit), orderType],
      })
      
      return {
        orderList: (result as any)[0] as Order[],
        hasMore: (result as any)[1] as boolean,
      }
    } catch (error) {
      console.error('获取订单簿失败:', error)
      return { orderList: [], hasMore: false }
    }
  }, [marketAddress, isMarketAddressValid])

  // 监听交易确认
  useEffect(() => {
    if (isConfirmed) {
      toast.success('交易已确认！')
    }
  }, [isConfirmed])

  // 监听交易错误 - 改进错误处理
  useEffect(() => {
    if (writeError) {
      console.error('Transaction error details:', writeError)
      
      let errorMessage = '交易失败'
      
      if (writeError.message.includes('User rejected')) {
        errorMessage = '用户取消了交易'
      } else if (writeError.message.includes('insufficient funds')) {
        errorMessage = 'Gas费用不足，请检查ETH余额'
      } else if (writeError.message.includes('replacement underpriced')) {
        errorMessage = '交易费用过低，请提高Gas费用后重试'
      } else if (writeError.message.includes('execution reverted')) {
        errorMessage = '交易执行失败，请检查余额和授权'
      } else {
        errorMessage = `交易失败: ${writeError.message}`
      }
      
      toast.error(errorMessage, { duration: 5000 })
    }
  }, [writeError])

  // 格式化代币数量
  const formatTokenAmount = (value: bigint | undefined, decimals = 18) => {
    if (!value) return '0'
    try {
      return formatUnits(value, decimals)
    } catch (error) {
      console.error('Format token amount error:', error)
      return '0'
    }
  }

  // 格式化用户余额
  const userBalances: UserBalances = {
    carbonBalance: formatTokenAmount(carbonBalance as bigint),
    carbonBalanceRaw: carbonBalance as bigint || BigInt(0),
    usdtBalance: formatTokenAmount(usdtBalance as bigint),
    usdtBalanceRaw: usdtBalance as bigint || BigInt(0),
  }

  // 格式化市场统计
  const marketStats: MarketStats | null = marketStatsData ? {
    totalOrdersCreated: (marketStatsData as any)[0],
    totalOrdersFilled: (marketStatsData as any)[1],
    totalOrdersCancelled: (marketStatsData as any)[2],
    totalVolumeTraded: (marketStatsData as any)[3],
    totalFeesCollected: (marketStatsData as any)[4],
    totalLimitOrderFees: (marketStatsData as any)[5],
    totalFillOrderFees: (marketStatsData as any)[6],
    nextOrderId: (marketStatsData as any)[7],
  } : null

  // 格式化手续费率
  const feeRates: FeeRates | null = feeRatesData ? {
    platformFee: (feeRatesData as any)[0],
    limitOrderFee: (feeRatesData as any)[1],
    fillOrderFee: (feeRatesData as any)[2],
  } : null

  return {
    // 状态
    isConnected,
    isWritePending,
    isConfirming,
    isConfirmed,
    writeError,
    
    // 合约地址
    marketAddress,
    carbonTokenAddress,
    usdtTokenAddress,
    
    // 用户余额
    carbonBalance: userBalances.carbonBalance,
    carbonBalanceRaw: userBalances.carbonBalanceRaw,
    usdtBalance: userBalances.usdtBalance,
    usdtBalanceRaw: userBalances.usdtBalanceRaw,
    userBalances,
    
    // 市场数据
    marketStats,
    feeRates,
    activeOrders: activeOrdersData as bigint[] || [],
    orderBook: orderBookData || [],
    
    // 方法
    createBuyOrder,
    createSellOrder,
    fillOrder,
    cancelOrder,
    checkPriceDeviation,
    getOrder,
    getUserOrders,
    getOrderBookPaginated,
    formatTokenAmount,
  }
} 