import { useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits, Address } from 'viem'
import toast from 'react-hot-toast'
import { getCarbonUSDTMarketAddress, getCarbonTokenAddress, getUSDTAddress } from '@/contracts/addresses'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json'
import USDTABI from '@/contracts/abi/USDT.json'
import { useChainId } from 'wagmi'

// Order Type Enumeration -Consistent with the contract
export type OrderType = 'Buy' | 'Sell'
export type OrderStatus = 'Active' | 'Filled' | 'Cancelled'

// Order structure -consistent with the contract
export interface Order {
  user: Address
  orderType: OrderType
  amount: bigint
  remainingAmount: bigint // Remaining untransactions
  price: bigint
  timestamp: bigint
  status: OrderStatus
  orderFee: bigint
}

// Market Statistics -Consistent with the contract
export interface MarketStats {
  totalOrdersCreated: bigint
  totalOrdersFilled: bigint
  totalOrdersCancelled: bigint
  totalVolumeTraded: bigint
  totalFeesCollected: bigint
  totalLimitOrderFees: bigint // Total order handling fee
  totalFillOrderFees: bigint  // Total transaction fee
  nextOrderId: bigint
}

// Process rate information -consistent with the contract
export interface FeeRates {
  platformFee: bigint
  limitOrderFee: bigint
  fillOrderFee: bigint
}

// Market order estimate information
export interface MarketOrderEstimate {
  estimatedAmount: bigint
  platformFee: bigint
  totalAmount: bigint
}

// Price deviation check results
export interface PriceDeviationCheck {
  isBlocked: boolean
  deviation: bigint
  referencePrice: bigint
}

// User balance information
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
  
  // Get the contract address -use the new helper function
  const marketAddress = getCarbonUSDTMarketAddress(chainId) as Address
  const carbonTokenAddress = getCarbonTokenAddress(chainId) as Address
  const usdtTokenAddress = getUSDTAddress(chainId) as Address

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // Read the user's carbon currency balance
  const { data: carbonBalance } = useReadContract({
    address: carbonTokenAddress,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // Read user usdt balance
  const { data: usdtBalance } = useReadContract({
    address: usdtTokenAddress,
    abi: USDTABI.abi,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // Address verification function
  const isValidAddress = (address: string): boolean => {
    return !!(address && address !== '0x' && address.length === 42)
  }

  // Check if the market address is valid
  const isMarketAddressValid = marketAddress && isValidAddress(marketAddress)

  // Read Market Statistics -Use the new getDetailedMarketStats function
  const { data: marketStatsData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getDetailedMarketStats',
    query: { enabled: isMarketAddressValid }
  })

  // Reading handling rate
  const { data: feeRatesData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getFeeRates',
    query: { enabled: isMarketAddressValid }
  })

  // Read active order list
  const { data: activeOrdersData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getActiveOrders',
    query: { enabled: isMarketAddressValid }
  })

  // Read order book information
  const { data: orderBookData } = useReadContract({
    address: marketAddress,
    abi: CarbonUSDTMarketABI.abi,
    functionName: 'getOrderBook',
    query: { enabled: isMarketAddressValid }
  })

  /**
   * Create a pay order -Support automatic matching
   * @param amount Number of carbon coins to be purchased (string format)
   * @param price Bid (USDT basic unit, for example: 88 means 88 USDT)
   */
  const createBuyOrder = useCallback(async (amount: string, price: string) => {
    if (!userAddress || !amount || !price) {
      toast.error('请先连接钱包并输入有效的数量和价格')
      return
    }

    try {
      const amountWei = parseUnits(amount, 18)
      // Price transfer basic values ​​(without precision), multiply directly in the contract: amount(wei) *price(basic) = USDT(wei)
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
   * Create a sell order -supports automatic matching
   * @param amount Number of carbon coins to be sold (string format)
   * @param price Bid (USDT basic unit, for example: 88 means 88 USDT)
   */
  const createSellOrder = useCallback(async (amount: string, price: string) => {
    if (!userAddress || !amount || !price) {
      toast.error('请先连接钱包并输入有效的数量和价格')
      return
    }

    try {
      const amountWei = parseUnits(amount, 18)
      // Price transfer basic values ​​(without precision), multiply directly in the contract: amount(wei) *price(basic) = USDT(wei)
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
   * Deal orders -Manually match orders from other users
   * @param orderId Order ID to be sold
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
   * Cancel an order -Revoke your own order
   * @param orderId Order ID to cancel
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
   * Check price deviation -Verify that the price is within the allowable range
   * @param price Prices to be checked
   * @returns Price deviation check results
   */
  const checkPriceDeviation = useCallback(async (price: string): Promise<PriceDeviationCheck | null> => {
    if (!price || !isMarketAddressValid) return null

    try {
      const priceBasic = BigInt(Math.round(Number(price)))
      
      // Dynamically import wagmi's read contract function
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
   * Get order information -Get detailed information based on order ID
   * @param orderId Order ID
   * @returns Order details
   */
  const getOrder = useCallback(async (orderId: string) => {
    if (!orderId || !isMarketAddressValid) return null

    try {
      // Dynamically import wagmi's read contract function
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
   * Get the user order list -Get all order IDs of the specified user
   * @param user User address
   * @returns User Order ID Array
   */
  const getUserOrders = useCallback(async (user: Address) => {
    if (!user || !isMarketAddressValid) return []

    try {
      // Dynamically import wagmi's read contract function
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
   * Get paging order book -More efficient way to obtain order data
   * @param offset Starting location
   * @param limit Quantity Limit
   * @param orderType Order type filtering (0=buy order, 1=sell order, 2=all)
   * @returns Order list and whether there is more data
   */
  const getOrderBookPaginated = useCallback(async (offset: number, limit: number, orderType: number) => {
    if (!isMarketAddressValid) return { orderList: [], hasMore: false }

    try {
      // Dynamically import wagmi's read contract function
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

  // Listen to transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      toast.success('交易已确认！')
    }
  }, [isConfirmed])

  // Listen to transaction errors -Improve error handling
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

  // Format number of tokens
  const formatTokenAmount = (value: bigint | undefined, decimals = 18) => {
    if (!value) return '0'
    try {
      return formatUnits(value, decimals)
    } catch (error) {
      console.error('Format token amount error:', error)
      return '0'
    }
  }

  // Format user balance
  const userBalances: UserBalances = {
    carbonBalance: formatTokenAmount(carbonBalance as bigint),
    carbonBalanceRaw: carbonBalance as bigint || BigInt(0),
    usdtBalance: formatTokenAmount(usdtBalance as bigint),
    usdtBalanceRaw: usdtBalance as bigint || BigInt(0),
  }

  // Format market statistics
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

  // Format handling rate
  const feeRates: FeeRates | null = feeRatesData ? {
    platformFee: (feeRatesData as any)[0],
    limitOrderFee: (feeRatesData as any)[1],
    fillOrderFee: (feeRatesData as any)[2],
  } : null

  return {
    // state
    isConnected,
    isWritePending,
    isConfirming,
    isConfirmed,
    writeError,
    
    // Contract address
    marketAddress,
    carbonTokenAddress,
    usdtTokenAddress,
    
    // User balance
    carbonBalance: userBalances.carbonBalance,
    carbonBalanceRaw: userBalances.carbonBalanceRaw,
    usdtBalance: userBalances.usdtBalance,
    usdtBalanceRaw: userBalances.usdtBalanceRaw,
    userBalances,
    
    // Market data
    marketStats,
    feeRates,
    activeOrders: activeOrdersData as bigint[] || [],
    orderBook: orderBookData || [],
    
    // method
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