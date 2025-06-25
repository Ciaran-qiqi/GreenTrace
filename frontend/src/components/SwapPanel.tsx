import React, { useState, useEffect } from 'react'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { formatTokenAmount } from '@/utils/formatters'
import toast from 'react-hot-toast'

/**
 * 市价兑换区块组件（双向分栏优化版）
 * 左侧：碳币换USDT，右侧：USDT换碳币，顶部显示余额
 */
export default function SwapPanel() {
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
  } = useGreenTalesLiquidityPool()

  // 授权hook
  const approvalCarbon = useTokenApproval({
    tokenAddress: carbonTokenAddress,
    spenderAddress: liquidityPoolAddress,
  })
  const approvalUsdt = useTokenApproval({
    tokenAddress: usdtTokenAddress,
    spenderAddress: liquidityPoolAddress,
  })

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

  // 处理碳币换USDT
  const handleCarbonToUsdt = async () => {
    if (!carbonIn || isNaN(Number(carbonIn)) || Number(carbonIn) <= 0) {
      toast.error('请输入有效碳币数量')
      return
    }
    if (Number(carbonIn) > userBalances.carbonBalanceRaw) {
      toast.error('碳币余额不足')
      return
    }
    const needsApproval = approvalCarbon.checkApprovalNeeded(carbonIn, 18)
    if (needsApproval) {
      setIsApprovingCarbon(true)
      await approvalCarbon.approveMax()
      setIsApprovingCarbon(false)
      toast.success('授权成功，请再次点击兑换')
      return
    }
    await swapCarbonToUsdt(carbonIn)
    setCarbonIn('')
    setCarbonToUsdtEstimate(null)
  }

  // 处理USDT换碳币
  const handleUsdtToCarbon = async () => {
    if (!usdtIn || isNaN(Number(usdtIn)) || Number(usdtIn) <= 0) {
      toast.error('请输入有效USDT数量')
      return
    }
    if (Number(usdtIn) > userBalances.usdtBalanceRaw) {
      toast.error('USDT余额不足')
      return
    }
    const needsApproval = approvalUsdt.checkApprovalNeeded(usdtIn, 18)
    if (needsApproval) {
      setIsApprovingUsdt(true)
      await approvalUsdt.approveMax()
      setIsApprovingUsdt(false)
      toast.success('授权成功，请再次点击兑换')
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
        <h3 className="text-xl font-semibold text-gray-900">市价兑换</h3>
        <div className="ml-auto flex gap-4">
          <div className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">碳币余额: {userBalances.carbonBalance}</div>
          <div className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">USDT余额: {userBalances.usdtBalance}</div>
        </div>
      </div>
      {/* 主体分栏 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左栏：碳币换USDT */}
        <div className="p-6 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200 shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🌱</span>
            <span className="font-semibold text-green-700">碳币换USDT</span>
          </div>
          <input
            type="number"
            value={carbonIn}
            onChange={e => setCarbonIn(e.target.value)}
            placeholder="输入碳币数量"
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold text-black outline-none"
          />
          {/* 预估结果 - 始终显示 */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span>可获得USDT:</span>
              <span className="font-semibold text-green-600">
                {carbonToUsdtEstimate ? formatTokenAmount(carbonToUsdtEstimate.amountOut) : '0'} USDT
              </span>
            </div>
            <div className="flex justify-between">
              <span>手续费:</span>
              <span className="font-semibold text-orange-600">
                {carbonToUsdtEstimate ? formatTokenAmount(carbonToUsdtEstimate.fee) : '0'} USDT
              </span>
            </div>
            <div className="flex justify-between">
              <span>价格影响:</span>
              <span className="font-semibold text-blue-600">
                {carbonToUsdtEstimate ? carbonToUsdtEstimate.priceImpact : '0'} bp
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2 p-2 bg-blue-100 rounded">
              💡 <strong>价格影响说明：</strong>bp（基点）= 0.01%，数值越小对池子价格影响越小
            </div>
            {!carbonToUsdtEstimate && carbonIn && (
              <div className="text-xs text-gray-500 mt-2">
                ⏳ 正在计算预估数据...
              </div>
            )}
          </div>
          <button
            onClick={handleCarbonToUsdt}
            disabled={
              !isConnected ||
              !carbonIn ||
              isApprovingCarbon ||
              Number(carbonIn) > userBalances.carbonBalanceRaw
            }
            className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {!isConnected
              ? '🔗 请连接钱包'
              : isApprovingCarbon
                ? '🔑 正在授权...'
                : !carbonIn
                  ? '📝 请输入碳币数量'
                  : Number(carbonIn) > userBalances.carbonBalanceRaw
                    ? '💰 碳币余额不足'
                    : approvalCarbon.checkApprovalNeeded(carbonIn, 18)
                      ? '🔑 先授权'
                      : '兑换为USDT'
            }
          </button>
        </div>
        {/* 右栏：USDT换碳币 */}
        <div className="p-6 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border border-blue-200 shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💵</span>
            <span className="font-semibold text-blue-700">USDT换碳币</span>
          </div>
          <input
            type="number"
            value={usdtIn}
            onChange={e => setUsdtIn(e.target.value)}
            placeholder="输入USDT数量"
            className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-lg font-semibold text-black outline-none"
          />
          {/* 预估结果 - 始终显示 */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm space-y-1">
            <div className="flex justify-between">
              <span>可获得碳币:</span>
              <span className="font-semibold text-blue-600">
                {usdtToCarbonEstimate ? formatTokenAmount(usdtToCarbonEstimate.amountOut) : '0'} CARB
              </span>
            </div>
            <div className="flex justify-between">
              <span>手续费:</span>
              <span className="font-semibold text-orange-600">
                {usdtToCarbonEstimate ? formatTokenAmount(usdtToCarbonEstimate.fee) : '0'} CARB
              </span>
            </div>
            <div className="flex justify-between">
              <span>价格影响:</span>
              <span className="font-semibold text-green-600">
                {usdtToCarbonEstimate ? usdtToCarbonEstimate.priceImpact : '0'} bp
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-2 p-2 bg-green-100 rounded">
              💡 <strong>价格影响说明：</strong>bp（基点）= 0.01%，数值越小对池子价格影响越小
            </div>
            {!usdtToCarbonEstimate && usdtIn && (
              <div className="text-xs text-gray-500 mt-2">
                ⏳ 正在计算预估数据...
              </div>
            )}
          </div>
          <button
            onClick={handleUsdtToCarbon}
            disabled={
              !isConnected ||
              !usdtIn ||
              isApprovingUsdt ||
              Number(usdtIn) > userBalances.usdtBalanceRaw
            }
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {!isConnected
              ? '🔗 请连接钱包'
              : isApprovingUsdt
                ? '🔑 正在授权...'
                : !usdtIn
                  ? '📝 请输入USDT数量'
                  : Number(usdtIn) > userBalances.usdtBalanceRaw
                    ? '💰 USDT余额不足'
                    : approvalUsdt.checkApprovalNeeded(usdtIn, 18)
                      ? '🔑 先授权'
                      : '兑换为碳币'
            }
          </button>
        </div>
      </div>
    </div>
  )
} 