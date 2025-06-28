import React, { useState, useEffect } from 'react'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { formatTokenAmount } from '@/utils/formatters'
import { useTranslation } from '@/hooks/useI18n'
import toast from 'react-hot-toast'

/**
 * 市价兑换区块组件（双向分栏优化版）
 * 左侧：碳币换USDT，右侧：USDT换碳币，顶部显示余额
 */
export default function SwapPanel() {
  const { t } = useTranslation();
  
  // 输入状态
  const [carbonIn, setCarbonIn] = useState('') // 碳币换USDT输入
  const [usdtIn, setUsdtIn] = useState('')    // USDT换碳币输入
  // 预估结果
  const [carbonToUsdtEstimate, setCarbonToUsdtEstimate] = useState<null | { amountOut: string, fee: string, priceImpact: string }>(null)
  const [usdtToCarbonEstimate, setUsdtToCarbonEstimate] = useState<null | { amountOut: string, fee: string, priceImpact: string }>(null)
  // 授权状态
  const [isApprovingCarbon, setIsApprovingCarbon] = useState(false)
  const [isApprovingUsdt, setIsApprovingUsdt] = useState(false)

  // 获取流动性池hook
  const {
    getSwapEstimate,
    swapCarbonToUsdt,
    swapUsdtToCarbon,
    isConnected,
    userBalances,
    carbonTokenAddress,
    usdtTokenAddress,
    liquidityPoolAddress,
    poolData, // 获取池子数据，包含当前价格和参考价格
  } = useGreenTalesLiquidityPool()

  // 授权hook
  const approvalCarbon = useTokenApproval(carbonTokenAddress, liquidityPoolAddress)
  const approvalUsdt = useTokenApproval(usdtTokenAddress, liquidityPoolAddress)

  // 实时获取碳币换USDT预估
  useEffect(() => {
    if (!carbonIn || isNaN(Number(carbonIn)) || Number(carbonIn) <= 0) {
      setCarbonToUsdtEstimate(null)
      return
    }
    getSwapEstimate(carbonIn, true).then(res => setCarbonToUsdtEstimate(res))
  }, [carbonIn, getSwapEstimate])

  // 实时获取USDT换碳币预估
  useEffect(() => {
    if (!usdtIn || isNaN(Number(usdtIn)) || Number(usdtIn) <= 0) {
      setUsdtToCarbonEstimate(null)
      return
    }
    getSwapEstimate(usdtIn, false).then(res => setUsdtToCarbonEstimate(res))
  }, [usdtIn, getSwapEstimate])

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

  // 计算碳币换USDT的价格影响
  const carbonToUsdtPriceImpact = calculatePriceImpact(carbonIn, true)

  // 计算USDT换碳币的价格影响
  const usdtToCarbonPriceImpact = calculatePriceImpact(usdtIn, false)

  // 调试：显示当前阈值信息
  useEffect(() => {
    console.log('🔍 价格偏离阈值调试信息:', {
      poolDataThreshold: poolData.priceDeviationThreshold,
      defaultThreshold: 10,
      finalThreshold: poolData.priceDeviationThreshold || 10,
      poolData: poolData
    })
  }, [poolData.priceDeviationThreshold, poolData])

  // 处理碳币换USDT
  const handleCarbonToUsdt = async () => {
    if (!carbonIn || isNaN(Number(carbonIn)) || Number(carbonIn) <= 0) {
      toast.error(t('swap.errors.invalidCarbonAmount', '请输入有效碳币数量'))
      return
    }
    if (Number(carbonIn) > userBalances.carbonBalanceRaw) {
      toast.error(t('swap.errors.insufficientCarbon', '碳币余额不足'))
      return
    }
    
    // 检查价格偏离 - 如果兑换后价格偏离超过阈值，阻止交易
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

  // 处理USDT换碳币
  const handleUsdtToCarbon = async () => {
    if (!usdtIn || isNaN(Number(usdtIn)) || Number(usdtIn) <= 0) {
      toast.error(t('swap.errors.invalidUsdtAmount', '请输入有效USDT数量'))
      return
    }
    if (Number(usdtIn) > userBalances.usdtBalanceRaw) {
      toast.error(t('swap.errors.insufficientUsdt', 'USDT余额不足'))
      return
    }
    
    // 检查价格偏离 - 如果兑换后价格偏离超过阈值，阻止交易
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
      {/* 标题和余额 */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🔄</span>
        <h3 className="text-xl font-semibold text-gray-900">{t('swap.title', '市价兑换')}</h3>
        <div className="ml-auto flex gap-4">
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">{t('swap.carbonBalance', '碳币余额')}: {userBalances.carbonBalance}</div>
          <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{t('swap.usdtBalance', 'USDT余额')}: {userBalances.usdtBalance}</div>
          <div className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">阈值: {poolData.priceDeviationThreshold || 10}%</div>
        </div>
      </div>
      {/* 主体分栏 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左栏：碳币换USDT */}
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
          {/* 预估结果 - 始终显示 */}
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
            
            {/* 新增：兑换后价格和偏差显示 */}
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
        {/* 右栏：USDT换碳币 */}
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
          {/* 预估结果 - 始终显示 */}
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
            
            {/* 新增：兑换后价格和偏差显示 */}
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