import React, { useState, useEffect, useCallback } from 'react'
import { useCarbonUSDTMarket } from '@/hooks/useCarbonUSDTMarket'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTranslation } from '@/hooks/useI18n'
import { ConfigError } from '@/components/ErrorBoundary'
import OrderBook from '@/components/OrderBook'
import { formatTokenAmount } from '@/utils/formatUtils'
import toast from 'react-hot-toast'
import { readContract } from '@wagmi/core'
import { config } from '@/lib/wagmi'
import { formatUnits } from 'viem'
import { useWatchContractEvent } from 'wagmi'
import GreenTalesLiquidityPoolABI from '@/contracts/abi/GreenTalesLiquidityPool.json'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'

/**
 * Carbon currency market master component
 * Support market order and limit order trading
 * Integrate new CarbonUSDTMarket contract functionality
 */
export default function CarbonMarket() {
  const { t, language } = useTranslation()
  const [activeTab, setActiveTab] = useState<'market' | 'limit'>('market')
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  
  // Market price single input -double input box

  const [marketCarbonAmount, setMarketCarbonAmount] = useState('')
  const [marketUsdtAmount, setMarketUsdtAmount] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  
  // Processing fee estimation status

  const [swapEstimate, setSwapEstimate] = useState<{
    amountOut: string
    fee: string
    priceImpact: string
  } | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  
  // Limit order input

  const [limitAmount, setLimitAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  
  // Authorization status

  const [isApprovingCarbon, setIsApprovingCarbon] = useState(false)
  const [isApprovingUsdt, setIsApprovingUsdt] = useState(false)

  // Transaction successful pop-up status

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    type: 'buy' | 'sell';
    orderType: 'market' | 'limit';
    amount: string;
    price: string;
  } | null>(null);

  // Chart data status type definition

  type PriceHistoryItem = {
    timestamp: number
    price: number
    volume: number
  }

  // K-line data type definition -suitable for professional trading charts

  type CandlestickData = {
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
  
  type OrderItem = {
    price: number
    amount: number
    total: number
  }
  
  type OrderBookData = {
    buyOrders: OrderItem[]
    sellOrders: OrderItem[]
    averageBuyPrice: number
    averageSellPrice: number
    priceSpread: number
  }

  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([])
  const [candlestickData, setCandlestickData] = useState<CandlestickData[]>([]) // K-line data

  const [orderBookData, setOrderBookData] = useState<OrderBookData>({
    buyOrders: [],
    sellOrders: [],
    averageBuyPrice: 0,
    averageSellPrice: 0,
    priceSpread: 0
  })

  // Data source type switching status

  const [useRealData, setUseRealData] = useState(true) // false=simulated data, true=real data -default display of real data

  const [useRealOrderBook, setUseRealOrderBook] = useState(true) // false=Simulated order book, true=Real order book -default display of real order


  // Get hooks

  const {
    isConnected,
    carbonBalance,
    usdtBalance,
    carbonBalanceRaw,
    usdtBalanceRaw,
    userBalances,
    marketStats,
    feeRates,
    isWritePending,
    isConfirmed,
        createBuyOrder,
    createSellOrder,
    marketAddress,
    carbonTokenAddress,
    usdtTokenAddress,
  } = useCarbonUSDTMarket()

  // Get liquidity pool related state and functions

  const {
    isLoading: isLiquidityPoolPending,
    isConnected: isLiquidityPoolConnected,
    swapCarbonToUsdt,
    swapUsdtToCarbon,
    liquidityPoolAddress,
    poolData, // Get pool data, including current price

    getSwapEstimate, // Obtain a handling fee estimate


  } = useGreenTalesLiquidityPool()

  // Added status to store contract data and historical prices

  const [contractPoolStats, setContractPoolStats] = useState<any>(null)
  const [realOrderBookData, setRealOrderBookData] = useState<OrderBookData>({
    buyOrders: [],
    sellOrders: [],
    averageBuyPrice: 0,
    averageSellPrice: 0,
    priceSpread: 0
  }) // Real order book data



  // Loading real price history from local storage

  const loadRealPriceHistory = useCallback(() => {
    try {
      const PRICE_CACHE_KEY = 'amm_price_history_real_data'
      const stored = localStorage.getItem(PRICE_CACHE_KEY)
      if (stored) {
        const parsedData = JSON.parse(stored)
        // Only the last 24 hours of data are retained

        const now = Date.now()
        const oneDayAgo = now - (24 * 60 * 60 * 1000)
        const validData = parsedData.filter((item: PriceHistoryItem) => item.timestamp > oneDayAgo)
        console.log('📊 从本地存储加载真实价格历史:', validData.length, '小时')
        return validData
      }
    } catch (error) {
      console.error('❌ 加载真实价格历史失败:', error)
    }
    return []
  }, [])

  // Save real price data to local storage (recorded by hour)

  const saveRealPriceData = useCallback((price: number, volume: number = 0) => {
    const PRICE_CACHE_KEY = 'amm_price_history_real_data'
    const now = Date.now()
    // Calculate the start timestamp of the current hour (everything time)

    const currentHour = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000)
    
    const newPricePoint: PriceHistoryItem = {
      timestamp: currentHour, // Use the full time as the time stamp

      price: Number(price.toFixed(2)),
      volume: Number(volume.toFixed(0))
    }

    try {
      // Get existing data from local storage

      const stored = localStorage.getItem(PRICE_CACHE_KEY)
      let existingData: PriceHistoryItem[] = []
      
      if (stored) {
        existingData = JSON.parse(stored)
      }
      
      // Find out if there are data points in the current hour

      const existingIndex = existingData.findIndex(item => item.timestamp === currentHour)
      
      let updated: PriceHistoryItem[]
      if (existingIndex >= 0) {
        // If there is data in the current hour, update the data point

        updated = [...existingData]
        updated[existingIndex] = newPricePoint
        console.log('🔄 更新当前小时价格数据:', price, 'USDT，时间:', new Date(currentHour).toLocaleString())
      } else {
        // If there is no data in the current hour, add a new data point

        updated = [...existingData, newPricePoint]
        console.log('➕ 添加新小时价格数据:', price, 'USDT，时间:', new Date(currentHour).toLocaleString())
      }
      
      // Only the last 24 hours of data are retained

      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      const validData = updated.filter(item => item.timestamp > oneDayAgo)
      
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(validData))
      console.log('💾 真实价格已保存到本地存储，数据点:', validData.length, '小时')
    } catch (error) {
      console.error('❌ 保存真实价格数据失败:', error)
    }
  }, [])

  // Listen to TokensSwapped Events -Record prices immediately when there is a transaction

  useWatchContractEvent({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    eventName: 'TokensSwapped',
    onLogs(logs) {
      console.log('🔥 检测到新的交易事件，立即记录当前价格:', logs.length, '笔交易')
      
      // When there is a new transaction, record the current price to cache immediately

      if (useRealData) {
        const currentMarketPrice = Number(poolData?.currentPrice) || 88
        const volume = logs.reduce((total, log: any) => {
          const amountIn = log.args?.amountIn ? Number(formatUnits(log.args.amountIn as bigint, 18)) : 0
          const amountOut = log.args?.amountOut ? Number(formatUnits(log.args.amountOut as bigint, 18)) : 0
          return total + Math.max(amountIn, amountOut)
        }, 0)
        
        console.log('📊 交易触发价格更新:', currentMarketPrice, 'USDT，交易量:', volume.toFixed(2))
        saveRealPriceData(currentMarketPrice, volume)
        
        // Trigger price history update

        setTimeout(() => {
          generateRealPriceHistory()
        }, 500)
      }
    },
    enabled: !!liquidityPoolAddress && useRealData,
  })

  // Listen to limit order events -Update the order book when orders are created, sold, or canceled

  useWatchContractEvent({
    address: marketAddress as `0x${string}`,
    abi: CarbonUSDTMarketABI.abi,
    eventName: 'OrderCreated',
    onLogs(logs) {
      console.log('🔥 检测到新的限价单创建事件:', logs.length, '个订单')
      if (useRealOrderBook) {
        setTimeout(() => {
          fetchRealOrderBookData()
        }, 1000)
      }
    },
    enabled: !!marketAddress && useRealOrderBook,
  })

  useWatchContractEvent({
    address: marketAddress as `0x${string}`,
    abi: CarbonUSDTMarketABI.abi,
    eventName: 'OrderFilled',
    onLogs(logs) {
      console.log('🔥 检测到限价单成交事件:', logs.length, '个订单')
      if (useRealOrderBook) {
        setTimeout(() => {
          fetchRealOrderBookData()
        }, 1000)
      }
    },
    enabled: !!marketAddress && useRealOrderBook,
  })

  useWatchContractEvent({
    address: marketAddress as `0x${string}`,
    abi: CarbonUSDTMarketABI.abi,
    eventName: 'OrderCancelled',
    onLogs(logs) {
      console.log('🔥 检测到限价单取消事件:', logs.length, '个订单')
      if (useRealOrderBook) {
        setTimeout(() => {
          fetchRealOrderBookData()
        }, 1000)
      }
    },
    enabled: !!marketAddress && useRealOrderBook,
  })

  // Functions to get real-time data from contracts

  const fetchContractData = useCallback(async () => {
    if (!liquidityPoolAddress) return

    try {
      // Use read contract to get contract data

      const poolStatsResult = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getPoolStats',
      })

      console.log('🔄 合约数据更新:', {
        poolStats: poolStatsResult
      })

      // Convert big int to available data

      if (poolStatsResult) {
        const [totalCarbon, totalUsdt, totalLP, currentPrice, swapCount, totalVolume, totalFees, totalProviders] = poolStatsResult as any[]
        setContractPoolStats({
          totalCarbon: formatUnits(totalCarbon, 18),
          totalUsdt: formatUnits(totalUsdt, 18),
          totalLP: formatUnits(totalLP, 18),
          currentPrice: formatUnits(currentPrice, 18),
          swapCount: Number(swapCount),
          totalVolume: formatUnits(totalVolume, 18),
          totalFees: formatUnits(totalFees, 18),
          totalProviders: Number(totalProviders)
        })
      }

    } catch (error) {
      console.error('获取合约数据失败:', error)
    }
  }, [liquidityPoolAddress])

  // Regularly record the market price of amm (by hour)

  useEffect(() => {
    if (!useRealData) return

    // Record the current price immediately

    const currentMarketPrice = Number(poolData?.currentPrice) || 88
    if (currentMarketPrice > 0) {
      saveRealPriceData(currentMarketPrice, Number(contractPoolStats?.totalVolume) || 0)
    }

    // Calculate the time from the next hour

    const now = Date.now()
    const nextHour = Math.ceil(now / (60 * 60 * 1000)) * (60 * 60 * 1000)
    const timeToNextHour = nextHour - now

    // Start timing recording at the next hour

    const initialTimeout = setTimeout(() => {
      // Record the price

      const marketPrice = Number(poolData?.currentPrice) || 88
      const volume = Number(contractPoolStats?.totalVolume) || 0
      console.log('⏰ 整点记录AMM市场价格:', marketPrice, 'USDT')
      saveRealPriceData(marketPrice, volume)

      // Then record it once an hour

      const priceRecordInterval = setInterval(() => {
        const marketPrice = Number(poolData?.currentPrice) || 88
        const volume = Number(contractPoolStats?.totalVolume) || 0
        
        console.log('⏰ 每小时记录AMM市场价格:', marketPrice, 'USDT')
        saveRealPriceData(marketPrice, volume)
      }, 60 * 60 * 1000) // 1 hour = 60 *60 *1000 milliseconds


      return () => {
        clearInterval(priceRecordInterval)
      }
    }, timeToNextHour)

    return () => {
      clearTimeout(initialTimeout)
    }
  }, [useRealData, poolData?.currentPrice, contractPoolStats?.totalVolume, saveRealPriceData])

  // Get real order book data from carbon usdt market contract

  const fetchRealOrderBookData = useCallback(async () => {
    if (!marketAddress || !useRealOrderBook) return

    try {
      // Use read contract to get order book data

      const orderBookResult = await readContract(config, {
        address: marketAddress as `0x${string}`,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getOrderBook',
        args: [],
      })

      console.log('🔄 获取真实订单簿数据:', orderBookResult)

      if (orderBookResult) {
        const [buyOrdersRaw, sellOrdersRaw] = orderBookResult as any[]
        
        // Convert paying data

        const buyOrders: OrderItem[] = buyOrdersRaw.map((order: any) => ({
          price: Number(formatUnits(order.price, 0)), // Price is already the basic unit

          amount: Number(formatUnits(order.remainingAmount, 18)), // The quantity is 18 bit accuracy

          total: Number(formatUnits(order.remainingAmount, 18)) * Number(formatUnits(order.price, 0))
        })).sort((a: OrderItem, b: OrderItem) => b.price - a.price) // Pay orders sorted from high to low by price

        
        // Convert sell order data

        const sellOrders: OrderItem[] = sellOrdersRaw.map((order: any) => ({
          price: Number(formatUnits(order.price, 0)), // Price is already the basic unit

          amount: Number(formatUnits(order.remainingAmount, 18)), // The quantity is 18 bit accuracy

          total: Number(formatUnits(order.remainingAmount, 18)) * Number(formatUnits(order.price, 0))
        })).sort((a: OrderItem, b: OrderItem) => a.price - b.price) // Sell ​​orders are sorted from low to high by price


        // Calculate the average price and price difference

        const totalBuyValue = buyOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
        const totalBuyAmount = buyOrders.reduce((sum, order) => sum + order.amount, 0)
        const totalSellValue = sellOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
        const totalSellAmount = sellOrders.reduce((sum, order) => sum + order.amount, 0)
        
        const averageBuyPrice = totalBuyAmount > 0 ? totalBuyValue / totalBuyAmount : 0
        const averageSellPrice = totalSellAmount > 0 ? totalSellValue / totalSellAmount : 0
        const priceSpread = averageSellPrice - averageBuyPrice

        const realOrderBook: OrderBookData = {
          buyOrders,
          sellOrders,
          averageBuyPrice: Number(averageBuyPrice.toFixed(2)),
          averageSellPrice: Number(averageSellPrice.toFixed(2)),
          priceSpread: Number(priceSpread.toFixed(2))
        }

        setRealOrderBookData(realOrderBook)
        console.log('✅ 真实订单簿数据更新完成:', {
          buyOrders: buyOrders.length,
          sellOrders: sellOrders.length,
          averageBuyPrice,
          averageSellPrice,
          priceSpread
        })
      }

    } catch (error) {
      console.error('❌ 获取真实订单簿数据失败:', error)
    }
  }, [marketAddress, useRealOrderBook])

  // Generate price history based on real data

  const generateRealPriceHistory = useCallback(() => {
    if (!useRealData) return

    console.log('🔍 基于真实数据生成价格历史...')
    
    // Loading real price history

    const realData = loadRealPriceHistory()
    
    if (realData.length >= 5) {
      // If there is enough real data, use it directly

      console.log('📈 使用真实价格历史，小时数:', realData.length)
      setPriceHistory(realData)
    } else {
      // If the real data is insufficient, generate initial data and start collecting

      console.log('📈 真实数据不足，生成初始估算数据并开始收集真实数据')
      
      const now = Date.now()
      const history: PriceHistoryItem[] = []
      const basePrice = Number(poolData?.currentPrice) || 88
      const minPrice = 45 // Historical lowest price

      
      // Generate estimates for the past 24 hours (one point per hour)

      for (let i = 23; i >= 0; i--) { // One point per hour, from 23 hours ago to current

        const hourTimestamp = Math.floor((now - (i * 60 * 60 * 1000)) / (60 * 60 * 1000)) * (60 * 60 * 1000)
        const timeProgress = i / 24
        
        // Price recovery trend

        const recoveryFactor = Math.pow(1 - timeProgress, 1.8) * 0.48
        const marketNoise = (Math.random() - 0.5) * 0.03
        
        let price = minPrice + (basePrice - minPrice) * (1 - recoveryFactor)
        price *= (1 + marketNoise)
        
        const finalPrice = Math.max(minPrice * 0.98, Math.min(basePrice * 1.05, price))
        
        history.push({
          timestamp: hourTimestamp,
          price: Number(finalPrice.toFixed(2)),
          volume: Math.random() * 1000 + 500
        })
      }
      
      // Add real data

      if (realData.length > 0) {
        history.push(...realData)
      }
      
              // Sort by time and deduplicate (deduplicate by hour)

        const uniqueHistory = history
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter((item, index, arr) => 
            index === 0 || Math.abs(item.timestamp - arr[index - 1].timestamp) > 3600000 // At least 1 hour interval

          )
      
      setPriceHistory(uniqueHistory)
              console.log('✅ 混合价格历史生成完成，小时数:', uniqueHistory.length, '（真实:', realData.length, '小时，估算:', history.length - realData.length, '小时）')
    }
  }, [useRealData, poolData?.currentPrice, loadRealPriceHistory])

  // Load real data during initialization

  useEffect(() => {
    if (useRealData) {
      loadRealPriceHistory()
    }
  }, [useRealData, loadRealPriceHistory])

  // Obtain the token authorization status

  const carbonApproval = useTokenApproval(carbonTokenAddress, marketAddress)
  const usdtApproval = useTokenApproval(usdtTokenAddress, marketAddress)
  const carbonApprovalLiquidity = useTokenApproval(carbonTokenAddress, liquidityPoolAddress)
  const usdtApprovalLiquidity = useTokenApproval(usdtTokenAddress, liquidityPoolAddress)

  // Address Verification

  const isValidAddress = (address: string) => {
    return address && address !== '0x' && address.length === 42
  }

  const isMarketReady = isValidAddress(marketAddress) && isValidAddress(carbonTokenAddress) && isValidAddress(usdtTokenAddress)

  // Get the current market price -Priority to liquidity pool prices, alternatively use the default price

  const currentPrice = poolData?.currentPrice || '88.00'
  
  // Get oracle reference price -for price deviation check

  const referencePrice = poolData?.referencePrice || '88.00'

  // Temporary use of fixed prices for testing

  const testPrice = '88.00' // Fixed test price


  // Debugging information

  console.log('价格调试信息:', {
    poolData,
    currentPrice,
    referencePrice,
    testPrice,
    poolDataCurrentPrice: poolData?.currentPrice,
    poolDataReferencePrice: poolData?.referencePrice,
    fallbackPrice: '88.00',
    poolDataKeys: poolData ? Object.keys(poolData) : 'poolData is null',
    poolDataValues: poolData ? Object.values(poolData) : 'poolData is null'
  })

  // Check the liquidity pool connection status

  console.log('流动性池状态:', {
    isLiquidityPoolConnected,
    isLiquidityPoolPending,
    liquidityPoolAddress
  })

  // Simulated price historical data generation function

  const generatePriceHistory = useCallback((): PriceHistoryItem[] => {
    const now = Date.now()
    const history: PriceHistoryItem[] = []
    const basePrice = Number(currentPrice) || 88
    
    // Generate price data for the past 24 hours, one data point every 15 minutes

    for (let i = 96; i >= 0; i--) {
      const timestamp = now - (i * 15 * 60 * 1000) // 15 minutes interval

      const randomVariation = (Math.random() - 0.5) * 4 // Random fluctuations of ±2

      const trendVariation = Math.sin(i / 10) * 2 // Add trend fluctuations

      const price = Math.max(0.1, basePrice + randomVariation + trendVariation)
      const volume = Math.random() * 10000 + 1000 // Random trading volume

      
      history.push({
        timestamp,
        price: Number(price.toFixed(2)),
        volume: Number(volume.toFixed(0))
      })
    }
    
    return history
  }, [currentPrice])

  // Generate K-line data -Convert price history to professional K-line format

  const generateCandlestickData = useCallback((priceData: PriceHistoryItem[]): CandlestickData[] => {
    if (priceData.length === 0) return []
    
    const candlesticks: CandlestickData[] = []
    const basePrice = Number(currentPrice) || 88
    
    // Generate k-line data by grouping by hours

    const hourlyGroups = new Map<number, PriceHistoryItem[]>()
    
    priceData.forEach(item => {
      const hourKey = Math.floor(item.timestamp / (60 * 60 * 1000)) // Grouped by hour

      if (!hourlyGroups.has(hourKey)) {
        hourlyGroups.set(hourKey, [])
      }
      hourlyGroups.get(hourKey)!.push(item)
    })
    
    // Generate k-line data for each hour

    Array.from(hourlyGroups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([hourKey, hourData]) => {
        if (hourData.length === 0) return
        
        // Calculate the opening, closing, highest and lowest prices of the hour

        const sortedByTime = hourData.sort((a, b) => a.timestamp - b.timestamp)
        const open = sortedByTime[0].price
        const close = sortedByTime[sortedByTime.length - 1].price
        const high = Math.max(...hourData.map(d => d.price))
        const low = Math.min(...hourData.map(d => d.price))
        const volume = hourData.reduce((sum, d) => sum + d.volume, 0)
        
        candlesticks.push({
          timestamp: hourKey * 60 * 60 * 1000, // Turn back to timestamp

          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Number(volume.toFixed(0))
        })
      })
    
    // If the data is insufficient, generate simulated k-line data

    if (candlesticks.length < 24) {
      const now = Date.now()
      for (let i = 23; i >= 0; i--) {
        const timestamp = now - (i * 60 * 60 * 1000) // per hour

        const existingCandle = candlesticks.find(c => 
          Math.abs(c.timestamp - timestamp) < 30 * 60 * 1000 // 30 minutes tolerance

        )
        
        if (!existingCandle) {
          // Generate simulated k-line data

          const baseVariation = (Math.random() - 0.5) * 6 // ±3 basic fluctuations

          const trendFactor = Math.sin(i / 8) * 2 // Trend changes

          
          const open = Math.max(1, basePrice + baseVariation + trendFactor)
          const volatility = Math.random() * 2 + 0.5 // 0.5 2.5 volatility

          const high = open + Math.random() * volatility
          const low = open - Math.random() * volatility
          const closeVariation = (Math.random() - 0.5) * volatility
          const close = Math.max(low, Math.min(high, open + closeVariation))
          
          candlesticks.push({
            timestamp,
            open: Number(open.toFixed(2)),
            high: Number(high.toFixed(2)),
            low: Number(Math.max(0.1, low).toFixed(2)),
            close: Number(close.toFixed(2)),
            volume: Math.floor(Math.random() * 50000 + 10000)
          })
        }
      }
    }
    
    return candlesticks.sort((a, b) => a.timestamp - b.timestamp)
  }, [currentPrice])

  // When the price history is updated, the corresponding k-line data is generated

  useEffect(() => {
    if (priceHistory.length > 0) {
      setCandlestickData(generateCandlestickData(priceHistory))
    }
  }, [priceHistory, generateCandlestickData])

  // Simulate order book data generation function

  const generateOrderBookData = useCallback((): OrderBookData => {
    const basePrice = Number(currentPrice) || 88
    
    // Generate a pay order (decreasing price)

    const buyOrders: OrderItem[] = []
    let totalBuyAmount = 0
    for (let i = 0; i < 10; i++) {
      const price = Number((basePrice - (i + 1) * 0.5).toFixed(2))
      const amount = Number((Math.random() * 1000 + 100).toFixed(2))
      totalBuyAmount += amount
      buyOrders.push({
        price,
        amount,
        total: totalBuyAmount
      })
    }
    
    // Generate a sell order (increasing price)

    const sellOrders: OrderItem[] = []
    let totalSellAmount = 0
    for (let i = 0; i < 10; i++) {
      const price = Number((basePrice + (i + 1) * 0.5).toFixed(2))
      const amount = Number((Math.random() * 1000 + 100).toFixed(2))
      totalSellAmount += amount
      sellOrders.push({
        price,
        amount,
        total: totalSellAmount
      })
    }
    
    // Calculate the average price

    const totalBuyValue = buyOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
    const totalSellValue = sellOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
    const averageBuyPrice = totalBuyValue / totalBuyAmount
    const averageSellPrice = totalSellValue / totalSellAmount
    const priceSpread = averageSellPrice - averageBuyPrice
    
    return {
      buyOrders,
      sellOrders,
      averageBuyPrice: Number(averageBuyPrice.toFixed(2)),
      averageSellPrice: Number(averageSellPrice.toFixed(2)),
      priceSpread: Number(priceSpread.toFixed(2))
    }
  }, [currentPrice])

  // Initialize chart data

  useEffect(() => {
    const initializeData = async () => {
      // Obtain the real contract data

      await fetchContractData()
      
      if (useRealData) {
        // Use real data to call special functions

        generateRealPriceHistory()
      } else {
        // Using simulation data

        setPriceHistory(generatePriceHistory())
      }
      
      // Initialize order book data

      if (useRealOrderBook) {
        // Get real order book data

        await fetchRealOrderBookData()
      } else {
        // Use mock order book data

        setOrderBookData(generateOrderBookData())
      }
    }
    
    initializeData()
  }, [useRealData, useRealOrderBook, generateRealPriceHistory, currentPrice, poolData?.referencePrice, fetchContractData, generatePriceHistory, generateOrderBookData, fetchRealOrderBookData, generateCandlestickData]) // Includes all dependencies


  // Event-based data updates -Timers are no longer used, keeping order book timed updates

  useEffect(() => {
    // Order book data is updated regularly (independent of price history)

    const orderInterval = setInterval(() => {
      if (useRealOrderBook) {
        // Using real order book data

        fetchRealOrderBookData()
      } else {
        // Use mock order book data

        setOrderBookData(generateOrderBookData())
      }
    }, 10000) // Update order data every 10 seconds

    
    return () => {
      clearInterval(orderInterval)
    }
  }, [generateOrderBookData, useRealOrderBook, fetchRealOrderBookData])

  // Real-time conversion function

  const calculateConversion = useCallback(async (inputType: 'carbon' | 'usdt', value: string) => {
    if (!value || isNaN(Number(value)) || Number(value) <= 0) {
      if (inputType === 'carbon') {
        setMarketCarbonAmount('')
        setMarketUsdtAmount('')
      } else {
        setMarketCarbonAmount('')
        setMarketUsdtAmount('')
      }
      setSwapEstimate(null)
      return
    }

    // Check if the price is valid, if it is invalid, use the test price

    let price = Number(currentPrice)
    if (isNaN(price) || price <= 0) {
      console.warn('使用测试价格:', testPrice)
      price = Number(testPrice)
    }

    setIsCalculating(true)
    setIsEstimating(true)
    
    try {
      if (inputType === 'carbon') {
        // The user enters the number of carbon coins and calculates the corresponding usdt number

        const carbonAmount = Number(value)
        const usdtAmount = carbonAmount * price
        setMarketCarbonAmount(value)
        setMarketUsdtAmount(usdtAmount.toFixed(6))
        
        // Calculate the handling fee (sell carbon coins) -The user enters the number of carbon coins to be sold

        if (getSwapEstimate) {
          const estimate = await getSwapEstimate(value, true) // true = carbonToUsdt

          console.log('卖出碳币手续费估算:', {
            inputCarbon: value,
            estimate,
            amountOut: estimate?.amountOut,
            fee: estimate?.fee,
            priceImpact: estimate?.priceImpact
          })
          setSwapEstimate(estimate)
        }
      } else {
        // The user enters the usdt quantity to calculate the corresponding carbon coins

        const usdtAmount = Number(value)
        const carbonAmount = usdtAmount / price
        setMarketUsdtAmount(value)
        setMarketCarbonAmount(carbonAmount.toFixed(6))
        
        // Calculate the handling fee (buy carbon coins) -The user enters the amount of USDT to be paid

        if (getSwapEstimate) {
          const estimate = await getSwapEstimate(value, false) // false = usdtToCarbon

          console.log('买入碳币手续费估算:', {
            inputUsdt: value,
            estimate,
            amountOut: estimate?.amountOut,
            fee: estimate?.fee,
            priceImpact: estimate?.priceImpact
          })
          setSwapEstimate(estimate)
        }
      }
    } catch (error) {
      console.error('换算错误:', error)
      toast.error('换算失败，请重试')
    } finally {
      setIsCalculating(false)
      setIsEstimating(false)
    }
  }, [currentPrice, testPrice, getSwapEstimate])

  // Calculate the new price and deviation after redemption (based on the amm formula)

  const calculatePriceImpact = (amountIn: string, isCarbonToUsdt: boolean) => {
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return null
    
    try {
      const amountInNum = parseFloat(amountIn)
      const currentCarbonBalance = parseFloat(poolData.carbonBalance || '1000000') // Default 1 million

      const currentUsdtBalance = parseFloat(poolData.usdtBalance || '88000000') // Default 88 million

      const currentPrice = parseFloat(poolData.currentPrice || '88.00')
      const referencePrice = parseFloat(poolData.referencePrice || '88.00')
      
      if (isNaN(currentCarbonBalance) || isNaN(currentUsdtBalance) || isNaN(currentPrice) || isNaN(referencePrice)) return null
      
      let newPrice: number
      
      if (isCarbonToUsdt) {
        // Carbon coins for USDT: Users enter carbon coins, the pool carbon coins increase, USDT decreases, and the price falls
        // Use exact AMM formula: k = x *y

        
        // Calculate the actual number of usdts redeemed (consider the handling fee)

        const amountOutBeforeFee = (amountInNum * currentUsdtBalance) / currentCarbonBalance
        const feeRate = 0.003 // 0.3% handling fee

        const fee = amountOutBeforeFee * feeRate
        const amountOutAfterFee = amountOutBeforeFee - fee
        
        // Calculate the new pool state

        const newCarbonBalance = currentCarbonBalance + amountInNum // Pool carbon coins increase

        const newUsdtBalance = currentUsdtBalance - amountOutAfterFee // Pool usdt reduction (deducted actually to the user)

        
        // Calculate the new price

        newPrice = newUsdtBalance / newCarbonBalance
      } else {
        // Usdt exchange carbon coins: User input usdt, pool usdt increases, carbon coins decreases, price increases

        
        // Calculate the actual amount of carbon coins redeemed (consider the handling fee)

        const amountOutBeforeFee = (amountInNum * currentCarbonBalance) / currentUsdtBalance
        const feeRate = 0.003 // 0.3% handling fee

        const fee = amountOutBeforeFee * feeRate
        const amountOutAfterFee = amountOutBeforeFee - fee
        
        // Calculate the new pool state

        const newUsdtBalance = currentUsdtBalance + amountInNum // Pool usdt increases

        const newCarbonBalance = currentCarbonBalance - amountOutAfterFee // Pool carbon coins are reduced (deducted to users)

        
        // Calculate the new price

        newPrice = newUsdtBalance / newCarbonBalance
      }
      
      // Deviation between calculation and reference price

      const deviation = ((newPrice - referencePrice) / referencePrice) * 100
      
      return {
        newPrice: newPrice.toFixed(2),
        deviation: deviation.toFixed(2),
        isDeviated: Math.abs(deviation) > (poolData.priceDeviationThreshold || 10) // Deviation after exceeding the threshold

      }
    } catch (error) {
      console.error('计算价格影响失败:', error)
      return null
    }
  }

  // Calculate the price impact of carbon coins for usdt (sell carbon coins)

  const carbonToUsdtPriceImpact = calculatePriceImpact(marketCarbonAmount, true)

  // Calculate the price impact of usdt exchange carbon coins (buy carbon coins)

  const usdtToCarbonPriceImpact = calculatePriceImpact(marketUsdtAmount, false)

  // Process the input changes of carbon coins

  const handleCarbonAmountChange = (value: string) => {
    calculateConversion('carbon', value)
  }

  // Process the usdt quantity input change

  const handleUsdtAmountChange = (value: string) => {
    calculateConversion('usdt', value)
  }

  // Listen to transaction status changes

  useEffect(() => {
    if (isConfirmed || isLiquidityPoolConnected) {
      toast.dismiss() // Clear loading prompt

      
      // Show different success tips according to transaction type

      if (isLiquidityPoolConnected) {
        // Market order successful (liquidity pool trading)

        if (activeTab === 'market') {
          toast.success(`🎉 ${t('carbon.success.marketOrderSuccess')}！${orderType === 'buy' ? t('carbon.buyCarbon') : t('carbon.sellCarbon')}`, { 
            duration: 5000,
            icon: '✅'
          })
        } else {
          // Automatically execute limit orders

          toast.success('🤖 智能限价单执行成功！', { 
            duration: 5000,
            icon: '🚀'
          })
        }
      } else if (isConfirmed) {
        // Limited price contract transaction successfully

        if (activeTab === 'limit') {
          toast.success(`🔗 限价${orderType === 'buy' ? t('carbon.buyOrder') : t('carbon.sellOrder')}创建成功！`, { 
            duration: 5000,
            icon: '✅'
          })
        } else {
          // Other contract transactions were successful

          toast.success('🎉 交易已确认成功！', { duration: 4000 })
        }
      }
      
      // Clear the form

      if (activeTab === 'market') {
        setMarketCarbonAmount('')
        setMarketUsdtAmount('')
        setSwapEstimate(null)
      } else {
        setLimitAmount('')
        setLimitPrice('')
      }
      
      // Refresh the order book (if the limit order is successful)

      if (activeTab === 'limit') {
        // Delay refresh, let the transaction be completed first

        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshOrderBook'))
        }, 3000)
      }
    }
  }, [isConfirmed, isLiquidityPoolConnected, activeTab, orderType, t])

  // Process market order transactions

  const handleMarketOrder = async () => {
    if (orderType === 'buy') {
      // Verify usdt quantity when buying

      if (!marketUsdtAmount || isNaN(Number(marketUsdtAmount)) || Number(marketUsdtAmount) <= 0) {
        toast.error(t('carbon.errors.invalidAmount'))
        return
      }
      
      // Check price deviation -If the price deviation exceeds the threshold after redemption, block transactions

      if (usdtToCarbonPriceImpact?.isDeviated === true) {
        const threshold = poolData.priceDeviationThreshold || 10
        toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${usdtToCarbonPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
        return
      }
    } else {
      // Verify the quantity of carbon coins when selling

      if (!marketCarbonAmount || isNaN(Number(marketCarbonAmount)) || Number(marketCarbonAmount) <= 0) {
        toast.error(t('carbon.errors.invalidAmount'))
        return
      }
      
      // Check price deviation -If the price deviation exceeds the threshold after redemption, block transactions

      if (carbonToUsdtPriceImpact?.isDeviated === true) {
        const threshold = poolData.priceDeviationThreshold || 10
        toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${carbonToUsdtPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
        return
      }
    }

    try {
      if (orderType === 'buy') {
        // Buy carbon coins for market price -Use USDT quantity (USDT for carbon coins)

        if (Number(marketUsdtAmount) > Number(usdtBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }

        // Check usdt authorization (for liquidity pools)

        const needsApproval = usdtApprovalLiquidity.checkApprovalNeeded(marketUsdtAmount, 18)
        if (needsApproval) {
          setIsApprovingUsdt(true)
          await usdtApprovalLiquidity.approveMax()
          setIsApprovingUsdt(false)
          toast.success(t('carbon.approval.approvalSuccess'))
          return
        }

        toast.loading('正在执行市价买入...', { id: 'market-buy' })
        await swapUsdtToCarbon(marketUsdtAmount)
        toast.success('📈 市价买入已提交！等待确认...', { id: 'market-buy', duration: 3000 })
        
        // Show successful pop-up window

        const currentPrice = Number(poolData?.currentPrice) || 88;
        setSuccessData({
          type: 'buy',
          orderType: 'market',
          amount: marketUsdtAmount,
          price: currentPrice.toFixed(2)
        });
        setShowSuccessModal(true);
      } else {
        // Sell ​​carbon coins at market price -Use carbon coins in quantity (carbon coins for USDT)

        if (Number(marketCarbonAmount) > Number(carbonBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }

        // Check the Carbon Coin Authorization (to liquidity pool)

        const needsApproval = carbonApprovalLiquidity.checkApprovalNeeded(marketCarbonAmount, 18)
        if (needsApproval) {
          setIsApprovingCarbon(true)
          await carbonApprovalLiquidity.approveMax()
          setIsApprovingCarbon(false)
          toast.success(t('carbon.approval.approvalSuccess'))
          return
        }

        toast.loading('正在执行市价卖出...', { id: 'market-sell' })
        await swapCarbonToUsdt(marketCarbonAmount)
        toast.success('📉 市价卖出已提交！等待确认...', { id: 'market-sell', duration: 3000 })
        
        // Show successful pop-up window

        const currentPrice = Number(poolData?.currentPrice) || 88;
        setSuccessData({
          type: 'sell',
          orderType: 'market',
          amount: marketCarbonAmount,
          price: currentPrice.toFixed(2)
        });
        setShowSuccessModal(true);
      }
      
      setMarketCarbonAmount('')
      setMarketUsdtAmount('')
      setSwapEstimate(null)
      
    } catch (error) {
      console.error('Market order error:', error)
      toast.error('市价单执行失败，请重试')
    }
  }

  /**
   * Process limit order transactions -Use the new CarbonUSDTMarket contract
   * @description Supports automatic matching function, automatically matches existing orders when creating orders
   */
  const handleLimitOrder = async () => {
    if (!limitAmount || !limitPrice || isNaN(Number(limitAmount)) || isNaN(Number(limitPrice))) {
      toast.error(t('carbon.errors.invalidAmount'))
      return
    }

    if (Number(limitAmount) <= 0 || Number(limitPrice) <= 0) {
      toast.error(t('carbon.errors.invalidPrice'))
      return
    }

    try {
      if (orderType === 'buy') {
        // Pay limit -USDT + pending fee required
        // Note: To be consistent with the contract calculation, totalUSDT = amount(wei) *price(basic precision wei) in the contract
        // So we calculate: amount *price (all regular values)

        const totalUsdt = Number(limitAmount) * Number(limitPrice)
        const feeRate = feeRates ? Number(feeRates.limitOrderFee.toString()) : 50 // Default 0.5%

        const orderFee = (totalUsdt * feeRate) / 10000
        const totalRequired = totalUsdt + orderFee
        
        // Check the total balance (including order fee)

        console.log('买单余额检查:', {
          limitAmount,
          limitPrice,
          totalUsdt,
          orderFee,
          totalRequired,
          userBalance: userBalances.usdtBalance,
          userBalanceNumber: Number(userBalances.usdtBalance),
          feeRate,
          feeRateFromContract: feeRates?.limitOrderFee.toString()
        })
        
        if (totalRequired > Number(userBalances.usdtBalance)) {
          toast.error(`USDT余额不足！需要${totalRequired.toFixed(6)} USDT（含挂单费），当前余额：${userBalances.usdtBalance} USDT`)
          return
        }
        
        // Check USDT Authorization -Use a slightly larger value to make sure that authorization is sufficient

        const approvalAmount = (totalRequired * 1.01).toString() // Increase 1% buffering

        const approvalDetails = usdtApproval.getApprovalDetails(approvalAmount, 18)
        console.log('USDT授权检查:', approvalDetails)
        
        const needsApproval = usdtApproval.checkApprovalNeeded(approvalAmount, 18)
        if (needsApproval) {
          setIsApprovingUsdt(true)
          await usdtApproval.approveMax()
          setIsApprovingUsdt(false)
          toast.success(t('carbon.approval.approvalSuccess'))
          return
        }
        
        toast.loading('正在创建限价买单...', { id: 'create-buy-order' })
        await createBuyOrder(limitAmount, limitPrice)
        toast.success('📝 限价买单已提交！等待区块链确认...', { id: 'create-buy-order', duration: 3000 })
        
        // Show successful pop-up window

        setSuccessData({
          type: 'buy',
          orderType: 'limit',
          amount: limitAmount,
          price: limitPrice
        });
        setShowSuccessModal(true);
        
      } else {
        // Limited price sell order -Requires carbon coins + USDT (pending order fee)

        if (Number(limitAmount) > Number(carbonBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }
        
        // Calculate order fee

        const totalUsdt = Number(limitAmount) * Number(limitPrice)
        const feeRate = feeRates ? Number(feeRates.limitOrderFee.toString()) : 50 // Default 0.5%

        const orderFee = (totalUsdt * feeRate) / 10000
        
        // Check if the usdt balance is sufficient to pay the pending order fee

        console.log('卖单余额检查:', {
          limitAmount,
          limitPrice,
          carbonBalance,
          carbonBalanceNumber: Number(carbonBalance),
          totalUsdt,
          orderFee,
          userUsdtBalance: userBalances.usdtBalance,
          userUsdtBalanceNumber: Number(userBalances.usdtBalance),
          feeRate,
          feeRateFromContract: feeRates?.limitOrderFee.toString()
        })
        
        if (orderFee > Number(userBalances.usdtBalance)) {
          toast.error(`USDT余额不足支付挂单费！需要${orderFee.toFixed(6)} USDT，当前余额：${userBalances.usdtBalance} USDT`)
          return
        }
        
        // Check the carbon currency authorization

        const needsCarbonApproval = carbonApproval.checkApprovalNeeded(limitAmount, 18)
        if (needsCarbonApproval) {
          setIsApprovingCarbon(true)
          await carbonApproval.approveMax()
          setIsApprovingCarbon(false)
          toast.success(t('carbon.approval.approvalSuccess'))
          return
        }
        
        // Check usdt authorization (used to pay pending order fees)

        if (orderFee > 0) {
          const needsUsdtApproval = usdtApproval.checkApprovalNeeded(orderFee.toString(), 18)
          if (needsUsdtApproval) {
            setIsApprovingUsdt(true)
            await usdtApproval.approveMax()
            setIsApprovingUsdt(false)
            toast.success(t('carbon.approval.approvalSuccess'))
            return
          }
        }
        
        toast.loading('正在创建限价卖单...', { id: 'create-sell-order' })
        await createSellOrder(limitAmount, limitPrice)
        toast.success('📝 限价卖单已提交！等待区块链确认...', { id: 'create-sell-order', duration: 3000 })
        
        // Show successful pop-up window

        setSuccessData({
          type: 'sell',
          orderType: 'limit',
          amount: limitAmount,
          price: limitPrice
        });
        setShowSuccessModal(true);
      }
      
      setLimitAmount('')
      setLimitPrice('')
      
    } catch (error) {
      console.error('Limit order error:', error)
      toast.error('创建限价单失败，请重试')
    }
  }

  // If the contract address is invalid, the error message will be displayed

  if (!isMarketReady) {
    return (
      <ConfigError 
        message={t('carbon.errors.invalidAmount')}
        details={[
          `Market Address: ${marketAddress}`,
          `Carbon Token Address: ${carbonTokenAddress}`,
          `USDT Token Address: ${usdtTokenAddress}`,
          `Market Valid: ${isValidAddress(marketAddress)}`,
          `Carbon Valid: ${isValidAddress(carbonTokenAddress)}`,
          `USDT Valid: ${isValidAddress(usdtTokenAddress)}`
        ]}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* User balance information */}
        {isConnected && (
          <div className="bg-white/90 rounded-2xl shadow-xl p-6 mb-6 border border-white/20 relative">
            {/* Price Deviation Status Indicator -Top Right */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${
                Math.abs(Number(currentPrice) - Number(referencePrice)) / Number(referencePrice) * 100 > (poolData.priceDeviationThreshold || 10)
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-green-500'
              }`}></div>
              <span className="text-xs font-medium text-gray-700">{t('carbon.deviation', '偏离度')}</span>
              <span className={`text-xs font-bold ${
                Math.abs(Number(currentPrice) - Number(referencePrice)) / Number(referencePrice) * 100 > (poolData.priceDeviationThreshold || 10)
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}>
                {Math.abs(Number(currentPrice) - Number(referencePrice)) / Number(referencePrice) * 100 > 0.01 
                  ? `${(Math.abs(Number(currentPrice) - Number(referencePrice)) / Number(referencePrice) * 100).toFixed(2)}%`
                  : '0.00%'
                }
              </span>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">💰</span>
              {t('carbon.tradingInfo', '交易信息')}
            </h2>
            {/* Balance and price information are displayed in one line -five grids */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-green-600 text-xs font-medium mb-2">{t('carbon.carbonBalance', '碳币余额')}</div>
                  <div className="text-green-800 font-bold text-lg mb-1">
                    {formatTokenAmount(carbonBalanceRaw)}
                  </div>
                  <div className="text-green-500 text-xs">CARB</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-blue-600 text-xs font-medium mb-2">{t('carbon.usdtBalance', 'USDT余额')}</div>
                  <div className="text-blue-800 font-bold text-lg mb-1">
                    {formatTokenAmount(usdtBalanceRaw)}
                  </div>
                  <div className="text-blue-500 text-xs">USDT</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                                <div className="text-purple-600 text-xs font-medium mb-2 flex items-center justify-center gap-1">
                <span>🔮</span>
                {t('carbon.threshold', '阈值')}
              </div>
              <div className="text-purple-800 font-bold text-lg mb-1">
                {poolData.priceDeviationThreshold || 10}%
              </div>
              <div className="text-purple-500 text-xs">{t('carbon.deviationLimit', '偏离限制')}</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-orange-600 text-xs font-medium mb-2">{t('carbon.currentPrice', '当前市价')}</div>
                  <div className="text-orange-800 font-bold text-lg mb-1">
                    {Number(currentPrice) > 0 ? currentPrice : testPrice}
                  </div>
                  <div className="text-orange-500 text-xs">USDT</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-indigo-600 text-xs font-medium mb-2">{t('carbon.referencePrice', '参考价')}</div>
                  <div className="text-indigo-800 font-bold text-lg mb-1">
                    {Number(referencePrice) > 0 ? referencePrice : testPrice}
                  </div>
                  <div className="text-indigo-500 text-xs">USDT</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Left: Trading Form */}
          <div className="xl:col-span-1 space-y-6">
            {/* Transaction type switching */}
            <div className="bg-white/90 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('market')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                    activeTab === 'market'
                      ? 'bg-blue-500 text-white rounded-tl-2xl'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  ⚡ {t('carbon.marketOrder')}
                </button>
                <button
                  onClick={() => setActiveTab('limit')}
                  className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                    activeTab === 'limit'
                      ? 'bg-green-500 text-white rounded-tr-2xl'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  📊 {t('carbon.limitOrder')}
                </button>
              </div>

              {/* Switching of buying and selling types */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setOrderType('buy')}
                  className={`flex-1 py-3 px-6 text-center font-medium transition-colors ${
                    orderType === 'buy'
                      ? 'bg-green-100 text-green-800'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  📈 {t('carbon.buyCarbon')}
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className={`flex-1 py-3 px-6 text-center font-medium transition-colors ${
                    orderType === 'sell'
                      ? 'bg-red-100 text-red-800'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  📉 {t('carbon.sellCarbon')}
                </button>
              </div>

              {/* Transaction form */}
              <div className="p-6">
                {activeTab === 'market' ? (
                  // Market price single form -double input box

                  <div className="space-y-6">
                    {/* Trading Direction Indicator */}
                    <div className="flex items-center justify-center space-x-4">
                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                        orderType === 'buy' 
                          ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}>
                        <span className="text-lg">📈</span>
                        <span className="font-medium">{t('carbon.directionBuying', '买入碳币')}</span>
                      </div>
                      <div className="text-gray-400 text-xl">⇄</div>
                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                        orderType === 'sell' 
                          ? 'bg-red-100 text-red-800 border-2 border-red-300' 
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}>
                        <span className="text-lg">📉</span>
                        <span className="font-medium">{t('carbon.directionSelling', '卖出碳币')}</span>
                      </div>
                    </div>

                    {/* Carbon Coin Quantity Input Box */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                      <label className="block text-sm font-semibold text-green-800 mb-3">
                        {t('carbon.carbonAmount', '💚 碳币数量')}
                      </label>
                      <input
                        type="number"
                        value={marketCarbonAmount}
                        onChange={(e) => handleCarbonAmountChange(e.target.value)}
                        placeholder={t('carbon.enterCarbonAmount', '输入碳币数量')}
                        className="w-full px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                        step="0.000001"
                        min="0"
                        disabled={isCalculating}
                      />
                      <div className="text-sm text-green-600 mt-2 flex justify-between">
                        <span>{t('carbon.available', '可用')}: {formatTokenAmount(carbonBalanceRaw)}</span>
                        <span className="font-medium">CARB</span>
                      </div>
                    </div>

                    {/* Convert arrows */}
                    <div className="flex justify-center">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                    </div>

                    {/* Usdt quantity input box */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                      <label className="block text-sm font-semibold text-blue-800 mb-3">
                        {t('carbon.usdtAmount', '💙 USDT数量')}
                      </label>
                      <input
                        type="number"
                        value={marketUsdtAmount}
                        onChange={(e) => handleUsdtAmountChange(e.target.value)}
                        placeholder={t('carbon.enterUsdtAmount', '输入USDT数量')}
                        className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                        step="0.000001"
                        min="0"
                        disabled={isCalculating}
                      />
                      <div className="text-sm text-blue-600 mt-2 flex justify-between">
                        <span>{t('carbon.available', '可用')}: {formatTokenAmount(usdtBalanceRaw)}</span>
                        <span className="font-medium">USDT</span>
                      </div>
                    </div>

                    {/* Price and handling fee information card */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        {t('carbon.tradingDetails', '交易详情')}
                      </h4>
                      
                      {/* Current Price */}
                      <div className="flex justify-between items-center mb-3 p-2 bg-white/60 rounded-lg">
                        <span className="text-sm text-purple-700">{t('carbon.currentPrice', '当前市价')}</span>
                        <span className="font-bold text-purple-900">
                          {Number(currentPrice) > 0 ? currentPrice : testPrice} USDT
                        </span>
                      </div>

                      {/* Reference price */}
                      <div className="flex justify-between items-center mb-3 p-2 bg-white/60 rounded-lg">
                        <span className="text-sm text-purple-700">🔮 {t('carbon.referencePrice', '参考价格')}</span>
                        <span className="font-bold text-purple-900">
                          {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                        </span>
                      </div>

                      {/* Processing fee information */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">{t('carbon.tradingFee', '手续费')}</span>
                          <span className="font-medium text-purple-900">
                            {swapEstimate ? parseFloat(swapEstimate.fee).toFixed(6) : '0.000000'} {orderType === 'buy' ? 'CARB' : 'USDT'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">{t('carbon.priceImpact', '价格影响')}</span>
                          <span className="font-medium text-purple-900">
                            {swapEstimate ? parseFloat(swapEstimate.priceImpact).toFixed(4) : '0.0000'}%
                          </span>
                        </div>
                        
                        {/* New: Price and deviation display after redemption */}
                        {orderType === 'buy' && usdtToCarbonPriceImpact && (
                          <>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">{t('carbon.priceAfterSwap', '💹 兑换后价格')}</span>
                              <span className="font-semibold text-purple-900">
                                {usdtToCarbonPriceImpact.newPrice} USDT
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">{t('carbon.deviationFromRef', '🔮 与参考价偏差')}</span>
                              <span className={`font-semibold ${usdtToCarbonPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                                {usdtToCarbonPriceImpact.deviation}%
                              </span>
                            </div>
                          </>
                        )}
                        
                        {orderType === 'sell' && carbonToUsdtPriceImpact && (
                          <>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">{t('carbon.priceAfterSwap', '💹 兑换后价格')}</span>
                              <span className="font-semibold text-purple-900">
                                {carbonToUsdtPriceImpact.newPrice} USDT
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">{t('carbon.deviationFromRef', '🔮 与参考价偏差')}</span>
                              <span className={`font-semibold ${carbonToUsdtPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                                {carbonToUsdtPriceImpact.deviation}%
                              </span>
                            </div>
                          </>
                        )}
                        
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">
                            {orderType === 'buy' ? t('carbon.payUsdt', '付出USDT') : t('carbon.payCarbon', '付出碳币')}
                          </span>
                          <span className="font-medium text-purple-900">
                            {orderType === 'buy' 
                              ? `${marketUsdtAmount || '0.000000'} USDT`
                              : `${marketCarbonAmount || '0.000000'} CARB`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">
                            {orderType === 'buy' ? t('carbon.receiveCarbon', '获得碳币') : t('carbon.receiveUsdt', '获得USDT')}
                          </span>
                          <span className="font-medium text-purple-900">
                            {orderType === 'buy' 
                              ? `${marketCarbonAmount || '0.000000'} CARB`
                              : `${marketUsdtAmount || '0.000000'} USDT`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Calculate the status */}
                      {(isCalculating || isEstimating) && (
                        <div className="flex items-center justify-center mt-3 p-2 bg-blue-100 rounded-lg">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm text-blue-700">
                            {isCalculating ? t('carbon.calculating', '正在换算...') : t('carbon.calculatingFees', '正在计算手续费...')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Trading Button */}
                    <button
                      onClick={handleMarketOrder}
                      disabled={
                        !isConnected || 
                        isWritePending || 
                        isLiquidityPoolPending || 
                        isApprovingCarbon || 
                        isApprovingUsdt || 
                        isCalculating || 
                        isEstimating ||
                        (orderType === 'buy' && usdtToCarbonPriceImpact?.isDeviated === true) ||
                        (orderType === 'sell' && carbonToUsdtPriceImpact?.isDeviated === true)
                      }
                      className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg ${
                        orderType === 'buy'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500'
                          : 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500'
                      }`}
                    >
                      {isWritePending || isLiquidityPoolPending ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t('carbon.trading', '交易中...')}
                        </div>
                      ) : isApprovingCarbon ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t('carbon.approvingCarbon', '授权碳币中...')}
                        </div>
                      ) : isApprovingUsdt ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t('carbon.approvingUsdt', '授权USDT中...')}
                        </div>
                      ) : isCalculating || isEstimating ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          {t('carbon.calculating', '计算中...')}
                        </div>
                      ) : (orderType === 'buy' && usdtToCarbonPriceImpact?.isDeviated === true) ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">⚠️</span>
                          {t('carbon.priceDeviationTooHigh', '价格偏离过大')} ({usdtToCarbonPriceImpact.deviation}%)
                        </div>
                      ) : (orderType === 'sell' && carbonToUsdtPriceImpact?.isDeviated === true) ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">⚠️</span>
                          {t('carbon.priceDeviationTooHigh', '价格偏离过大')} ({carbonToUsdtPriceImpact.deviation}%)
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">{orderType === 'buy' ? '📈' : '📉'}</span>
                          {orderType === 'buy' ? t('carbon.marketBuy', '市价买入') : t('carbon.marketSell', '市价卖出')}
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  // Price limit form

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('carbon.orderAmount')}
                      </label>
                      <input
                        type="number"
                        value={limitAmount}
                        onChange={(e) => setLimitAmount(e.target.value)}
                        placeholder={t('carbon.orderAmount')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step="0.000001"
                        min="0"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {t('carbon.available', '可用')} CARB: {formatTokenAmount(carbonBalanceRaw)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('carbon.orderPrice')} (USDT) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => {
                          // Automatically remove decimal parts and only integers are retained

                          const value = e.target.value;
                          if (value.includes('.')) {
                            const integerValue = value.split('.')[0];
                            setLimitPrice(integerValue);
                            // Show reminder

                            toast.success(`价格已自动调整为整数: ${integerValue} USDT`, { duration: 2000 });
                          } else {
                            setLimitPrice(value);
                          }
                        }}
                        onBlur={(e) => {
                          // Be sure to be an integer when out of focus

                          const value = e.target.value;
                          if (value.includes('.')) {
                            const integerValue = value.split('.')[0];
                            setLimitPrice(integerValue);
                          }
                        }}
                        placeholder={t('carbon.orderPrice')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        step="1"
                        min="1"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {t('carbon.referencePrice', '参考价格')}: {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                      </div>
                      
                    </div>

                    {/* Order Details Card -Modify the display conditions so that it is always displayed */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                          <span className="mr-2">📊</span>
                          {t('carbon.orderDetails', '订单详情')}
                        </h4>
                        {/* Order details */}
                        <div className="space-y-2">
                          {/* Order Type */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.orderType', '订单类型')}</span>
                            <span className="font-medium text-blue-900">
                              {orderType === 'buy' ? t('carbon.limitBuyOrder', '📈 限价买单') : t('carbon.limitSellOrder', '📉 限价卖单')}
                            </span>
                          </div>
                          {/* Token number */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.tokenAmount', '代币数量')}</span>
                            <span className="font-medium text-blue-900">
                              {limitAmount || '0.000000'} CARB
                            </span>
                          </div>
                          {/* Price limit */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.limitPrice', '限价')}</span>
                            <span className="font-medium text-blue-900">
                              {limitPrice || '0.00'} USDT
                            </span>
                          </div>
                          {/* Price adjustment reminder */}
                          {limitPrice && limitPrice.includes('.') && (
                            <div className="flex justify-between items-center p-2 bg-orange-100 rounded-lg border border-orange-300">
                              <span className="text-sm text-orange-700">{t('carbon.priceAdjustmentReminder', '⚠️ 价格调整提醒')}</span>
                              <span className="text-xs text-orange-600 font-medium">
                                {t('carbon.decimalWillBeRemoved', '小数部分将被自动去除')}
                              </span>
                            </div>
                          )}
                          {/* Current market price */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.currentPrice', '当前市价')}</span>
                            <span className="font-medium text-blue-900">
                              {Number(currentPrice) > 0 ? currentPrice : testPrice} USDT
                            </span>
                          </div>
                          {/* Oracle reference price */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">🔮 {t('carbon.referencePrice', '参考价格')}</span>
                            <span className="font-medium text-blue-900">
                              {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                            </span>
                          </div>
                          {/* Price difference (relative to reference price) */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.priceDifference', '价格差异')}</span>
                            <span className={`font-medium ${
                              limitPrice && limitAmount
                                ? (Number(limitPrice) > Number(referencePrice) ? 'text-red-600' : 'text-green-600')
                                : 'text-gray-500'
                            }`}>
                              {limitPrice && limitAmount
                                ? `${((Number(limitPrice) - Number(referencePrice)) / Number(referencePrice) * 100).toFixed(2)}%`
                                : '0.00%'}
                            </span>
                          </div>
                          {/* Transaction amount */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">{t('carbon.tradeAmount', '交易金额')}</span>
                            <span className="font-medium text-blue-900">
                              {(Number(limitAmount || 0) * Number(limitPrice || 0)).toFixed(2)} USDT
                            </span>
                          </div>
                          {/* Pending order fee */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">
                              {t('carbon.listingFee', '挂单费')} ({feeRates ? Number(feeRates.limitOrderFee) / 100 : 0.5}%)
                            </span>
                            <span className="font-medium text-blue-900">
                              {((Number(limitAmount || 0) * Number(limitPrice || 0) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toFixed(4)} USDT
                            </span>
                          </div>
                          {/* total */}
                          <div className="flex justify-between items-center p-2 bg-blue-100 rounded-lg border border-blue-300">
                            <span className="text-sm font-semibold text-blue-800">{t('carbon.total', '总计')}</span>
                            <span className="font-bold text-blue-900">
                              {(Number(limitAmount || 0) * Number(limitPrice || 0) * (1 + (feeRates ? Number(feeRates.limitOrderFee) : 50) / 10000)).toFixed(4)} USDT
                            </span>
                          </div>
                          {/* Order Status */}
                          <div className="flex justify-between items-center p-2 bg-blue-100 rounded-lg border border-blue-300">
                            <span className="text-sm font-semibold text-blue-800">{t('carbon.orderStatus', '订单状态')}</span>
                            <span className="font-bold text-blue-900">
                              {limitAmount && limitPrice ? t('carbon.orderStatusPending', '🟡 待创建') : t('carbon.orderStatusUnfilled', '⚪ 未填写')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Authorization status card */}
                      {!!limitAmount && !!limitPrice && (
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                          <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
                            <span className="mr-2">🔐</span>
                            {t('carbon.authorizationStatus', '授权状态')}
                          </h4>
                          <div className="space-y-3">
                            {/* Payment Authorization Status */}
                            {orderType === 'buy' && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.usdtAuthStatus', 'USDT授权状态')}</span>
                                  <span className={`font-medium ${
                                    usdtApproval.checkApprovalNeeded(
                                      (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                                      18
                                    ) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {usdtApproval.checkApprovalNeeded(
                                      (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                                      18
                                    ) ? t('carbon.needAuth', '❌ 需要授权') : t('carbon.authorized', '✅ 已授权')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.usdtBalance', 'USDT余额')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {userBalances.usdtBalance} USDT
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.needUsdt', '需要USDT')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {(Number(limitAmount) * Number(limitPrice) * (1 + (feeRates ? Number(feeRates.limitOrderFee) : 50) / 10000)).toFixed(4)} USDT
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Sell ​​order authorization status */}
                            {orderType === 'sell' && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.carbonAuthStatus', '碳币授权状态')}</span>
                                  <span className={`font-medium ${
                                    carbonApproval.checkApprovalNeeded(limitAmount, 18) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {carbonApproval.checkApprovalNeeded(limitAmount, 18) ? t('carbon.needAuth', '❌ 需要授权') : t('carbon.authorized', '✅ 已授权')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.carbonBalance', '碳币余额')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {carbonBalance} CARB
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.needCarbon', '需要碳币')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {limitAmount} CARB
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.usdtAuthForFee', 'USDT授权状态（挂单费）')}</span>
                                  <span className={`font-medium ${
                                    usdtApproval.checkApprovalNeeded(
                                      ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                      18
                                    ) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {usdtApproval.checkApprovalNeeded(
                                      ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                      18
                                    ) ? t('carbon.needAuth', '❌ 需要授权') : t('carbon.authorized', '✅ 已授权')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.usdtBalance', 'USDT余额')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {userBalances.usdtBalance} USDT
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">{t('carbon.needUsdtForFee', '需要USDT（挂单费）')}</span>
                                  <span className="font-medium text-yellow-900">
                                    {((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toFixed(4)} USDT
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Authorization button */}
                      {!!limitAmount && !!limitPrice && (
                        <div className="space-y-2">
                          {/* Pay order authorization button */}
                          {orderType === 'buy' && usdtApproval.checkApprovalNeeded(
                            (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                            18
                          ) && (
                            <button
                              onClick={async () => {
                                try {
                                  setIsApprovingUsdt(true)
                                  await usdtApproval.approveMax()
                                  toast.success('USDT授权成功！')
                                } catch (error) {
                                  console.error('USDT授权失败:', error)
                                  toast.error('USDT授权失败，请重试')
                                } finally {
                                  setIsApprovingUsdt(false)
                                }
                              }}
                              disabled={isApprovingUsdt}
                              className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 transition-colors"
                            >
                              {isApprovingUsdt ? (
                                <div className="flex items-center justify-center">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                  {t('carbon.approvingUsdt', '授权USDT中...')}
                                </div>
                              ) : (
                                t('carbon.approveUsdt', '🔐 授权USDT')
                              )}
                            </button>
                          )}
                          
                          {/* Sell ​​order authorization button */}
                          {orderType === 'sell' && (
                            <>
                              {carbonApproval.checkApprovalNeeded(limitAmount, 18) && (
                                <button
                                  onClick={async () => {
                                    try {
                                      setIsApprovingCarbon(true)
                                      await carbonApproval.approveMax()
                                      toast.success('碳币授权成功！')
                                    } catch (error) {
                                      console.error('碳币授权失败:', error)
                                      toast.error('碳币授权失败，请重试')
                                    } finally {
                                      setIsApprovingCarbon(false)
                                    }
                                  }}
                                  disabled={isApprovingCarbon}
                                  className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 transition-colors"
                                >
                                  {isApprovingCarbon ? (
                                    <div className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                      {t('carbon.approvingCarbon', '授权碳币中...')}
                                    </div>
                                  ) : (
                                    t('carbon.approveCarbon', '🔐 授权碳币')
                                  )}
                                </button>
                              )}
                              
                              {usdtApproval.checkApprovalNeeded(
                                ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                18
                              ) && (
                                <button
                                  onClick={async () => {
                                    try {
                                      setIsApprovingUsdt(true)
                                      await usdtApproval.approveMax()
                                      toast.success('USDT授权成功！')
                                    } catch (error) {
                                      console.error('USDT授权失败:', error)
                                      toast.error('USDT授权失败，请重试')
                                    } finally {
                                      setIsApprovingUsdt(false)
                                    }
                                  }}
                                  disabled={isApprovingUsdt}
                                  className="w-full py-3 px-6 rounded-lg font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 transition-colors"
                                >
                                  {isApprovingUsdt ? (
                                    <div className="flex items-center justify-center">
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                      {t('carbon.approvingUsdt', '授权USDT中...')}
                                    </div>
                                  ) : (
                                    t('carbon.approveUsdtForFee', '🔐 授权USDT（挂单费）')
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}

                    <button
                      onClick={handleLimitOrder}
                      disabled={!isConnected || isWritePending || isApprovingCarbon || isApprovingUsdt || 
                               (!!limitAmount && !!limitPrice && (
                                 (orderType === 'buy' && usdtApproval.checkApprovalNeeded(
                                   (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                                   18
                                 )) ||
                                 (orderType === 'sell' && (
                                   carbonApproval.checkApprovalNeeded(limitAmount, 18) ||
                                   usdtApproval.checkApprovalNeeded(
                                     ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                     18
                                   )
                                 ))
                               ))}
                      className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                        orderType === 'buy'
                          ? 'bg-green-500 hover:bg-green-600 disabled:bg-gray-400'
                          : 'bg-red-500 hover:bg-red-600 disabled:bg-gray-400'
                      }`}
                    >
                                             {isWritePending ? t('carbon.creating', '创建中...') : 
                         isApprovingCarbon ? t('carbon.approvingCarbon', '授权碳币中...') :
                         isApprovingUsdt ? t('carbon.approvingUsdt', '授权USDT中...') :
                       (!!limitAmount && !!limitPrice && (
                         (orderType === 'buy' && usdtApproval.checkApprovalNeeded(
                           (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                           18
                         )) ||
                         (orderType === 'sell' && (
                           carbonApproval.checkApprovalNeeded(limitAmount, 18) ||
                           usdtApproval.checkApprovalNeeded(
                             ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                             18
                           )
                         ))
                       )) ? t('carbon.pleaseApproveFirst', '请先授权') :
                       orderType === 'buy' ? t('carbon.createBuyOrder', '创建买单') : t('carbon.createSellOrder', '创建卖单')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Chart area */}
          <div className="xl:col-span-2 space-y-6">
            {/* Ammm Market Price Volatility Chart Card */}
            <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  {t('carbon.ammPriceChart', 'AMM市价波动图表')}
                  <span className="text-sm text-gray-500 ml-2">{t('carbon.24hourTrend', '24小时走势')}</span>
                </h2>
                
                {/* Data source toggle button */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseRealData(false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      !useRealData
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                                      >
                      {t('carbon.simulatedData', '🎲 模拟数据')}
                    </button>
                    <button
                      onClick={() => setUseRealData(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        useRealData
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {t('carbon.realData', '🔗 真实数据')}
                    </button>
                </div>
              </div>
              
              {/* Price statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                  <div className="text-center">
                    <div className="text-blue-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealData ? '🔗' : '🎲'}
                      {t('carbon.current', '当前价格')}
                    </div>
                    <div className="text-blue-800 font-bold text-lg">
                      {Number(currentPrice) > 0 ? currentPrice : testPrice}
                    </div>
                    <div className="text-blue-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                  <div className="text-center">
                    <div className="text-green-600 text-xs font-medium mb-1">{t('carbon.24hHigh', '24h最高')}</div>
                    <div className="text-green-800 font-bold text-lg">
                      {priceHistory.length > 0 
                        ? Math.max(...priceHistory.map(p => p.price)).toFixed(2)
                        : '0.00'
                      }
                    </div>
                    <div className="text-green-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 border border-red-200">
                  <div className="text-center">
                    <div className="text-red-600 text-xs font-medium mb-1">{t('carbon.24hLow', '24h最低')}</div>
                    <div className="text-red-800 font-bold text-lg">
                      {priceHistory.length > 0 
                        ? Math.min(...priceHistory.map(p => p.price)).toFixed(2)
                        : '0.00'
                      }
                    </div>
                    <div className="text-red-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 border border-purple-200">
                  <div className="text-center">
                    <div className="text-purple-600 text-xs font-medium mb-1">{t('carbon.24hVolume', '24h成交量')}</div>
                    <div className="text-purple-800 font-bold text-lg">
                      {priceHistory.length > 0 
                        ? (priceHistory.reduce((sum, p) => sum + p.volume, 0) / 1000).toFixed(1) + 'K'
                        : '0K'
                      }
                    </div>
                    <div className="text-purple-500 text-xs">CARB</div>
                  </div>
                </div>
              </div>

              {/* Professional K-line chart */}
              <div className="h-96 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 border border-gray-700 relative overflow-hidden">
                {/* Chart title bar */}
                <div className="absolute top-2 left-4 right-4 flex justify-between items-center z-10">
                  <div className="text-white text-sm font-medium">CARB/USDT</div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-green-400">24H {priceHistory.length > 0 ? Math.max(...priceHistory.map(p => p.price)).toFixed(2) : '0.00'}</div>
                    <div className="text-red-400">24L {priceHistory.length > 0 ? Math.min(...priceHistory.map(p => p.price)).toFixed(2) : '0.00'}</div>
                    <div className="text-blue-400">
                      Vol {priceHistory.length > 0 ? (priceHistory.reduce((sum, p) => sum + p.volume, 0) / 1000000).toFixed(2) : '0.00'}M
                    </div>
                  </div>
                </div>

                <div className="h-full pt-8 relative">
                  {/* Grid line background */}
                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
                    {/* Horizontal grid lines */}
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <line
                        key={`h-${i}`}
                        x1="60"
                        y1={30 + (i * 50)}
                        x2="100%"
                        y2={30 + (i * 50)}
                        stroke="#374151"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                    ))}
                    {/* Vertical grid lines */}
                    {[0, 1, 2, 3, 4, 5, 6].map(i => (
                      <line
                        key={`v-${i}`}
                        x1={60 + (i * (100 / 6))}
                        y1="30"
                        x2={60 + (i * (100 / 6))}
                        y2="280"
                        stroke="#374151"
                        strokeWidth="0.5"
                        strokeDasharray="2,2"
                      />
                    ))}
                  </svg>

                  {/* Y-axis price tag */}
                  <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 py-8">
                    {[0, 1, 2, 3, 4, 5].map(i => {
                      const maxPrice = candlestickData.length > 0 ? Math.max(...candlestickData.map(c => c.high)) : 90
                      const minPrice = candlestickData.length > 0 ? Math.min(...candlestickData.map(c => c.low)) : 86
                      const priceRange = maxPrice - minPrice || 4
                      const price = maxPrice - (i * priceRange / 5)
                      return (
                        <span key={i} className="text-right pr-2 w-14">
                          {price.toFixed(1)}
                        </span>
                      )
                    })}
                  </div>
                  
                  {/* K-line chart and trading volume */}
                  <div className="ml-16 h-full relative">
                    {/* Main K-line chart area */}
                    <div className="h-3/4 relative">
                      <svg className="w-full h-full" viewBox="0 0 800 300" style={{ zIndex: 2 }}>
                        {candlestickData.length > 0 && candlestickData.map((candle, index) => {
                          const maxPrice = Math.max(...candlestickData.map(c => c.high))
                          const minPrice = Math.min(...candlestickData.map(c => c.low))
                          const priceRange = maxPrice - minPrice || 1
                          
                          const x = (index / Math.max(candlestickData.length - 1, 1)) * 760 + 20
                          const candleWidth = Math.max(6, 760 / candlestickData.length * 0.8)
                          
                          // Calculate y coordinates

                          const yHigh = 30 + ((maxPrice - candle.high) / priceRange) * 240
                          const yLow = 30 + ((maxPrice - candle.low) / priceRange) * 240
                          const yOpen = 30 + ((maxPrice - candle.open) / priceRange) * 240
                          const yClose = 30 + ((maxPrice - candle.close) / priceRange) * 240
                          
                          const isUp = candle.close >= candle.open
                          const bodyHeight = Math.abs(yClose - yOpen)
                          const bodyY = Math.min(yOpen, yClose)
                          
                          return (
                            <g key={index}>
                              {/* Up and down shadow lines */}
                              <line
                                x1={x}
                                y1={yHigh}
                                x2={x}
                                y2={yLow}
                                stroke={isUp ? '#10b981' : '#ef4444'}
                                strokeWidth="1"
                              />
                              
                              {/* K-line entity */}
                              <rect
                                x={x - candleWidth / 2}
                                y={bodyY}
                                width={candleWidth}
                                height={Math.max(bodyHeight, 1)}
                                fill={isUp ? '#10b981' : '#ef4444'}
                                stroke={isUp ? '#10b981' : '#ef4444'}
                                strokeWidth="1"
                                rx="1"
                                className="hover:opacity-80 cursor-pointer"
                              >
                                <title>
                                  {new Date(candle.timestamp).toLocaleString()}
                                  {'\n'}开盘: {candle.open} USDT
                                  {'\n'}收盘: {candle.close} USDT
                                  {'\n'}最高: {candle.high} USDT
                                  {'\n'}最低: {candle.low} USDT
                                  {'\n'}成交量: {candle.volume.toLocaleString()}
                                </title>
                              </rect>
                            </g>
                          )
                        })}
                        
                        {/* Ma Moving Average */}
                        {candlestickData.length > 5 && (
                          <>
                            {/* 5-day moving average */}
                            <polyline
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="1.5"
                              opacity="0.8"
                              points={
                                candlestickData.map((candle, index) => {
                                  if (index < 4) return null
                                  
                                  const ma5 = candlestickData.slice(index - 4, index + 1)
                                    .reduce((sum, c) => sum + c.close, 0) / 5
                                  
                                  const maxPrice = Math.max(...candlestickData.map(c => c.high))
                                  const minPrice = Math.min(...candlestickData.map(c => c.low))
                                  const priceRange = maxPrice - minPrice || 1
                                  
                                  const x = (index / Math.max(candlestickData.length - 1, 1)) * 760 + 20
                                  const y = 30 + ((maxPrice - ma5) / priceRange) * 240
                                  
                                  return `${x},${y}`
                                }).filter(Boolean).join(' ')
                              }
                            />
                            
                            {/* 20-day moving average */}
                            <polyline
                              fill="none"
                              stroke="#8b5cf6"
                              strokeWidth="1.5"
                              opacity="0.8"
                              points={
                                candlestickData.map((candle, index) => {
                                  if (index < 19 || candlestickData.length < 20) return null
                                  
                                  const ma20 = candlestickData.slice(index - 19, index + 1)
                                    .reduce((sum, c) => sum + c.close, 0) / 20
                                  
                                  const maxPrice = Math.max(...candlestickData.map(c => c.high))
                                  const minPrice = Math.min(...candlestickData.map(c => c.low))
                                  const priceRange = maxPrice - minPrice || 1
                                  
                                  const x = (index / Math.max(candlestickData.length - 1, 1)) * 760 + 20
                                  const y = 30 + ((maxPrice - ma20) / priceRange) * 240
                                  
                                  return `${x},${y}`
                                }).filter(Boolean).join(' ')
                              }
                            />
                          </>
                        )}
                      </svg>
                    </div>
                    
                    {/* Volume bar chart */}
                    <div className="h-1/4 border-t border-gray-600 pt-2 relative">
                      <svg className="w-full h-full" viewBox="0 0 800 75">
                        {candlestickData.length > 0 && candlestickData.map((candle, index) => {
                          const maxVolume = Math.max(...candlestickData.map(c => c.volume))
                          const volumeHeight = maxVolume > 0 ? (candle.volume / maxVolume) * 60 : 0
                          
                          const x = (index / Math.max(candlestickData.length - 1, 1)) * 760 + 20
                          const barWidth = Math.max(4, 760 / candlestickData.length * 0.6)
                          const isUp = candle.close >= candle.open
                          
                          return (
                            <rect
                              key={index}
                              x={x - barWidth / 2}
                              y={65 - volumeHeight}
                              width={barWidth}
                              height={volumeHeight}
                              fill={isUp ? '#10b981' : '#ef4444'}
                              opacity="0.6"
                              className="hover:opacity-80"
                            >
                              <title>成交量: {candle.volume.toLocaleString()}</title>
                            </rect>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                  
                  {/* X-axis time tag */}
                  <div className="absolute bottom-0 left-16 right-0 flex justify-between text-xs text-gray-400 px-2">
                    {candlestickData.length > 0 && [0, Math.floor(candlestickData.length / 4), Math.floor(candlestickData.length / 2), Math.floor(candlestickData.length * 3 / 4), candlestickData.length - 1].map(i => (
                      <span key={i}>
                        {candlestickData[i] ? new Date(candlestickData[i].timestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit' }) : ''}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Legend and data source description */}
                <div className="absolute bottom-2 left-4 right-4 flex justify-between items-center">
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-yellow-400"></div>
                      <span className="text-gray-300">MA5</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-purple-400"></div>
                      <span className="text-gray-300">MA20</span>
                    </div>
                  </div>
                  
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                    useRealData 
                      ? 'bg-green-900/50 text-green-300 border border-green-600/30'
                      : 'bg-blue-900/50 text-blue-300 border border-blue-600/30'
                  }`}>
                    <span>{useRealData ? '🔗' : '🎲'}</span>
                    <span>
                      {useRealData 
                        ? `${t('carbon.blockchainDataPrefix', '区块链数据')} (${candlestickData.length}${t('carbon.klinesUnit', '根K线')})`
                        : t('carbon.simulatedDataLabel', '模拟数据')
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Limit order distribution chart card */}
            <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  {t('carbon.limitOrderDistribution', '限价单订单分布')}
                  <span className="text-sm text-gray-500 ml-2">{t('carbon.orderBookDepth', '买卖盘深度')}</span>
                </h2>
                
                {/* Order Book Data Source Toggle Button */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseRealOrderBook(false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      !useRealOrderBook
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                                      >
                      {t('carbon.simulatedOrders', '🎲 模拟订单')}
                    </button>
                    <button
                      onClick={() => setUseRealOrderBook(true)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        useRealOrderBook
                          ? 'bg-green-500 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {t('carbon.realOrders', '🔗 真实订单')}
                    </button>
                </div>
              </div>
              
              {/* Order statistics */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                  <div className="text-center">
                    <div className="text-green-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealOrderBook ? '🔗' : '🎲'}
                      {t('carbon.averageBuyPrice', '平均买价')}
                    </div>
                    <div className="text-green-800 font-bold text-lg">
                      {(useRealOrderBook ? realOrderBookData : orderBookData).averageBuyPrice.toFixed(2)}
                    </div>
                    <div className="text-green-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-3 border border-red-200">
                  <div className="text-center">
                    <div className="text-red-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealOrderBook ? '🔗' : '🎲'}
                      {t('carbon.averageSellPrice', '平均卖价')}
                    </div>
                    <div className="text-red-800 font-bold text-lg">
                      {(useRealOrderBook ? realOrderBookData : orderBookData).averageSellPrice.toFixed(2)}
                    </div>
                    <div className="text-red-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-3 border border-yellow-200">
                  <div className="text-center">
                    <div className="text-yellow-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealOrderBook ? '🔗' : '🎲'}
                      {t('carbon.priceSpread', '价格差价')}
                    </div>
                    <div className="text-yellow-800 font-bold text-lg">
                      {(useRealOrderBook ? realOrderBookData : orderBookData).priceSpread.toFixed(2)}
                    </div>
                    <div className="text-yellow-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 border border-purple-200">
                  <div className="text-center">
                    <div className="text-purple-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealOrderBook ? '🔗' : '🎲'}
                      {t('carbon.marketAveragePrice', '市场均价')}
                    </div>
                    <div className="text-purple-800 font-bold text-lg">
                      {(() => {
                        const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                        const allOrders = [...currentData.buyOrders, ...currentData.sellOrders]
                        if (allOrders.length === 0) return '0.00'
                        
                        // Calculate weighted average price (weighted by quantity)

                        const totalWeightedPrice = allOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
                        const totalAmount = allOrders.reduce((sum, order) => sum + order.amount, 0)
                        const marketAvgPrice = totalAmount > 0 ? totalWeightedPrice / totalAmount : 0
                        
                        return marketAvgPrice.toFixed(2)
                      })()}
                    </div>
                    <div className="text-purple-500 text-xs">USDT</div>
                  </div>
                </div>
              </div>

              {/* Order distribution chart */}
              <div className="grid grid-cols-2 gap-4">
                {/* Payment depth */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <h3 className="text-green-800 font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">📈</span>
                    {t('carbon.buyOrderDepth', '买单深度')}
                    <span className="text-xs text-green-600 ml-auto">
                      {useRealOrderBook ? t('carbon.real', '🔗 真实') : t('carbon.simulated', '🎲 模拟')}
                    </span>
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(useRealOrderBook ? realOrderBookData : orderBookData).buyOrders.slice(0, 8).map((order, index) => {
                      const maxAmount = Math.max(...(useRealOrderBook ? realOrderBookData : orderBookData).buyOrders.map(o => o.amount))
                      const percentage = maxAmount > 0 ? (order.amount / maxAmount) * 100 : 0
                      
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-green-700 font-medium w-16">
                              {order.price.toFixed(2)}
                            </span>
                            <div className="w-16 h-2 bg-green-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-green-600 font-medium">
                            {order.amount.toFixed(0)}
                          </span>
                        </div>
                      )
                    })}
                    {(useRealOrderBook ? realOrderBookData : orderBookData).buyOrders.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4">
                        {useRealOrderBook ? t('carbon.noRealBuyOrders', '暂无真实买单') : t('carbon.noSimulatedBuyOrders', '暂无模拟买单')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sell ​​order depth */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
                  <h3 className="text-red-800 font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">📉</span>
                    {t('carbon.sellOrderDepth', '卖单深度')}
                    <span className="text-xs text-red-600 ml-auto">
                      {useRealOrderBook ? t('carbon.real', '🔗 真实') : t('carbon.simulated', '🎲 模拟')}
                    </span>
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(useRealOrderBook ? realOrderBookData : orderBookData).sellOrders.slice(0, 8).map((order, index) => {
                      const maxAmount = Math.max(...(useRealOrderBook ? realOrderBookData : orderBookData).sellOrders.map(o => o.amount))
                      const percentage = maxAmount > 0 ? (order.amount / maxAmount) * 100 : 0
                      
                      return (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-700 font-medium w-16">
                              {order.price.toFixed(2)}
                            </span>
                            <div className="w-16 h-2 bg-red-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-red-500 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-red-600 font-medium">
                            {order.amount.toFixed(0)}
                          </span>
                        </div>
                      )
                    })}
                    {(useRealOrderBook ? realOrderBookData : orderBookData).sellOrders.length === 0 && (
                      <div className="text-center text-gray-500 text-sm py-4">
                        {useRealOrderBook ? t('carbon.noRealSellOrders', '暂无真实卖单') : t('carbon.noSimulatedSellOrders', '暂无模拟卖单')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Market liquidity distribution chart (simplified version) */}
              <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <h3 className="text-gray-800 font-semibold mb-3 text-center flex items-center justify-center gap-2">
                  {t('carbon.marketLiquidityDistribution', '市场流动性分布')}
                  <span className="text-xs text-gray-600">
                    ({useRealOrderBook ? t('carbon.realData', '🔗 真实数据') : t('carbon.simulatedData', '🎲 模拟数据')})
                  </span>
                </h3>
                <div className="flex items-center justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {(() => {
                        const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                        const buyVolume = currentData.buyOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
                        const sellVolume = currentData.sellOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
                        const totalVolume = buyVolume + sellVolume
                        const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) : 0.5
                        const sellPercentage = totalVolume > 0 ? (sellVolume / totalVolume) : 0.5
                        
                        return (
                          <>
                            {/* Pay order fund fan */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="8"
                              strokeDasharray={`${buyPercentage * 251.2} 251.2`}
                              strokeLinecap="round"
                              className="transition-all duration-300"
                            />
                            {/* Sell ​​order fund fan */}
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="none"
                              stroke="#ef4444"
                              strokeWidth="8"
                              strokeDasharray={`${sellPercentage * 251.2} 251.2`}
                              strokeDashoffset={`-${buyPercentage * 251.2}`}
                              strokeLinecap="round"
                              className="transition-all duration-300"
                            />
                          </>
                        )
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-800">
                          {(() => {
                            const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                            const totalVolume = [...currentData.buyOrders, ...currentData.sellOrders]
                              .reduce((sum, order) => sum + (order.price * order.amount), 0)
                            return totalVolume > 1000000 
                              ? `${(totalVolume / 1000000).toFixed(1)}M` 
                              : totalVolume > 1000 
                                ? `${(totalVolume / 1000).toFixed(1)}K`
                                : totalVolume.toFixed(0)
                          })()}
                        </div>
                        <div className="text-xs text-gray-600">USDT</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* legend */}
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        {t('carbon.buyOrderFunds', '买单资金')} ({(() => {
                          const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                          const buyVolume = currentData.buyOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
                          return buyVolume > 1000000 
                            ? `${(buyVolume / 1000000).toFixed(1)}M` 
                            : buyVolume > 1000 
                              ? `${(buyVolume / 1000).toFixed(1)}K`
                              : buyVolume.toFixed(0)
                        })()})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        {t('carbon.sellOrderFunds', '卖单资金')} ({(() => {
                          const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                          const sellVolume = currentData.sellOrders.reduce((sum, order) => sum + (order.price * order.amount), 0)
                          return sellVolume > 1000000 
                            ? `${(sellVolume / 1000000).toFixed(1)}M` 
                            : sellVolume > 1000 
                              ? `${(sellVolume / 1000).toFixed(1)}K`
                              : sellVolume.toFixed(0)
                        })()})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Underside: Order Book */}
      <div>
        <OrderBook />
      </div>

      {/* Market statistics information */}
      {marketStats && (
        <div className="mt-8 bg-white/90 rounded-2xl shadow-xl p-6 border border-white/20">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 {t('carbon.marketStats.title')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{Number(marketStats.totalOrdersCreated)}</div>
              <div className="text-sm text-gray-600">{t('carbon.marketStats.totalOrders')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{Number(marketStats.totalOrdersFilled)}</div>
              <div className="text-sm text-gray-600">{t('carbon.filledOrders')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{Number(marketStats.totalOrdersCancelled)}</div>
              <div className="text-sm text-gray-600">{t('carbon.cancelledOrders')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{formatTokenAmount(marketStats.totalVolumeTraded)}</div>
              <div className="text-sm text-gray-600">{t('carbon.marketStats.totalVolume')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction success pop-up window */}
      {showSuccessModal && successData && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/20">
            {/* Success Icon */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                {t('carbon.success.congratulations')}
              </h2>
              <p className="text-gray-600">
                {successData?.type === 'buy' 
                  ? t('carbon.success.buySuccess') 
                  : t('carbon.success.sellSuccess')
                }
              </p>
            </div>

            {/* Transaction details */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('carbon.success.orderType')}:</span>
                  <span className="font-semibold text-gray-800">
                    {successData?.orderType === 'market' ? t('carbon.marketOrder') : t('carbon.limitOrder')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('carbon.success.amount')}:</span>
                  <span className="font-semibold text-gray-800">
                    {Number(successData?.amount || 0).toFixed(2)} {successData?.type === 'buy' ? 'USDT' : 'CARB'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t('carbon.success.price')}:</span>
                  <span className="font-semibold text-gray-800">
                    {successData?.price || '0'} USDT
                  </span>
                </div>
              </div>
            </div>

            {/* Operation button */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                {t('carbon.success.close')}
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  // You can add a jump to view transaction history

                }}
                className="flex-1 bg-green-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-green-700 transition-colors"
              >
                {t('carbon.success.viewTransaction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 