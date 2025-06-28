import React, { useState, useEffect, useCallback } from 'react'
import { useCarbonUSDTMarket } from '@/hooks/useCarbonUSDTMarket'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTranslation } from '@/hooks/useI18n'
import { ConfigError } from '@/components/ErrorBoundary'
import OrderBook from '@/components/OrderBook'
import toast from 'react-hot-toast'
import { readContract } from '@wagmi/core'
import { config } from '@/lib/wagmi'
import { formatUnits } from 'viem'
import { useWatchContractEvent } from 'wagmi'
import GreenTalesLiquidityPoolABI from '@/contracts/abi/GreenTalesLiquidityPool.json'
import CarbonUSDTMarketABI from '@/contracts/abi/CarbonUSDTMarket.json'

/**
 * 碳币市场主组件
 * 支持市价单和限价单交易
 * 集成新的CarbonUSDTMarket合约功能
 */
export default function CarbonMarket() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'market' | 'limit'>('market')
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  
  // 市价单输入 - 双输入框
  const [marketCarbonAmount, setMarketCarbonAmount] = useState('')
  const [marketUsdtAmount, setMarketUsdtAmount] = useState('')
  const [isCalculating, setIsCalculating] = useState(false)
  
  // 手续费估算状态
  const [swapEstimate, setSwapEstimate] = useState<{
    amountOut: string
    fee: string
    priceImpact: string
  } | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  
  // 限价单输入
  const [limitAmount, setLimitAmount] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  
  // 授权状态
  const [isApprovingCarbon, setIsApprovingCarbon] = useState(false)
  const [isApprovingUsdt, setIsApprovingUsdt] = useState(false)

  // 图表数据状态类型定义
  type PriceHistoryItem = {
    timestamp: number
    price: number
    volume: number
  }

  // K线数据类型定义 - 适用于专业交易图表
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
  const [candlestickData, setCandlestickData] = useState<CandlestickData[]>([]) // K线数据
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({
    buyOrders: [],
    sellOrders: [],
    averageBuyPrice: 0,
    averageSellPrice: 0,
    priceSpread: 0
  })

  // 数据源类型切换状态
  const [useRealData, setUseRealData] = useState(true) // false=模拟数据, true=真实数据 - 默认显示真实数据
  const [useRealOrderBook, setUseRealOrderBook] = useState(true) // false=模拟订单簿, true=真实订单簿 - 默认显示真实订单

  // 获取hooks
  const {
    isConnected,
    carbonBalance,
    usdtBalance,
    userBalances,
    marketStats,
    feeRates,
    isWritePending,
    isConfirmed,
    createBuyOrder,
    createSellOrder,
    formatTokenAmount,
    marketAddress,
    carbonTokenAddress,
    usdtTokenAddress,
  } = useCarbonUSDTMarket()

  // 获取流动性池相关状态和函数
  const {
    isLoading: isLiquidityPoolPending,
    isConnected: isLiquidityPoolConnected,
    swapCarbonToUsdt,
    swapUsdtToCarbon,
    liquidityPoolAddress,
    poolData, // 获取池子数据，包含当前价格
    getSwapEstimate, // 获取手续费估算

  } = useGreenTalesLiquidityPool()

  // 添加状态用于存储合约数据和历史价格
  const [contractPoolStats, setContractPoolStats] = useState<any>(null)
  const [realOrderBookData, setRealOrderBookData] = useState<OrderBookData>({
    buyOrders: [],
    sellOrders: [],
    averageBuyPrice: 0,
    averageSellPrice: 0,
    priceSpread: 0
  }) // 真实订单簿数据


  // 从本地存储加载真实价格历史
  const loadRealPriceHistory = useCallback(() => {
    try {
      const PRICE_CACHE_KEY = 'amm_price_history_real_data'
      const stored = localStorage.getItem(PRICE_CACHE_KEY)
      if (stored) {
        const parsedData = JSON.parse(stored)
        // 只保留最近24小时的数据
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

  // 保存真实价格数据到本地存储（按小时记录）
  const saveRealPriceData = useCallback((price: number, volume: number = 0) => {
    const PRICE_CACHE_KEY = 'amm_price_history_real_data'
    const now = Date.now()
    // 计算当前小时的起始时间戳（整点时间）
    const currentHour = Math.floor(now / (60 * 60 * 1000)) * (60 * 60 * 1000)
    
    const newPricePoint: PriceHistoryItem = {
      timestamp: currentHour, // 使用整点时间作为时间戳
      price: Number(price.toFixed(2)),
      volume: Number(volume.toFixed(0))
    }

    try {
      // 从本地存储获取现有数据
      const stored = localStorage.getItem(PRICE_CACHE_KEY)
      let existingData: PriceHistoryItem[] = []
      
      if (stored) {
        existingData = JSON.parse(stored)
      }
      
      // 查找当前小时是否已有数据点
      const existingIndex = existingData.findIndex(item => item.timestamp === currentHour)
      
      let updated: PriceHistoryItem[]
      if (existingIndex >= 0) {
        // 如果当前小时已有数据，更新该数据点
        updated = [...existingData]
        updated[existingIndex] = newPricePoint
        console.log('🔄 更新当前小时价格数据:', price, 'USDT，时间:', new Date(currentHour).toLocaleString())
      } else {
        // 如果当前小时没有数据，添加新数据点
        updated = [...existingData, newPricePoint]
        console.log('➕ 添加新小时价格数据:', price, 'USDT，时间:', new Date(currentHour).toLocaleString())
      }
      
      // 只保留最近24小时的数据
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      const validData = updated.filter(item => item.timestamp > oneDayAgo)
      
      localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(validData))
      console.log('💾 真实价格已保存到本地存储，数据点:', validData.length, '小时')
    } catch (error) {
      console.error('❌ 保存真实价格数据失败:', error)
    }
  }, [])

  // 监听TokensSwapped事件 - 当有交易时立即记录价格
  useWatchContractEvent({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    eventName: 'TokensSwapped',
    onLogs(logs) {
      console.log('🔥 检测到新的交易事件，立即记录当前价格:', logs.length, '笔交易')
      
      // 当有新交易时，立即记录当前价格到缓存
      if (useRealData) {
        const currentMarketPrice = Number(poolData?.currentPrice) || 88
        const volume = logs.reduce((total, log: any) => {
          const amountIn = log.args?.amountIn ? Number(formatUnits(log.args.amountIn as bigint, 18)) : 0
          const amountOut = log.args?.amountOut ? Number(formatUnits(log.args.amountOut as bigint, 18)) : 0
          return total + Math.max(amountIn, amountOut)
        }, 0)
        
        console.log('📊 交易触发价格更新:', currentMarketPrice, 'USDT，交易量:', volume.toFixed(2))
        saveRealPriceData(currentMarketPrice, volume)
        
        // 触发价格历史更新
        setTimeout(() => {
          generateRealPriceHistory()
        }, 500)
      }
    },
    enabled: !!liquidityPoolAddress && useRealData,
  })

  // 监听限价单事件 - 当有订单创建、成交、取消时更新订单簿
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

  // 从合约获取实时数据的函数
  const fetchContractData = useCallback(async () => {
    if (!liquidityPoolAddress) return

    try {
      // 使用readContract获取合约数据
      const poolStatsResult = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getPoolStats',
      })

      console.log('🔄 合约数据更新:', {
        poolStats: poolStatsResult
      })

      // 将BigInt转换为可用的数据
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

  // 定时记录AMM市场价格（按小时）
  useEffect(() => {
    if (!useRealData) return

    // 立即记录一次当前价格
    const currentMarketPrice = Number(poolData?.currentPrice) || 88
    if (currentMarketPrice > 0) {
      saveRealPriceData(currentMarketPrice, Number(contractPoolStats?.totalVolume) || 0)
    }

    // 计算距离下一个整点的时间
    const now = Date.now()
    const nextHour = Math.ceil(now / (60 * 60 * 1000)) * (60 * 60 * 1000)
    const timeToNextHour = nextHour - now

    // 在下一个整点时开始定时记录
    const initialTimeout = setTimeout(() => {
      // 记录整点价格
      const marketPrice = Number(poolData?.currentPrice) || 88
      const volume = Number(contractPoolStats?.totalVolume) || 0
      console.log('⏰ 整点记录AMM市场价格:', marketPrice, 'USDT')
      saveRealPriceData(marketPrice, volume)

      // 然后每小时记录一次
      const priceRecordInterval = setInterval(() => {
        const marketPrice = Number(poolData?.currentPrice) || 88
        const volume = Number(contractPoolStats?.totalVolume) || 0
        
        console.log('⏰ 每小时记录AMM市场价格:', marketPrice, 'USDT')
        saveRealPriceData(marketPrice, volume)
      }, 60 * 60 * 1000) // 1小时 = 60 * 60 * 1000 毫秒

      return () => {
        clearInterval(priceRecordInterval)
      }
    }, timeToNextHour)

    return () => {
      clearTimeout(initialTimeout)
    }
  }, [useRealData, poolData?.currentPrice, contractPoolStats?.totalVolume, saveRealPriceData])

  // 从CarbonUSDTMarket合约获取真实订单簿数据
  const fetchRealOrderBookData = useCallback(async () => {
    if (!marketAddress || !useRealOrderBook) return

    try {
      // 使用readContract获取订单簿数据
      const orderBookResult = await readContract(config, {
        address: marketAddress as `0x${string}`,
        abi: CarbonUSDTMarketABI.abi,
        functionName: 'getOrderBook',
        args: [],
      })

      console.log('🔄 获取真实订单簿数据:', orderBookResult)

      if (orderBookResult) {
        const [buyOrdersRaw, sellOrdersRaw] = orderBookResult as any[]
        
        // 转换买单数据
        const buyOrders: OrderItem[] = buyOrdersRaw.map((order: any) => ({
          price: Number(formatUnits(order.price, 0)), // 价格已经是基础单位
          amount: Number(formatUnits(order.remainingAmount, 18)), // 数量是18位精度
          total: Number(formatUnits(order.remainingAmount, 18)) * Number(formatUnits(order.price, 0))
        })).sort((a: OrderItem, b: OrderItem) => b.price - a.price) // 买单按价格从高到低排序
        
        // 转换卖单数据
        const sellOrders: OrderItem[] = sellOrdersRaw.map((order: any) => ({
          price: Number(formatUnits(order.price, 0)), // 价格已经是基础单位
          amount: Number(formatUnits(order.remainingAmount, 18)), // 数量是18位精度
          total: Number(formatUnits(order.remainingAmount, 18)) * Number(formatUnits(order.price, 0))
        })).sort((a: OrderItem, b: OrderItem) => a.price - b.price) // 卖单按价格从低到高排序

        // 计算平均价格和价差
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

  // 基于真实数据生成价格历史
  const generateRealPriceHistory = useCallback(() => {
    if (!useRealData) return

    console.log('🔍 基于真实数据生成价格历史...')
    
    // 加载真实价格历史
    const realData = loadRealPriceHistory()
    
    if (realData.length >= 5) {
      // 如果有足够的真实数据，直接使用
      console.log('📈 使用真实价格历史，小时数:', realData.length)
      setPriceHistory(realData)
    } else {
      // 如果真实数据不足，生成初始数据并开始收集
      console.log('📈 真实数据不足，生成初始估算数据并开始收集真实数据')
      
      const now = Date.now()
      const history: PriceHistoryItem[] = []
      const basePrice = Number(poolData?.currentPrice) || 88
      const minPrice = 45 // 历史最低价
      
      // 生成过去24小时的估算数据（每小时一个点）
      for (let i = 23; i >= 0; i--) { // 每小时一个点，从23小时前到当前
        const hourTimestamp = Math.floor((now - (i * 60 * 60 * 1000)) / (60 * 60 * 1000)) * (60 * 60 * 1000)
        const timeProgress = i / 24
        
        // 价格恢复趋势
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
      
      // 添加真实数据
      if (realData.length > 0) {
        history.push(...realData)
      }
      
              // 按时间排序并去重（按小时去重）
        const uniqueHistory = history
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter((item, index, arr) => 
            index === 0 || Math.abs(item.timestamp - arr[index - 1].timestamp) > 3600000 // 至少间隔1小时
          )
      
      setPriceHistory(uniqueHistory)
              console.log('✅ 混合价格历史生成完成，小时数:', uniqueHistory.length, '（真实:', realData.length, '小时，估算:', history.length - realData.length, '小时）')
    }
  }, [useRealData, poolData?.currentPrice, loadRealPriceHistory])

  // 初始化时加载真实数据
  useEffect(() => {
    if (useRealData) {
      loadRealPriceHistory()
    }
  }, [useRealData, loadRealPriceHistory])

  // 获取代币授权状态
  const carbonApproval = useTokenApproval(carbonTokenAddress, marketAddress)
  const usdtApproval = useTokenApproval(usdtTokenAddress, marketAddress)
  const carbonApprovalLiquidity = useTokenApproval(carbonTokenAddress, liquidityPoolAddress)
  const usdtApprovalLiquidity = useTokenApproval(usdtTokenAddress, liquidityPoolAddress)

  // 地址验证
  const isValidAddress = (address: string) => {
    return address && address !== '0x' && address.length === 42
  }

  const isMarketReady = isValidAddress(marketAddress) && isValidAddress(carbonTokenAddress) && isValidAddress(usdtTokenAddress)

  // 获取当前市场价格 - 优先使用流动性池价格，备选使用默认价格
  const currentPrice = poolData?.currentPrice || '88.00'
  
  // 获取预言机参考价格 - 用于价格偏离检查
  const referencePrice = poolData?.referencePrice || '88.00'

  // 临时使用固定价格进行测试
  const testPrice = '88.00' // 固定测试价格

  // 调试信息
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

  // 检查流动性池连接状态
  console.log('流动性池状态:', {
    isLiquidityPoolConnected,
    isLiquidityPoolPending,
    liquidityPoolAddress
  })

  // 模拟价格历史数据生成函数
  const generatePriceHistory = useCallback((): PriceHistoryItem[] => {
    const now = Date.now()
    const history: PriceHistoryItem[] = []
    const basePrice = Number(currentPrice) || 88
    
    // 生成过去24小时的价格数据，每15分钟一个数据点
    for (let i = 96; i >= 0; i--) {
      const timestamp = now - (i * 15 * 60 * 1000) // 15分钟间隔
      const randomVariation = (Math.random() - 0.5) * 4 // ±2的随机波动
      const trendVariation = Math.sin(i / 10) * 2 // 添加趋势性波动
      const price = Math.max(0.1, basePrice + randomVariation + trendVariation)
      const volume = Math.random() * 10000 + 1000 // 随机交易量
      
      history.push({
        timestamp,
        price: Number(price.toFixed(2)),
        volume: Number(volume.toFixed(0))
      })
    }
    
    return history
  }, [currentPrice])

  // 生成K线数据 - 将价格历史转换为专业K线格式
  const generateCandlestickData = useCallback((priceData: PriceHistoryItem[]): CandlestickData[] => {
    if (priceData.length === 0) return []
    
    const candlesticks: CandlestickData[] = []
    const basePrice = Number(currentPrice) || 88
    
    // 按小时分组生成K线数据
    const hourlyGroups = new Map<number, PriceHistoryItem[]>()
    
    priceData.forEach(item => {
      const hourKey = Math.floor(item.timestamp / (60 * 60 * 1000)) // 按小时分组
      if (!hourlyGroups.has(hourKey)) {
        hourlyGroups.set(hourKey, [])
      }
      hourlyGroups.get(hourKey)!.push(item)
    })
    
    // 为每个小时生成K线数据
    Array.from(hourlyGroups.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([hourKey, hourData]) => {
        if (hourData.length === 0) return
        
        // 计算该小时的开盘、收盘、最高、最低价
        const sortedByTime = hourData.sort((a, b) => a.timestamp - b.timestamp)
        const open = sortedByTime[0].price
        const close = sortedByTime[sortedByTime.length - 1].price
        const high = Math.max(...hourData.map(d => d.price))
        const low = Math.min(...hourData.map(d => d.price))
        const volume = hourData.reduce((sum, d) => sum + d.volume, 0)
        
        candlesticks.push({
          timestamp: hourKey * 60 * 60 * 1000, // 转回时间戳
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Number(volume.toFixed(0))
        })
      })
    
    // 如果数据不足，生成模拟K线数据
    if (candlesticks.length < 24) {
      const now = Date.now()
      for (let i = 23; i >= 0; i--) {
        const timestamp = now - (i * 60 * 60 * 1000) // 每小时
        const existingCandle = candlesticks.find(c => 
          Math.abs(c.timestamp - timestamp) < 30 * 60 * 1000 // 30分钟容差
        )
        
        if (!existingCandle) {
          // 生成模拟K线数据
          const baseVariation = (Math.random() - 0.5) * 6 // ±3的基础波动
          const trendFactor = Math.sin(i / 8) * 2 // 趋势性变化
          
          const open = Math.max(1, basePrice + baseVariation + trendFactor)
          const volatility = Math.random() * 2 + 0.5 // 0.5-2.5的波动率
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

  // 当价格历史更新时，生成对应的K线数据
  useEffect(() => {
    if (priceHistory.length > 0) {
      setCandlestickData(generateCandlestickData(priceHistory))
    }
  }, [priceHistory, generateCandlestickData])

  // 模拟订单簿数据生成函数
  const generateOrderBookData = useCallback((): OrderBookData => {
    const basePrice = Number(currentPrice) || 88
    
    // 生成买单（价格递减）
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
    
    // 生成卖单（价格递增）
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
    
    // 计算平均价格
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

  // 初始化图表数据
  useEffect(() => {
    const initializeData = async () => {
      // 获取合约真实数据
      await fetchContractData()
      
      if (useRealData) {
        // 使用真实数据，调用专门的函数
        generateRealPriceHistory()
      } else {
        // 使用模拟数据
        setPriceHistory(generatePriceHistory())
      }
      
      // 初始化订单簿数据
      if (useRealOrderBook) {
        // 获取真实订单簿数据
        await fetchRealOrderBookData()
      } else {
        // 使用模拟订单簿数据
        setOrderBookData(generateOrderBookData())
      }
    }
    
    initializeData()
  }, [useRealData, useRealOrderBook, generateRealPriceHistory, currentPrice, poolData?.referencePrice, fetchContractData, generatePriceHistory, generateOrderBookData, fetchRealOrderBookData, generateCandlestickData]) // 包含所有依赖

  // 基于事件的数据更新 - 不再使用定时器，保留订单簿的定时更新
  useEffect(() => {
    // 订单簿数据定时更新（独立于价格历史）
    const orderInterval = setInterval(() => {
      if (useRealOrderBook) {
        // 使用真实订单簿数据
        fetchRealOrderBookData()
      } else {
        // 使用模拟订单簿数据
        setOrderBookData(generateOrderBookData())
      }
    }, 10000) // 每10秒更新订单数据
    
    return () => {
      clearInterval(orderInterval)
    }
  }, [generateOrderBookData, useRealOrderBook, fetchRealOrderBookData])

  // 实时换算函数
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

    // 检查价格是否有效，如果无效则使用测试价格
    let price = Number(currentPrice)
    if (isNaN(price) || price <= 0) {
      console.warn('使用测试价格:', testPrice)
      price = Number(testPrice)
    }

    setIsCalculating(true)
    setIsEstimating(true)
    
    try {
      if (inputType === 'carbon') {
        // 用户输入碳币数量，计算对应的USDT数量
        const carbonAmount = Number(value)
        const usdtAmount = carbonAmount * price
        setMarketCarbonAmount(value)
        setMarketUsdtAmount(usdtAmount.toFixed(6))
        
        // 计算手续费（卖出碳币）- 用户输入的是要卖出的碳币数量
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
        // 用户输入USDT数量，计算对应的碳币数量
        const usdtAmount = Number(value)
        const carbonAmount = usdtAmount / price
        setMarketUsdtAmount(value)
        setMarketCarbonAmount(carbonAmount.toFixed(6))
        
        // 计算手续费（买入碳币）- 用户输入的是要付出的USDT数量
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

  // 计算兑换后的新价格和偏差（基于AMM公式）
  const calculatePriceImpact = (amountIn: string, isCarbonToUsdt: boolean) => {
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) return null
    
    try {
      const amountInNum = parseFloat(amountIn)
      const currentCarbonBalance = parseFloat(poolData.carbonBalance || '1000000') // 默认100万
      const currentUsdtBalance = parseFloat(poolData.usdtBalance || '88000000') // 默认8800万
      const currentPrice = parseFloat(poolData.currentPrice || '88.00')
      const referencePrice = parseFloat(poolData.referencePrice || '88.00')
      
      if (isNaN(currentCarbonBalance) || isNaN(currentUsdtBalance) || isNaN(currentPrice) || isNaN(referencePrice)) return null
      
      let newPrice: number
      
      if (isCarbonToUsdt) {
        // 碳币换USDT：用户输入碳币，池子碳币增加，USDT减少，价格下跌
        // 使用精确的AMM公式：k = x * y
        
        // 计算实际兑换出的USDT数量（考虑手续费）
        const amountOutBeforeFee = (amountInNum * currentUsdtBalance) / currentCarbonBalance
        const feeRate = 0.003 // 0.3%手续费
        const fee = amountOutBeforeFee * feeRate
        const amountOutAfterFee = amountOutBeforeFee - fee
        
        // 计算新的池子状态
        const newCarbonBalance = currentCarbonBalance + amountInNum // 池子碳币增加
        const newUsdtBalance = currentUsdtBalance - amountOutAfterFee // 池子USDT减少（扣除实际给用户的）
        
        // 计算新价格
        newPrice = newUsdtBalance / newCarbonBalance
      } else {
        // USDT换碳币：用户输入USDT，池子USDT增加，碳币减少，价格上涨
        
        // 计算实际兑换出的碳币数量（考虑手续费）
        const amountOutBeforeFee = (amountInNum * currentCarbonBalance) / currentUsdtBalance
        const feeRate = 0.003 // 0.3%手续费
        const fee = amountOutBeforeFee * feeRate
        const amountOutAfterFee = amountOutBeforeFee - fee
        
        // 计算新的池子状态
        const newUsdtBalance = currentUsdtBalance + amountInNum // 池子USDT增加
        const newCarbonBalance = currentCarbonBalance - amountOutAfterFee // 池子碳币减少（扣除实际给用户的）
        
        // 计算新价格
        newPrice = newUsdtBalance / newCarbonBalance
      }
      
      // 计算与参考价格的偏差
      const deviation = ((newPrice - referencePrice) / referencePrice) * 100
      
      return {
        newPrice: newPrice.toFixed(2),
        deviation: deviation.toFixed(2),
        isDeviated: Math.abs(deviation) > (poolData.priceDeviationThreshold || 10) // 超过阈值认为偏离
      }
    } catch (error) {
      console.error('计算价格影响失败:', error)
      return null
    }
  }

  // 计算碳币换USDT的价格影响（卖出碳币）
  const carbonToUsdtPriceImpact = calculatePriceImpact(marketCarbonAmount, true)

  // 计算USDT换碳币的价格影响（买入碳币）
  const usdtToCarbonPriceImpact = calculatePriceImpact(marketUsdtAmount, false)

  // 处理碳币数量输入变化
  const handleCarbonAmountChange = (value: string) => {
    calculateConversion('carbon', value)
  }

  // 处理USDT数量输入变化
  const handleUsdtAmountChange = (value: string) => {
    calculateConversion('usdt', value)
  }

  // 监听交易状态变化
  useEffect(() => {
    if (isConfirmed || isLiquidityPoolConnected) {
      toast.dismiss() // 清除loading提示
      
      // 根据交易类型显示不同的成功提示
      if (isLiquidityPoolConnected) {
        // 市价单成功（流动性池交易）
        if (activeTab === 'market') {
          toast.success(`🎉 ${t('carbon.success.marketOrderSuccess')}！${orderType === 'buy' ? t('carbon.buyCarbon') : t('carbon.sellCarbon')}`, { 
            duration: 5000,
            icon: '✅'
          })
        } else {
          // 限价单自动执行
          toast.success('🤖 智能限价单执行成功！', { 
            duration: 5000,
            icon: '🚀'
          })
        }
      } else if (isConfirmed) {
        // 限价单合约交易成功
        if (activeTab === 'limit') {
          toast.success(`🔗 限价${orderType === 'buy' ? t('carbon.buyOrder') : t('carbon.sellOrder')}创建成功！`, { 
            duration: 5000,
            icon: '✅'
          })
        } else {
          // 其他合约交易成功
          toast.success('🎉 交易已确认成功！', { duration: 4000 })
        }
      }
      
      // 清空表单
      if (activeTab === 'market') {
        setMarketCarbonAmount('')
        setMarketUsdtAmount('')
        setSwapEstimate(null)
      } else {
        setLimitAmount('')
        setLimitPrice('')
      }
      
      // 刷新订单簿（如果是限价单成功）
      if (activeTab === 'limit') {
        // 延迟刷新，让交易先完成
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshOrderBook'))
        }, 3000)
      }
    }
  }, [isConfirmed, isLiquidityPoolConnected, activeTab, orderType, t])

  // 处理市价单交易
  const handleMarketOrder = async () => {
    if (orderType === 'buy') {
      // 买入时验证USDT数量
      if (!marketUsdtAmount || isNaN(Number(marketUsdtAmount)) || Number(marketUsdtAmount) <= 0) {
        toast.error(t('carbon.errors.invalidAmount'))
        return
      }
      
      // 检查价格偏离 - 如果兑换后价格偏离超过阈值，阻止交易
      if (usdtToCarbonPriceImpact?.isDeviated === true) {
        const threshold = poolData.priceDeviationThreshold || 10
        toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${usdtToCarbonPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
        return
      }
    } else {
      // 卖出时验证碳币数量
      if (!marketCarbonAmount || isNaN(Number(marketCarbonAmount)) || Number(marketCarbonAmount) <= 0) {
        toast.error(t('carbon.errors.invalidAmount'))
        return
      }
      
      // 检查价格偏离 - 如果兑换后价格偏离超过阈值，阻止交易
      if (carbonToUsdtPriceImpact?.isDeviated === true) {
        const threshold = poolData.priceDeviationThreshold || 10
        toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${carbonToUsdtPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
        return
      }
    }

    try {
      if (orderType === 'buy') {
        // 市价买入碳币 - 使用USDT数量（USDT换碳币）
        if (Number(marketUsdtAmount) > Number(usdtBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }

        // 检查USDT授权（对流动性池）
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
      } else {
        // 市价卖出碳币 - 使用碳币数量（碳币换USDT）
        if (Number(marketCarbonAmount) > Number(carbonBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }

        // 检查碳币授权（对流动性池）
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
   * 处理限价单交易 - 使用新的CarbonUSDTMarket合约
   * @description 支持自动撮合功能，创建订单时自动匹配现有订单
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
        // 限价买单 - 需要USDT + 挂单费
        // 注意：要与合约计算保持一致，合约中 totalUSDT = amount(wei) * price(基础精度wei)
        // 所以我们计算: amount * price (都是常规数值)
        const totalUsdt = Number(limitAmount) * Number(limitPrice)
        const feeRate = feeRates ? Number(feeRates.limitOrderFee.toString()) : 50 // 默认0.5%
        const orderFee = (totalUsdt * feeRate) / 10000
        const totalRequired = totalUsdt + orderFee
        
        // 检查总余额（包含挂单费）
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
        
        // 检查USDT授权 - 使用稍微大一点的值确保授权足够
        const approvalAmount = (totalRequired * 1.01).toString() // 增加1%的缓冲
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
        
      } else {
        // 限价卖单 - 需要碳币 + USDT（挂单费）
        if (Number(limitAmount) > Number(carbonBalance)) {
          toast.error(t('carbon.balances.insufficientBalance'))
          return
        }
        
        // 计算挂单费
        const totalUsdt = Number(limitAmount) * Number(limitPrice)
        const feeRate = feeRates ? Number(feeRates.limitOrderFee.toString()) : 50 // 默认0.5%
        const orderFee = (totalUsdt * feeRate) / 10000
        
        // 检查USDT余额是否足够支付挂单费
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
        
        // 检查碳币授权
        const needsCarbonApproval = carbonApproval.checkApprovalNeeded(limitAmount, 18)
        if (needsCarbonApproval) {
          setIsApprovingCarbon(true)
          await carbonApproval.approveMax()
          setIsApprovingCarbon(false)
          toast.success(t('carbon.approval.approvalSuccess'))
          return
        }
        
        // 检查USDT授权（用于支付挂单费）
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
      }
      
      setLimitAmount('')
      setLimitPrice('')
      
    } catch (error) {
      console.error('Limit order error:', error)
      toast.error('创建限价单失败，请重试')
    }
  }

  // 如果合约地址无效，显示错误信息
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
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{t('carbon.carbonMarket')}</h1>
          <p className="text-gray-600">去中心化碳信用交易平台</p>
        </div>

        {/* 用户余额信息 */}
        {isConnected && (
          <div className="bg-white/90 rounded-2xl shadow-xl p-6 mb-6 border border-white/20 relative">
            {/* 价格偏离状态指示器 - 右上角 */}
            <div className="absolute top-4 right-4 flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-3 py-2 border border-gray-200 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${
                Math.abs(Number(currentPrice) - Number(referencePrice)) / Number(referencePrice) * 100 > (poolData.priceDeviationThreshold || 10)
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-green-500'
              }`}></div>
              <span className="text-xs font-medium text-gray-700">偏离度</span>
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
              交易信息
            </h2>
            {/* 余额和价格信息一行显示 - 五个格子 */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-green-600 text-xs font-medium mb-2">碳币余额</div>
                  <div className="text-green-800 font-bold text-lg mb-1">
                    {parseFloat(carbonBalance).toFixed(2)}
                  </div>
                  <div className="text-green-500 text-xs">CARB</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-blue-600 text-xs font-medium mb-2">USDT余额</div>
                  <div className="text-blue-800 font-bold text-lg mb-1">
                    {parseFloat(usdtBalance).toFixed(2)}
                  </div>
                  <div className="text-blue-500 text-xs">USDT</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-purple-600 text-xs font-medium mb-2 flex items-center justify-center gap-1">
                    <span>🔮</span>
                    阈值
                  </div>
                  <div className="text-purple-800 font-bold text-lg mb-1">
                    {poolData.priceDeviationThreshold || 10}%
                  </div>
                  <div className="text-purple-500 text-xs">偏离限制</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-orange-600 text-xs font-medium mb-2">当前市价</div>
                  <div className="text-orange-800 font-bold text-lg mb-1">
                    {Number(currentPrice) > 0 ? currentPrice : testPrice}
                  </div>
                  <div className="text-orange-500 text-xs">USDT</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="text-center">
                  <div className="text-indigo-600 text-xs font-medium mb-2">参考价</div>
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
          {/* 左侧：交易表单 */}
          <div className="xl:col-span-1 space-y-6">
            {/* 交易类型切换 */}
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

              {/* 买卖类型切换 */}
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

              {/* 交易表单 */}
              <div className="p-6">
                {activeTab === 'market' ? (
                  // 市价单表单 - 双输入框
                  <div className="space-y-6">
                    {/* 交易方向指示器 */}
                    <div className="flex items-center justify-center space-x-4">
                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                        orderType === 'buy' 
                          ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}>
                        <span className="text-lg">📈</span>
                        <span className="font-medium">买入碳币</span>
                      </div>
                      <div className="text-gray-400 text-xl">⇄</div>
                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                        orderType === 'sell' 
                          ? 'bg-red-100 text-red-800 border-2 border-red-300' 
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                      }`}>
                        <span className="text-lg">📉</span>
                        <span className="font-medium">卖出碳币</span>
                      </div>
                    </div>

                    {/* 碳币数量输入框 */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                      <label className="block text-sm font-semibold text-green-800 mb-3">
                        💚 碳币数量
                      </label>
                      <input
                        type="number"
                        value={marketCarbonAmount}
                        onChange={(e) => handleCarbonAmountChange(e.target.value)}
                        placeholder="输入碳币数量"
                        className="w-full px-4 py-3 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                        step="0.000001"
                        min="0"
                        disabled={isCalculating}
                      />
                      <div className="text-sm text-green-600 mt-2 flex justify-between">
                        <span>可用: {carbonBalance}</span>
                        <span className="font-medium">CARB</span>
                      </div>
                    </div>

                    {/* 换算箭头 */}
                    <div className="flex justify-center">
                      <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                    </div>

                    {/* USDT数量输入框 */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                      <label className="block text-sm font-semibold text-blue-800 mb-3">
                        💙 USDT数量
                      </label>
                      <input
                        type="number"
                        value={marketUsdtAmount}
                        onChange={(e) => handleUsdtAmountChange(e.target.value)}
                        placeholder="输入USDT数量"
                        className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                        step="0.000001"
                        min="0"
                        disabled={isCalculating}
                      />
                      <div className="text-sm text-blue-600 mt-2 flex justify-between">
                        <span>可用: {usdtBalance}</span>
                        <span className="font-medium">USDT</span>
                      </div>
                    </div>

                    {/* 价格和手续费信息卡片 */}
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                        <span className="mr-2">📊</span>
                        交易详情
                      </h4>
                      
                      {/* 当前价格 */}
                      <div className="flex justify-between items-center mb-3 p-2 bg-white/60 rounded-lg">
                        <span className="text-sm text-purple-700">当前市价</span>
                        <span className="font-bold text-purple-900">
                          {Number(currentPrice) > 0 ? currentPrice : testPrice} USDT
                        </span>
                      </div>

                      {/* 参考价格 */}
                      <div className="flex justify-between items-center mb-3 p-2 bg-white/60 rounded-lg">
                        <span className="text-sm text-purple-700">🔮 参考价格</span>
                        <span className="font-bold text-purple-900">
                          {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                        </span>
                      </div>

                      {/* 手续费信息 */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">手续费</span>
                          <span className="font-medium text-purple-900">
                            {swapEstimate ? parseFloat(swapEstimate.fee).toFixed(6) : '0.000000'} {orderType === 'buy' ? 'CARB' : 'USDT'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">价格影响</span>
                          <span className="font-medium text-purple-900">
                            {swapEstimate ? parseFloat(swapEstimate.priceImpact).toFixed(4) : '0.0000'}%
                          </span>
                        </div>
                        
                        {/* 新增：兑换后价格和偏差显示 */}
                        {orderType === 'buy' && usdtToCarbonPriceImpact && (
                          <>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">💹 兑换后价格</span>
                              <span className="font-semibold text-purple-900">
                                {usdtToCarbonPriceImpact.newPrice} USDT
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">🔮 与参考价偏差</span>
                              <span className={`font-semibold ${usdtToCarbonPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                                {usdtToCarbonPriceImpact.deviation}%
                              </span>
                            </div>
                          </>
                        )}
                        
                        {orderType === 'sell' && carbonToUsdtPriceImpact && (
                          <>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">💹 兑换后价格</span>
                              <span className="font-semibold text-purple-900">
                                {carbonToUsdtPriceImpact.newPrice} USDT
                              </span>
                            </div>
                            <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                              <span className="text-sm text-purple-700">🔮 与参考价偏差</span>
                              <span className={`font-semibold ${carbonToUsdtPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                                {carbonToUsdtPriceImpact.deviation}%
                              </span>
                            </div>
                          </>
                        )}
                        
                        <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                          <span className="text-sm text-purple-700">
                            {orderType === 'buy' ? '付出USDT' : '付出碳币'}
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
                            {orderType === 'buy' ? '获得碳币' : '获得USDT'}
                          </span>
                          <span className="font-medium text-purple-900">
                            {orderType === 'buy' 
                              ? `${marketCarbonAmount || '0.000000'} CARB`
                              : `${marketUsdtAmount || '0.000000'} USDT`
                            }
                          </span>
                        </div>
                      </div>

                      {/* 计算状态 */}
                      {(isCalculating || isEstimating) && (
                        <div className="flex items-center justify-center mt-3 p-2 bg-blue-100 rounded-lg">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          <span className="text-sm text-blue-700">
                            {isCalculating ? '正在换算...' : '正在计算手续费...'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 交易按钮 */}
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
                          交易中...
                        </div>
                      ) : isApprovingCarbon ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          授权碳币中...
                        </div>
                      ) : isApprovingUsdt ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          授权USDT中...
                        </div>
                      ) : isCalculating || isEstimating ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          计算中...
                        </div>
                      ) : (orderType === 'buy' && usdtToCarbonPriceImpact?.isDeviated === true) ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">⚠️</span>
                          价格偏离过大 ({usdtToCarbonPriceImpact.deviation}%)
                        </div>
                      ) : (orderType === 'sell' && carbonToUsdtPriceImpact?.isDeviated === true) ? (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">⚠️</span>
                          价格偏离过大 ({carbonToUsdtPriceImpact.deviation}%)
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="mr-2">{orderType === 'buy' ? '📈' : '📉'}</span>
                          {orderType === 'buy' ? '市价买入' : '市价卖出'}
                        </div>
                      )}
                    </button>
                  </div>
                ) : (
                  // 限价单表单
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
                        可用碳币: {carbonBalance}
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
                          // 自动去除小数部分，只保留整数
                          const value = e.target.value;
                          if (value.includes('.')) {
                            const integerValue = value.split('.')[0];
                            setLimitPrice(integerValue);
                            // 显示提醒
                            toast.success(`价格已自动调整为整数: ${integerValue} USDT`, { duration: 2000 });
                          } else {
                            setLimitPrice(value);
                          }
                        }}
                        onBlur={(e) => {
                          // 失焦时也确保是整数
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
                        参考价格: {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                      </div>
                      
                    </div>

                    {/* 订单详情卡片 - 修改显示条件，使其一直显示 */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                          <span className="mr-2">📊</span>
                          订单详情
                        </h4>
                        {/* 订单详情内容 */}
                        <div className="space-y-2">
                          {/* 订单类型 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">订单类型</span>
                            <span className="font-medium text-blue-900">
                              {orderType === 'buy' ? '📈 限价买单' : '📉 限价卖单'}
                            </span>
                          </div>
                          {/* 代币数量 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">代币数量</span>
                            <span className="font-medium text-blue-900">
                              {limitAmount || '0.000000'} CARB
                            </span>
                          </div>
                          {/* 限价 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">限价</span>
                            <span className="font-medium text-blue-900">
                              {limitPrice || '0.00'} USDT
                            </span>
                          </div>
                          {/* 价格调整提醒 */}
                          {limitPrice && limitPrice.includes('.') && (
                            <div className="flex justify-between items-center p-2 bg-orange-100 rounded-lg border border-orange-300">
                              <span className="text-sm text-orange-700">⚠️ 价格调整提醒</span>
                              <span className="text-xs text-orange-600 font-medium">
                                小数部分将被自动去除
                              </span>
                            </div>
                          )}
                          {/* 当前市价 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">当前市价</span>
                            <span className="font-medium text-blue-900">
                              {Number(currentPrice) > 0 ? currentPrice : testPrice} USDT
                            </span>
                          </div>
                          {/* 预言机参考价格 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">🔮 参考价格</span>
                            <span className="font-medium text-blue-900">
                              {Number(referencePrice) > 0 ? referencePrice : testPrice} USDT
                            </span>
                          </div>
                          {/* 价格差异（相对于参考价格） */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">价格差异</span>
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
                          {/* 交易金额 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">交易金额</span>
                            <span className="font-medium text-blue-900">
                              {(Number(limitAmount || 0) * Number(limitPrice || 0)).toFixed(2)} USDT
                            </span>
                          </div>
                          {/* 挂单费 */}
                          <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                            <span className="text-sm text-blue-700">
                              挂单费 ({feeRates ? Number(feeRates.limitOrderFee) / 100 : 0.5}%)
                            </span>
                            <span className="font-medium text-blue-900">
                              {((Number(limitAmount || 0) * Number(limitPrice || 0) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toFixed(4)} USDT
                            </span>
                          </div>
                          {/* 总计 */}
                          <div className="flex justify-between items-center p-2 bg-blue-100 rounded-lg border border-blue-300">
                            <span className="text-sm font-semibold text-blue-800">总计</span>
                            <span className="font-bold text-blue-900">
                              {(Number(limitAmount || 0) * Number(limitPrice || 0) * (1 + (feeRates ? Number(feeRates.limitOrderFee) : 50) / 10000)).toFixed(4)} USDT
                            </span>
                          </div>
                          {/* 订单状态 */}
                          <div className="flex justify-between items-center p-2 bg-blue-100 rounded-lg border border-blue-300">
                            <span className="text-sm font-semibold text-blue-800">订单状态</span>
                            <span className="font-bold text-blue-900">
                              {limitAmount && limitPrice ? '🟡 待创建' : '⚪ 未填写'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 授权状态卡片 */}
                      {!!limitAmount && !!limitPrice && (
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                          <h4 className="font-semibold text-yellow-800 mb-3 flex items-center">
                            <span className="mr-2">🔐</span>
                            授权状态
                          </h4>
                          <div className="space-y-3">
                            {/* 买单授权状态 */}
                            {orderType === 'buy' && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">USDT授权状态</span>
                                  <span className={`font-medium ${
                                    usdtApproval.checkApprovalNeeded(
                                      (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                                      18
                                    ) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {usdtApproval.checkApprovalNeeded(
                                      (Number(limitAmount) * Number(limitPrice) * 1.01).toString(), 
                                      18
                                    ) ? '❌ 需要授权' : '✅ 已授权'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">USDT余额</span>
                                  <span className="font-medium text-yellow-900">
                                    {userBalances.usdtBalance} USDT
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">需要USDT</span>
                                  <span className="font-medium text-yellow-900">
                                    {(Number(limitAmount) * Number(limitPrice) * (1 + (feeRates ? Number(feeRates.limitOrderFee) : 50) / 10000)).toFixed(4)} USDT
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* 卖单授权状态 */}
                            {orderType === 'sell' && (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">碳币授权状态</span>
                                  <span className={`font-medium ${
                                    carbonApproval.checkApprovalNeeded(limitAmount, 18) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {carbonApproval.checkApprovalNeeded(limitAmount, 18) ? '❌ 需要授权' : '✅ 已授权'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">碳币余额</span>
                                  <span className="font-medium text-yellow-900">
                                    {carbonBalance} CARB
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">需要碳币</span>
                                  <span className="font-medium text-yellow-900">
                                    {limitAmount} CARB
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">USDT授权状态（挂单费）</span>
                                  <span className={`font-medium ${
                                    usdtApproval.checkApprovalNeeded(
                                      ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                      18
                                    ) ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {usdtApproval.checkApprovalNeeded(
                                      ((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toString(), 
                                      18
                                    ) ? '❌ 需要授权' : '✅ 已授权'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">USDT余额</span>
                                  <span className="font-medium text-yellow-900">
                                    {userBalances.usdtBalance} USDT
                                  </span>
                                </div>
                                <div className="flex justify-between items-center p-2 bg-white/60 rounded-lg">
                                  <span className="text-sm text-yellow-700">需要USDT（挂单费）</span>
                                  <span className="font-medium text-yellow-900">
                                    {((Number(limitAmount) * Number(limitPrice) * (feeRates ? Number(feeRates.limitOrderFee) : 50)) / 10000).toFixed(4)} USDT
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 授权按钮 */}
                      {!!limitAmount && !!limitPrice && (
                        <div className="space-y-2">
                          {/* 买单授权按钮 */}
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
                                  授权USDT中...
                                </div>
                              ) : (
                                '🔐 授权USDT'
                              )}
                            </button>
                          )}
                          
                          {/* 卖单授权按钮 */}
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
                                      授权碳币中...
                                    </div>
                                  ) : (
                                    '🔐 授权碳币'
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
                                      授权USDT中...
                                    </div>
                                  ) : (
                                    '🔐 授权USDT（挂单费）'
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
                      {isWritePending ? '创建中...' : 
                       isApprovingCarbon ? '授权碳币中...' :
                       isApprovingUsdt ? '授权USDT中...' :
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
                       )) ? '请先授权' :
                       orderType === 'buy' ? '创建买单' : '创建卖单'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：图表区域 */}
          <div className="xl:col-span-2 space-y-6">
            {/* AMM市价波动图表卡片 */}
            <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  AMM市价波动图表
                  <span className="text-sm text-gray-500 ml-2">24小时走势</span>
                </h2>
                
                {/* 数据源切换按钮 */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseRealData(false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      !useRealData
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🎲 模拟数据
                  </button>
                  <button
                    onClick={() => setUseRealData(true)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      useRealData
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🔗 真实数据
                  </button>
                </div>
              </div>
              
              {/* 价格统计信息 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                  <div className="text-center">
                    <div className="text-blue-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealData ? '🔗' : '🎲'}
                      当前价格
                    </div>
                    <div className="text-blue-800 font-bold text-lg">
                      {Number(currentPrice) > 0 ? currentPrice : testPrice}
                    </div>
                    <div className="text-blue-500 text-xs">USDT</div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                  <div className="text-center">
                    <div className="text-green-600 text-xs font-medium mb-1">24h最高</div>
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
                    <div className="text-red-600 text-xs font-medium mb-1">24h最低</div>
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
                    <div className="text-purple-600 text-xs font-medium mb-1">24h成交量</div>
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

              {/* 专业K线图表 */}
              <div className="h-96 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 border border-gray-700 relative overflow-hidden">
                {/* 图表标题栏 */}
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
                  {/* 网格线背景 */}
                  <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
                    {/* 水平网格线 */}
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
                    {/* 垂直网格线 */}
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

                  {/* Y轴价格标签 */}
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
                  
                  {/* K线图和成交量 */}
                  <div className="ml-16 h-full relative">
                    {/* 主K线图区域 */}
                    <div className="h-3/4 relative">
                      <svg className="w-full h-full" viewBox="0 0 800 300" style={{ zIndex: 2 }}>
                        {candlestickData.length > 0 && candlestickData.map((candle, index) => {
                          const maxPrice = Math.max(...candlestickData.map(c => c.high))
                          const minPrice = Math.min(...candlestickData.map(c => c.low))
                          const priceRange = maxPrice - minPrice || 1
                          
                          const x = (index / Math.max(candlestickData.length - 1, 1)) * 760 + 20
                          const candleWidth = Math.max(6, 760 / candlestickData.length * 0.8)
                          
                          // 计算Y坐标
                          const yHigh = 30 + ((maxPrice - candle.high) / priceRange) * 240
                          const yLow = 30 + ((maxPrice - candle.low) / priceRange) * 240
                          const yOpen = 30 + ((maxPrice - candle.open) / priceRange) * 240
                          const yClose = 30 + ((maxPrice - candle.close) / priceRange) * 240
                          
                          const isUp = candle.close >= candle.open
                          const bodyHeight = Math.abs(yClose - yOpen)
                          const bodyY = Math.min(yOpen, yClose)
                          
                          return (
                            <g key={index}>
                              {/* 上下影线 */}
                              <line
                                x1={x}
                                y1={yHigh}
                                x2={x}
                                y2={yLow}
                                stroke={isUp ? '#10b981' : '#ef4444'}
                                strokeWidth="1"
                              />
                              
                              {/* K线实体 */}
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
                        
                        {/* MA移动平均线 */}
                        {candlestickData.length > 5 && (
                          <>
                            {/* 5日移动平均线 */}
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
                            
                            {/* 20日移动平均线 */}
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
                    
                    {/* 成交量柱状图 */}
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
                  
                  {/* X轴时间标签 */}
                  <div className="absolute bottom-0 left-16 right-0 flex justify-between text-xs text-gray-400 px-2">
                    {candlestickData.length > 0 && [0, Math.floor(candlestickData.length / 4), Math.floor(candlestickData.length / 2), Math.floor(candlestickData.length * 3 / 4), candlestickData.length - 1].map(i => (
                      <span key={i}>
                        {candlestickData[i] ? new Date(candlestickData[i].timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit' }) : ''}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* 图例和数据源说明 */}
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
                        ? `区块链数据 (${candlestickData.length}根K线)` 
                        : '模拟数据'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 限价单分布图表卡片 */}
            <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  限价单订单分布
                  <span className="text-sm text-gray-500 ml-2">买卖盘深度</span>
                </h2>
                
                {/* 订单簿数据源切换按钮 */}
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setUseRealOrderBook(false)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      !useRealOrderBook
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🎲 模拟订单
                  </button>
                  <button
                    onClick={() => setUseRealOrderBook(true)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      useRealOrderBook
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🔗 真实订单
                  </button>
                </div>
              </div>
              
              {/* 订单统计信息 */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                  <div className="text-center">
                    <div className="text-green-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
                      {useRealOrderBook ? '🔗' : '🎲'}
                      平均买价
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
                      平均卖价
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
                      价格差价
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
                      市场均价
                    </div>
                    <div className="text-purple-800 font-bold text-lg">
                      {(() => {
                        const currentData = useRealOrderBook ? realOrderBookData : orderBookData
                        const allOrders = [...currentData.buyOrders, ...currentData.sellOrders]
                        if (allOrders.length === 0) return '0.00'
                        
                        // 计算加权平均价格（按数量加权）
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

              {/* 订单分布图 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 买单深度 */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <h3 className="text-green-800 font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">📈</span>
                    买单深度
                    <span className="text-xs text-green-600 ml-auto">
                      {useRealOrderBook ? '🔗 真实' : '🎲 模拟'}
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
                        {useRealOrderBook ? '暂无真实买单' : '暂无模拟买单'}
                      </div>
                    )}
                  </div>
                </div>

                {/* 卖单深度 */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
                  <h3 className="text-red-800 font-semibold mb-3 flex items-center gap-2">
                    <span className="text-lg">📉</span>
                    卖单深度
                    <span className="text-xs text-red-600 ml-auto">
                      {useRealOrderBook ? '🔗 真实' : '🎲 模拟'}
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
                        {useRealOrderBook ? '暂无真实卖单' : '暂无模拟卖单'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 市场流动性分布图（简化版） */}
              <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <h3 className="text-gray-800 font-semibold mb-3 text-center flex items-center justify-center gap-2">
                  市场流动性分布
                  <span className="text-xs text-gray-600">
                    ({useRealOrderBook ? '🔗 真实数据' : '🎲 模拟数据'})
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
                            {/* 买单资金扇形 */}
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
                            {/* 卖单资金扇形 */}
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
                  
                  {/* 图例 */}
                  <div className="ml-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        买单资金 ({(() => {
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
                        卖单资金 ({(() => {
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

      {/* 下侧：订单簿 */}
      <div>
        <OrderBook />
      </div>

      {/* 市场统计信息 */}
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
    </div>
  )
} 