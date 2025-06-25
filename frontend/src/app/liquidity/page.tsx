'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Navigation } from '@/components/Navigation'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { useTokenApproval } from '@/hooks/useTokenApproval'
import { formatTokenAmount, formatPercentage, validateNumberInput, debounce, formatPrice } from '@/utils/formatters'
import { parseUnits, formatUnits } from 'viem'
import toast from 'react-hot-toast'

import { readContract } from '@wagmi/core'
import { config } from '@/lib/wagmi'
import GreenTalesLiquidityPoolABI from '@/contracts/abi/GreenTalesLiquidityPool.json'
import SwapPanel from '@/components/SwapPanel'
import LiquidityEarningsPanel from '@/components/LiquidityEarningsPanel'
import LiquidityUserStatsPanel from '@/components/LiquidityUserStatsPanel'

export default function LiquidityPoolPage() {
  // 使用hooks
  const {
    poolData,
    userLiquidityInfo,
    userBalances,
    liquidityPoolAddress,
    carbonTokenAddress,
    usdtTokenAddress,
    addLiquidity,
    removeLiquidity,
    isLoading,
    isConnected,
  } = useGreenTalesLiquidityPool()

  // LP目标输入相关状态
  const [targetLPAmount, setTargetLPAmount] = useState('')
  const [carbonAmount, setCarbonAmount] = useState('')
  const [usdtAmount, setUsdtAmount] = useState('')
  const [removeAmount, setRemoveAmount] = useState('')

  // 授权hooks
  const {
    checkApprovalNeeded: checkCarbonApprovalNeeded,
    approveMax: approveCarbonMax,
    isApproving: isCarbonApproving,
  } = useTokenApproval({
    tokenAddress: carbonTokenAddress,
    spenderAddress: liquidityPoolAddress,
  })

  const {
    checkApprovalNeeded: checkUsdtApprovalNeeded,
    approveMax: approveUsdtMax,
    isApproving: isUsdtApproving,
  } = useTokenApproval({
    tokenAddress: usdtTokenAddress,
    spenderAddress: liquidityPoolAddress,
  })

  // LP目标计算函数（添加流动性用）
  const calculateTokensFromLP = useCallback(async (targetLP: string) => {
    if (!targetLP || !validateNumberInput(targetLP)) {
      setCarbonAmount('')
      setUsdtAmount('')
      return
    }

    try {
      const targetLPBigInt = parseUnits(targetLP, 18)
      
      // 获取池子状态
      const contractBalances = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getContractBalances',
      }) as [bigint, bigint]

      const totalLPSupply = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'totalLPTokens',
      }) as bigint

      if (totalLPSupply === BigInt(0)) {
        toast.error('池子为空，无法计算所需代币数量')
        return
      }

      const [totalCarbon, totalUsdt] = contractBalances
      
      // 计算需要的代币数量
      const carbonNeeded = (targetLPBigInt * totalCarbon) / totalLPSupply
      const usdtNeeded = (targetLPBigInt * totalUsdt) / totalLPSupply

      setCarbonAmount(formatUnits(carbonNeeded, 18))
      setUsdtAmount(formatUnits(usdtNeeded, 18))

    } catch (error) {
      console.error('计算LP目标失败:', error)
      toast.error('计算失败，请检查输入')
    }
  }, [liquidityPoolAddress])

  // LP移除计算函数（移除流动性用）
  const [removeCarbonAmount, setRemoveCarbonAmount] = useState('')
  const [removeUsdtAmount, setRemoveUsdtAmount] = useState('')

  const calculateTokensFromRemoveLP = useCallback(async (removeLP: string) => {
    if (!removeLP || !validateNumberInput(removeLP)) {
      setRemoveCarbonAmount('')
      setRemoveUsdtAmount('')
      return
    }

    try {
      const removeLPBigInt = parseUnits(removeLP, 18)
      
      // 获取池子状态
      const contractBalances = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getContractBalances',
      }) as [bigint, bigint]

      const totalLPSupply = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'totalLPTokens',
      }) as bigint

      if (totalLPSupply === BigInt(0)) {
        toast.error('池子为空，无法计算移除数量')
        return
      }

      const [totalCarbon, totalUsdt] = contractBalances
      
      // 计算可以移除的代币数量
      const carbonRemoved = (removeLPBigInt * totalCarbon) / totalLPSupply
      const usdtRemoved = (removeLPBigInt * totalUsdt) / totalLPSupply

      setRemoveCarbonAmount(formatUnits(carbonRemoved, 18))
      setRemoveUsdtAmount(formatUnits(usdtRemoved, 18))

    } catch (error) {
      console.error('计算移除LP失败:', error)
      toast.error('计算失败，请检查输入')
    }
  }, [liquidityPoolAddress])

  // 计算用户在池子中的代币数量
  const [userPoolTokens, setUserPoolTokens] = useState({
    carbonAmount: '0',
    usdtAmount: '0'
  })

  const calculateUserPoolTokens = useCallback(async () => {
    if (!userLiquidityInfo.lpTokens || parseFloat(userLiquidityInfo.lpTokens) === 0) {
      setUserPoolTokens({ carbonAmount: '0', usdtAmount: '0' })
      return
    }

    try {
      const userLPBigInt = parseUnits(userLiquidityInfo.lpTokens, 18)
      
      // 获取池子状态
      const contractBalances = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getContractBalances',
      }) as [bigint, bigint]

      const totalLPSupply = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'totalLPTokens',
      }) as bigint

      if (totalLPSupply === BigInt(0)) {
        setUserPoolTokens({ carbonAmount: '0', usdtAmount: '0' })
        return
      }

      const [totalCarbon, totalUsdt] = contractBalances
      
      // 计算用户拥有的代币数量
      const userCarbon = (userLPBigInt * totalCarbon) / totalLPSupply
      const userUsdt = (userLPBigInt * totalUsdt) / totalLPSupply

      setUserPoolTokens({
        carbonAmount: formatUnits(userCarbon, 18),
        usdtAmount: formatUnits(userUsdt, 18)
      })

    } catch (error) {
      console.error('计算用户池子代币失败:', error)
    }
  }, [liquidityPoolAddress, userLiquidityInfo.lpTokens])

  const debouncedCalculateFromLP = debounce(calculateTokensFromLP, 500)
  const debouncedCalculateFromRemoveLP = debounce(calculateTokensFromRemoveLP, 500)

  useEffect(() => {
    if (targetLPAmount) {
      debouncedCalculateFromLP(targetLPAmount)
    }
  }, [targetLPAmount, debouncedCalculateFromLP])

  useEffect(() => {
    if (removeAmount) {
      debouncedCalculateFromRemoveLP(removeAmount)
    }
  }, [removeAmount, debouncedCalculateFromRemoveLP])

  useEffect(() => {
    if (isConnected && userLiquidityInfo.lpTokens) {
      calculateUserPoolTokens()
    }
  }, [isConnected, userLiquidityInfo.lpTokens, calculateUserPoolTokens])

  // 处理添加流动性
  const handleAddLiquidity = async () => {
    if (!validateNumberInput(targetLPAmount)) {
      toast.error('请输入有效的LP代币数量')
      return
    }

    if (!carbonAmount || !usdtAmount) {
      toast.error('请先输入LP目标数量以计算所需代币')
      return
    }

    try {
      // 检查余额
      if (parseFloat(carbonAmount) > userBalances.carbonBalanceRaw) {
        toast.error('CARB余额不足')
        return
      }
      if (parseFloat(usdtAmount) > userBalances.usdtBalanceRaw) {
        toast.error('USDT余额不足')
        return
      }

      // 授权检查和流程
      const carbonNeedsApproval = checkCarbonApprovalNeeded(carbonAmount, 18)
      if (carbonNeedsApproval) {
        toast.loading('🔑 正在授权CARB代币...')
        await approveCarbonMax()
        toast.dismiss()
        toast.success('✅ CARB授权成功！请再次点击添加流动性')
        return
      }

      const usdtNeedsApproval = checkUsdtApprovalNeeded(usdtAmount, 18)
      if (usdtNeedsApproval) {
        toast.loading('🔑 正在授权USDT代币...')
        await approveUsdtMax()
        toast.dismiss()
        toast.success('✅ USDT授权成功！请再次点击添加流动性')
        return
      }

      // 执行添加流动性
      toast.loading('💧 正在添加流动性...')
      await addLiquidity(carbonAmount, usdtAmount)
      
      // 清空表单
      setTargetLPAmount('')
      setCarbonAmount('')
      setUsdtAmount('')
      
    } catch (error) {
      console.error('添加流动性失败:', error)
      toast.dismiss()
      toast.error('❌ 添加流动性失败: ' + (error as Error).message)
    }
  }

  // 处理移除流动性
  const handleRemoveLiquidity = async () => {
    if (!validateNumberInput(removeAmount)) {
      toast.error('请输入有效的数量')
      return
    }
    try {
      await removeLiquidity(removeAmount)
      setRemoveAmount('')
    } catch (error) {
      console.error('移除流动性失败:', error)
    }
  }

  // Tab切换相关状态
  const [tab, setTab] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50">
      <Navigation />
      
      <div className="py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">💧 碳币流动性池</h1>
            <p className="text-lg text-gray-600">提供流动性，获得交易手续费分成</p>
          </div>

          {/* 价格信息卡片：始终显示在最上方 */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">📊</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">价格信息</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">当前池子价格</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatPrice(poolData.currentPrice)} / CARB
                </p>
                <div className="mt-2 text-xs text-green-500">💹 AMM价格</div>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">预言机参考价</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {formatPrice(poolData.referencePrice)} / CARB
                </p>
                <div className="mt-2 text-xs text-blue-500">🔮 参考价格</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl border border-gray-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">价格偏离</p>
                <div className="flex items-center justify-center gap-2">
                  <p className={`text-2xl font-semibold ${
                    poolData.isDeviated ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatPercentage(poolData.priceDeviation)}
                  </p>
                  {poolData.isDeviated && (
                    <span className="text-red-600 text-xl animate-pulse">⚠️</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">📈 偏离度</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-100 rounded-xl border border-purple-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">总流动性</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {formatPrice(poolData.totalLiquidity)}
                </p>
                <div className="mt-2 text-xs text-purple-500">💰 TVL</div>
              </div>
            </div>
          </div>

          {/* Tab切换区块：三项 */}
          <div className="flex justify-center mb-8 gap-4">
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 0 ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}
              onClick={() => setTab(0)}
            >🔄市价兑换</button>
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 1 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
              onClick={() => setTab(1)}
            >💧流动性管理</button>
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 2 ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50'}`}
              onClick={() => setTab(2)}
            >💰做市收益</button>
          </div>

          {/* Tab内容区块 */}
          {tab === 0 && (
            <SwapPanel />
          )}
          {tab === 1 && (
            // 只渲染流动性管理相关内容
            <>
              {/* 主要功能区域 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
                {/* 流动性管理 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">💧</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">流动性管理</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LP目标添加流动性 */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">🎯 LP目标添加流动性</h4>
                      
                      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-lg">
                        <div className="space-y-4">
                          {/* LP目标输入 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">目标LP代币数量</label>
                            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-300">
                              <span className="text-lg">🎯</span>
                              <input
                                type="number"
                                value={targetLPAmount}
                                onChange={(e) => setTargetLPAmount(e.target.value)}
                                placeholder="0.0"
                                className="flex-1 bg-transparent outline-none text-lg font-semibold text-black"
                              />
                              <span className="text-gray-600 font-medium">LP</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              💡 输入想要获得的LP代币数量，系统按AMM池子价格自动计算需要的代币数量
                            </p>
                          </div>

                          {/* 显示计算结果 */}
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-semibold text-blue-900 mb-3">📋 计算结果</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">需要碳币:</span>
                                <span className="font-semibold text-green-600">
                                  {formatTokenAmount(carbonAmount || '0')} CARB
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">需要USDT:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatTokenAmount(usdtAmount || '0')} USDT
                                </span>
                              </div>
                              <div className="mt-3 pt-3 border-t border-blue-300">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">CARB余额:</span>
                                  <span className={`font-semibold ${carbonAmount && parseFloat(carbonAmount) > userBalances.carbonBalanceRaw ? 'text-red-600' : 'text-gray-800'}`}>
                                    {userBalances.carbonBalance}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">USDT余额:</span>
                                  <span className={`font-semibold ${usdtAmount && parseFloat(usdtAmount) > userBalances.usdtBalanceRaw ? 'text-red-600' : 'text-gray-800'}`}>
                                    {userBalances.usdtBalance}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 添加流动性按钮 */}
                          <button
                            onClick={handleAddLiquidity}
                            disabled={
                              !isConnected || 
                              !validateNumberInput(targetLPAmount) ||
                              !carbonAmount || !usdtAmount ||
                              isLoading || 
                              isCarbonApproving || 
                              isUsdtApproving ||
                              parseFloat(carbonAmount || '0') > userBalances.carbonBalanceRaw ||
                              parseFloat(usdtAmount || '0') > userBalances.usdtBalanceRaw
                            }
                            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            {!isConnected 
                              ? '🔗 请连接钱包' 
                              : !validateNumberInput(targetLPAmount)
                                ? '📝 请输入LP目标数量'
                              : !carbonAmount || !usdtAmount
                                ? '⏳ 计算中...'
                              : parseFloat(carbonAmount || '0') > userBalances.carbonBalanceRaw
                                ? '💰 CARB余额不足'
                              : parseFloat(usdtAmount || '0') > userBalances.usdtBalanceRaw
                                ? '💰 USDT余额不足'
                              : isCarbonApproving 
                                ? '🔑 正在授权CARB...' 
                                : isUsdtApproving 
                                  ? '🔑 正在授权USDT...' 
                                  : isLoading 
                                    ? '⏳ 处理中...' 
                                    : checkCarbonApprovalNeeded(carbonAmount, 18)
                                      ? '🔑 第1步：授权CARB代币'
                                      : checkUsdtApprovalNeeded(usdtAmount, 18)
                                        ? '🔑 第2步：授权USDT代币'
                                        : '💧 添加流动性'
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 移除流动性 */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">➖ 移除流动性</h4>
                      
                      <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 shadow-lg">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">LP代币数量</label>
                            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-300">
                              <span className="text-lg">🏆</span>
                              <input
                                type="number"
                                value={removeAmount}
                                onChange={(e) => setRemoveAmount(e.target.value)}
                                placeholder="0.0"
                                className="flex-1 bg-transparent outline-none text-lg font-semibold text-black"
                              />
                              <span className="text-gray-600 font-medium">LP</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              可用: {formatTokenAmount(userLiquidityInfo.lpTokens)} LP
                            </p>
                          </div>

                          {/* 显示移除计算结果 */}
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <h5 className="font-semibold text-orange-900 mb-3">📋 移除预览</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">可取回碳币:</span>
                                <span className="font-semibold text-green-600">
                                  {formatTokenAmount(removeCarbonAmount || '0')} CARB
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">可取回USDT:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatTokenAmount(removeUsdtAmount || '0')} USDT
                                </span>
                              </div>
                              <div className="mt-3 pt-3 border-t border-orange-300">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">移除后剩余LP:</span>
                                  <span className="font-semibold text-gray-800">
                                    {formatTokenAmount((parseFloat(userLiquidityInfo.lpTokens || '0') - parseFloat(removeAmount || '0')).toString())} LP
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">移除比例:</span>
                                  <span className="font-semibold text-purple-600">
                                    {formatPercentage((parseFloat(removeAmount || '0') / parseFloat(userLiquidityInfo.lpTokens || '1')).toString())}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={handleRemoveLiquidity}
                            disabled={
                              !isConnected || 
                              !validateNumberInput(removeAmount) || 
                              parseFloat(removeAmount || '0') > parseFloat(userLiquidityInfo.lpTokens || '0') ||
                              isLoading
                            }
                            className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-lg shadow-lg hover:from-red-600 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
                          >
                            {!isConnected 
                              ? '🔗 请连接钱包' 
                              : !validateNumberInput(removeAmount)
                                ? '📝 请输入LP代币数量'
                              : parseFloat(removeAmount || '0') > parseFloat(userLiquidityInfo.lpTokens || '0')
                                ? '💰 LP余额不足'
                              : isLoading 
                                ? '⏳ 处理中...' 
                                : '➖ 移除流动性'
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          {tab === 2 && (
            <LiquidityEarningsPanel />
          )}
          {/* 我的流动性卡片：始终显示在所有Tab内容区块下方 */}
          <LiquidityUserStatsPanel userLiquidityInfo={userLiquidityInfo} userPoolTokens={userPoolTokens} isConnected={isConnected} />
        </div>
      </div>
    </div>
  )
}
