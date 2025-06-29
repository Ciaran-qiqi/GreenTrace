import React, { useState, useEffect } from 'react'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { formatTokenAmount } from '@/utils/formatters'
import { useTranslation } from '@/hooks/useI18n'
import toast from 'react-hot-toast'

/**
 * Market exchange block components (two-way column optimization version)
 * Left: USDT for carbon coins, right: USDT for carbon coins, balance is displayed at the top
 */
export default function SwapPanel() {
  const { t } = useTranslation();
  
  // Input status

  const [carbonIn, setCarbonIn] = useState('') // Carbon coins for usdt input

  const [usdtIn, setUsdtIn] = useState('')    // USDT exchange carbon coins input
  // Estimated results

  const [carbonToUsdtEstimate, setCarbonToUsdtEstimate] = useState<null | { amountOut: string, fee: string, priceImpact: string }>(null)
  const [usdtToCarbonEstimate, setUsdtToCarbonEstimate] = useState<null | { amountOut: string, fee: string, priceImpact: string }>(null)
  // Authorization status

  const [isApprovingCarbon, setIsApprovingCarbon] = useState(false)
  const [isApprovingUsdt, setIsApprovingUsdt] = useState(false)

  // Get liquidity pool hook

  const {
    getSwapEstimate,
    swapCarbonToUsdt,
    swapUsdtToCarbon,
    isConnected,
    userBalances,
    carbonTokenAddress,
    usdtTokenAddress,
    liquidityPoolAddress,
    poolData, // Get pool data, including current price and reference price

  } = useGreenTalesLiquidityPool()

  // Authorized hook

  const approvalCarbon = useTokenApproval(carbonTokenAddress, liquidityPoolAddress)
  const approvalUsdt = useTokenApproval(usdtTokenAddress, liquidityPoolAddress)

  // Get real-time carbon coins for usdt estimates

  useEffect(() => {
    if (!carbonIn || isNaN(Number(carbonIn)) || Number(carbonIn) <= 0) {
      setCarbonToUsdtEstimate(null)
      return
    }
    getSwapEstimate(carbonIn, true).then(res => setCarbonToUsdtEstimate(res))
  }, [carbonIn, getSwapEstimate])

  // Get the estimate of usdt exchange carbon coins in real time

  useEffect(() => {
    if (!usdtIn || isNaN(Number(usdtIn)) || Number(usdtIn) <= 0) {
      setUsdtToCarbonEstimate(null)
      return
    }
    getSwapEstimate(usdtIn, false).then(res => setUsdtToCarbonEstimate(res))
  }, [usdtIn, getSwapEstimate])

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

  // Calculate the price impact of carbon coins for usdt

  const carbonToUsdtPriceImpact = calculatePriceImpact(carbonIn, true)

  // Calculate the price impact of usdt exchange carbon coins

  const usdtToCarbonPriceImpact = calculatePriceImpact(usdtIn, false)

  // Debugging: Display current threshold information

  useEffect(() => {
    console.log('🔍 价格偏离阈值调试信息:', {
      poolDataThreshold: poolData.priceDeviationThreshold,
      defaultThreshold: 10,
      finalThreshold: poolData.priceDeviationThreshold || 10,
      poolData: poolData
    })
  }, [poolData.priceDeviationThreshold, poolData])

  // Process carbon coins for usdt

  const handleCarbonToUsdt = async () => {
    if (!carbonIn || isNaN(Number(carbonIn)) || Number(carbonIn) <= 0) {
      toast.error(t('swap.errors.invalidCarbonAmount', '请输入有效碳币数量'))
      return
    }
    if (Number(carbonIn) > userBalances.carbonBalanceRaw) {
      toast.error(t('swap.errors.insufficientCarbon', '碳币余额不足'))
      return
    }
    
    // Check price deviation -If the price deviation exceeds the threshold after redemption, block transactions

    if (carbonToUsdtPriceImpact?.isDeviated === true) {
      const threshold = poolData.priceDeviationThreshold || 10
      toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${carbonToUsdtPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
      return
    }
    
    const needsApproval = approvalCarbon.checkApprovalNeeded(carbonIn, 18)
    if (needsApproval) {
      setIsApprovingCarbon(true)
      await approvalCarbon.approveMax()
      setIsApprovingCarbon(false)
      toast.success(t('swap.success.approvalSuccess', '授权成功，请再次点击兑换'))
      return
    }
    await swapCarbonToUsdt(carbonIn)
    setCarbonIn('')
    setCarbonToUsdtEstimate(null)
  }

  // Process usdt to exchange carbon coins

  const handleUsdtToCarbon = async () => {
    if (!usdtIn || isNaN(Number(usdtIn)) || Number(usdtIn) <= 0) {
      toast.error(t('swap.errors.invalidUsdtAmount', '请输入有效USDT数量'))
      return
    }
    if (Number(usdtIn) > userBalances.usdtBalanceRaw) {
      toast.error(t('swap.errors.insufficientUsdt', 'USDT余额不足'))
      return
    }
    
    // Check price deviation -If the price deviation exceeds the threshold after redemption, block transactions

    if (usdtToCarbonPriceImpact?.isDeviated === true) {
      const threshold = poolData.priceDeviationThreshold || 10
      toast.error(`⚠️ 价格偏离过大！兑换后价格将偏离参考价 ${usdtToCarbonPriceImpact.deviation}%，超过${threshold}%阈值。请减少兑换数量或等待价格稳定。`)
      return
    }
    
    const needsApproval = approvalUsdt.checkApprovalNeeded(usdtIn, 18)
    if (needsApproval) {
      setIsApprovingUsdt(true)
      await approvalUsdt.approveMax()
      setIsApprovingUsdt(false)
      toast.success(t('swap.success.approvalSuccess', '授权成功，请再次点击兑换'))
      return
    }
    await swapUsdtToCarbon(usdtIn)
    setUsdtIn('')
    setUsdtToCarbonEstimate(null)
  }

  return (
    <div className="bg-white/80 rounded-2xl shadow-xl p-6 border border-white/20 mb-8">
      {/* Title and balance */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🔄</span>
        <h3 className="text-xl font-semibold text-gray-900">{t('swap.title', '市价兑换')}</h3>
        <div className="ml-auto flex gap-4">
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">{t('swap.carbonBalance', '碳币余额')}: {userBalances.carbonBalance}</div>
          <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{t('swap.usdtBalance', 'USDT余额')}: {userBalances.usdtBalance}</div>
          <div className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">阈值: {poolData.priceDeviationThreshold || 10}%</div>
        </div>
      </div>
      {/* Main column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: Carbon coins for usdt */}
        <div className="p-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200 shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌱</span>
            <span className="font-semibold text-green-700">{t('swap.carbonToUsdt.title', '碳币换USDT')}</span>
          </div>
          <input
            type="number"
            value={carbonIn}
            onChange={e => setCarbonIn(e.target.value)}
            placeholder={t('swap.carbonToUsdt.placeholder', '输入碳币数量')}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold text-black outline-none"
          />
          {/* Estimated results -Always show */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t('swap.estimate.receiveUsdt', '可获得USDT')}:</span>
              <span className="font-semibold text-green-600">
                {carbonToUsdtEstimate ? formatTokenAmount(carbonToUsdtEstimate.amountOut) : '0'} USDT
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('swap.estimate.fee', '手续费')}:</span>
              <span className="font-semibold text-orange-600">
                {carbonToUsdtEstimate ? formatTokenAmount(carbonToUsdtEstimate.fee) : '0'} USDT
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('swap.estimate.priceImpact', '价格影响')}:</span>
              <span className="font-semibold text-blue-600">
                {carbonToUsdtEstimate ? carbonToUsdtEstimate.priceImpact : '0'} bp
              </span>
            </div>
            
            {/* New: Price and deviation display after redemption */}
            {carbonToUsdtPriceImpact && (
              <>
                <div className="flex justify-between">
                  <span>💹 兑换后价格:</span>
                  <span className="font-semibold text-purple-600">
                    {carbonToUsdtPriceImpact.newPrice} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🔮 与参考价偏差:</span>
                  <span className={`font-semibold ${carbonToUsdtPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                    {carbonToUsdtPriceImpact.deviation}%
                  </span>
                </div>
              </>
            )}
            
            <div className="text-xs text-gray-500 mt-2 p-2 bg-blue-100 rounded">
              💡 <strong>{t('swap.estimate.priceImpactExplanation', '价格影响说明：bp（基点）= 0.01%，数值越小对池子价格影响越小')}</strong>
            </div>
            {!carbonToUsdtEstimate && carbonIn && (
              <div className="text-xs text-gray-500 mt-2">
                ⏳ {t('swap.estimate.calculating', '正在计算预估数据...')}
              </div>
            )}
          </div>
          <button
            onClick={handleCarbonToUsdt}
            disabled={
              !isConnected ||
              !carbonIn ||
              isApprovingCarbon ||
              Number(carbonIn) > userBalances.carbonBalanceRaw ||
              (carbonToUsdtPriceImpact?.isDeviated === true)
            }
            className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {!isConnected
              ? `🔗 ${t('common.connectWallet', '请连接钱包')}`
              : isApprovingCarbon
                ? `🔑 ${t('swap.button.approving', '正在授权...')}`
                : !carbonIn
                  ? `📝 ${t('swap.carbonToUsdt.enterAmount', '请输入碳币数量')}`
                  : Number(carbonIn) > userBalances.carbonBalanceRaw
                    ? `💰 ${t('swap.errors.insufficientCarbon', '碳币余额不足')}`
                    : (carbonToUsdtPriceImpact?.isDeviated === true)
                      ? `⚠️ 价格偏离过大 (${carbonToUsdtPriceImpact.deviation}%)`
                      : approvalCarbon.checkApprovalNeeded(carbonIn, 18)
                        ? `🔑 ${t('swap.button.approve', '先授权')}`
                        : t('swap.carbonToUsdt.swap', '兑换为USDT')
            }
          </button>
        </div>
        {/* Right column: usdt exchange carbon coins */}
        <div className="p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border border-blue-200 shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💵</span>
            <span className="font-semibold text-blue-700">{t('swap.usdtToCarbon.title', 'USDT换碳币')}</span>
          </div>
          <input
            type="number"
            value={usdtIn}
            onChange={e => setUsdtIn(e.target.value)}
            placeholder={t('swap.usdtToCarbon.placeholder', '输入USDT数量')}
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold text-black outline-none"
          />
          {/* Estimated results -Always show */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t('swap.estimate.receiveCarbon', '可获得碳币')}:</span>
              <span className="font-semibold text-blue-600">
                {usdtToCarbonEstimate ? formatTokenAmount(usdtToCarbonEstimate.amountOut) : '0'} CARB
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('swap.estimate.fee', '手续费')}:</span>
              <span className="font-semibold text-orange-600">
                {usdtToCarbonEstimate ? formatTokenAmount(usdtToCarbonEstimate.fee) : '0'} CARB
              </span>
            </div>
            <div className="flex justify-between">
              <span>{t('swap.estimate.priceImpact', '价格影响')}:</span>
              <span className="font-semibold text-green-600">
                {usdtToCarbonEstimate ? usdtToCarbonEstimate.priceImpact : '0'} bp
              </span>
            </div>
            
            {/* New: Price and deviation display after redemption */}
            {usdtToCarbonPriceImpact && (
              <>
                <div className="flex justify-between">
                  <span>💹 兑换后价格:</span>
                  <span className="font-semibold text-purple-600">
                    {usdtToCarbonPriceImpact.newPrice} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>🔮 与参考价偏差:</span>
                  <span className={`font-semibold ${usdtToCarbonPriceImpact.isDeviated ? 'text-red-600' : 'text-green-600'}`}>
                    {usdtToCarbonPriceImpact.deviation}%
                  </span>
                </div>
              </>
            )}
            
            <div className="text-xs text-gray-500 mt-2 p-2 bg-green-100 rounded">
              💡 <strong>{t('swap.estimate.priceImpactExplanation', '价格影响说明：bp（基点）= 0.01%，数值越小对池子价格影响越小')}</strong>
            </div>
            {!usdtToCarbonEstimate && usdtIn && (
              <div className="text-xs text-gray-500 mt-2">
                ⏳ {t('swap.estimate.calculating', '正在计算预估数据...')}
              </div>
            )}
          </div>
          <button
            onClick={handleUsdtToCarbon}
            disabled={
              !isConnected ||
              !usdtIn ||
              isApprovingUsdt ||
              Number(usdtIn) > userBalances.usdtBalanceRaw ||
              (usdtToCarbonPriceImpact?.isDeviated === true)
            }
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {!isConnected
              ? `🔗 ${t('common.connectWallet', '请连接钱包')}`
              : isApprovingUsdt
                ? `🔑 ${t('swap.button.approving', '正在授权...')}`
                : !usdtIn
                  ? `📝 ${t('swap.usdtToCarbon.enterAmount', '请输入USDT数量')}`
                  : Number(usdtIn) > userBalances.usdtBalanceRaw
                    ? `💰 ${t('swap.errors.insufficientUsdt', 'USDT余额不足')}`
                    : (usdtToCarbonPriceImpact?.isDeviated === true)
                      ? `⚠️ 价格偏离过大 (${usdtToCarbonPriceImpact.deviation}%)`
                      : approvalUsdt.checkApprovalNeeded(usdtIn, 18)
                        ? `🔑 ${t('swap.button.approve', '先授权')}`
                        : t('swap.usdtToCarbon.swap', '兑换为碳币')
            }
          </button>
        </div>
      </div>
    </div>
  )
} 