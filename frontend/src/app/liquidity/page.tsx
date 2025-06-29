'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Navigation } from '@/components/Navigation'
import { useTranslation } from '@/hooks/useI18n'
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
  const { t } = useTranslation();
  
  //Use hooks
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

  //LP target input related status
  const [targetLPAmount, setTargetLPAmount] = useState('')
  const [carbonAmount, setCarbonAmount] = useState('')
  const [usdtAmount, setUsdtAmount] = useState('')
  const [removeAmount, setRemoveAmount] = useState('')

  //Authorized hooks
  const {
    checkApprovalNeeded: checkCarbonApprovalNeeded,
    approveMax: approveCarbonMax,
    isWritePending: isCarbonApproving,
  } = useTokenApproval(carbonTokenAddress, liquidityPoolAddress)

  const {
    checkApprovalNeeded: checkUsdtApprovalNeeded,
    approveMax: approveUsdtMax,
    isWritePending: isUsdtApproving,
  } = useTokenApproval(usdtTokenAddress, liquidityPoolAddress)

  //LP target calculation function (for adding liquidity)
  const calculateTokensFromLP = useCallback(async (targetLP: string) => {
    if (!targetLP || !validateNumberInput(targetLP)) {
      setCarbonAmount('')
      setUsdtAmount('')
      return
    }

    try {
      const targetLPBigInt = parseUnits(targetLP, 18)
      
      //Get the pool state
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
        toast.error(t('liquidity.errors.emptyPoolAdd', '池子为空，无法计算所需代币数量'))
        return
      }

      const [totalCarbon, totalUsdt] = contractBalances
      
      //Calculate the number of tokens required
      const carbonNeeded = (targetLPBigInt * totalCarbon) / totalLPSupply
      const usdtNeeded = (targetLPBigInt * totalUsdt) / totalLPSupply

      setCarbonAmount(formatUnits(carbonNeeded, 18))
      setUsdtAmount(formatUnits(usdtNeeded, 18))

    } catch (error) {
      console.error('计算LP目标失败:', error)
      toast.error(t('liquidity.errors.calculationFailed', '计算失败，请检查输入'))
    }
  }, [liquidityPoolAddress])

  //LP removal calculation function (for removing liquidity)
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
      
      //Get the pool state
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
        toast.error(t('liquidity.errors.emptyPoolRemove', '池子为空，无法计算移除数量'))
        return
      }

      const [totalCarbon, totalUsdt] = contractBalances
      
      //Calculate the number of tokens that can be removed
      const carbonRemoved = (removeLPBigInt * totalCarbon) / totalLPSupply
      const usdtRemoved = (removeLPBigInt * totalUsdt) / totalLPSupply

      setRemoveCarbonAmount(formatUnits(carbonRemoved, 18))
      setRemoveUsdtAmount(formatUnits(usdtRemoved, 18))

    } catch (error) {
      console.error('计算移除LP失败:', error)
      toast.error(t('liquidity.errors.calculationFailed', '计算失败，请检查输入'))
    }
  }, [liquidityPoolAddress])

  //Calculate the number of tokens users have in the pool
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
      
      //Get the pool state
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
      
      //Calculate the number of tokens owned by the user
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

  //Processing to add liquidity
  const handleAddLiquidity = async () => {
    if (!validateNumberInput(targetLPAmount)) {
      toast.error(t('liquidity.add.errors.invalidAmount', '请输入有效的LP代币数量'))
      return
    }

    if (!carbonAmount || !usdtAmount) {
      toast.error(t('liquidity.add.errors.enterTargetFirst', '请先输入LP目标数量以计算所需代币'))
      return
    }

    try {
      //Check the balance
      if (parseFloat(carbonAmount) > userBalances.carbonBalanceRaw) {
        toast.error(t('liquidity.add.errors.insufficientCarbon', 'CARB余额不足'))
        return
      }
      if (parseFloat(usdtAmount) > userBalances.usdtBalanceRaw) {
        toast.error(t('liquidity.add.errors.insufficientUsdt', 'USDT余额不足'))
        return
      }

      //Authorization inspection and procedures
      const carbonNeedsApproval = checkCarbonApprovalNeeded(carbonAmount, 18)
      if (carbonNeedsApproval) {
        toast.loading(`🔑 ${t('liquidity.add.approvingCarbon', '正在授权CARB代币...')}`)
        await approveCarbonMax()
        toast.dismiss()
        toast.success(`✅ ${t('liquidity.add.carbonApproveSuccess', 'CARB授权成功！请再次点击添加流动性')}`)
        return
      }

      const usdtNeedsApproval = checkUsdtApprovalNeeded(usdtAmount, 18)
      if (usdtNeedsApproval) {
        toast.loading(`🔑 ${t('liquidity.add.approvingUsdt', '正在授权USDT代币...')}`)
        await approveUsdtMax()
        toast.dismiss()
        toast.success(`✅ ${t('liquidity.add.usdtApproveSuccess', 'USDT授权成功！请再次点击添加流动性')}`)
        return
      }

      //Execute adding liquidity
      toast.loading(`💧 ${t('liquidity.add.adding', '正在添加流动性...')}`)
      await addLiquidity(carbonAmount, usdtAmount)
      
      //Clear the form
      setTargetLPAmount('')
      setCarbonAmount('')
      setUsdtAmount('')
      
    } catch (error) {
      console.error('添加流动性失败:', error)
      toast.dismiss()
      toast.error(`❌ ${t('liquidity.add.errors.addFailed', '添加流动性失败')}: ${(error as Error).message}`)
    }
  }

  //Handle removal of liquidity
  const handleRemoveLiquidity = async () => {
    if (!validateNumberInput(removeAmount)) {
      toast.error(t('liquidity.remove.errors.invalidAmount', '请输入有效的数量'))
      return
    }
    try {
      await removeLiquidity(removeAmount)
      setRemoveAmount('')
    } catch (error) {
      console.error('移除流动性失败:', error)
    }
  }

  //Tab switches related status
  const [tab, setTab] = useState(1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50">
      <Navigation />
      
      <div className="py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/*Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">💧 {t('liquidity.title', '碳币流动性池')}</h1>
            <p className="text-lg text-gray-600">{t('liquidity.description', '提供流动性，获得交易手续费分成')}</p>
          </div>

          {/*Price information card: always displayed at the top */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-8 border border-white/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">📊</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('liquidity.priceInfo.title', '价格信息')}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">{t('liquidity.priceInfo.currentPrice', '当前池子价格')}</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatPrice(poolData.currentPrice)} / CARB
                </p>
                <div className="mt-2 text-xs text-green-500">💹 {t('liquidity.priceInfo.ammPrice', 'AMM价格')}</div>
              </div>
              
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">{t('liquidity.priceInfo.oraclePrice', '预言机参考价')}</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {formatPrice(poolData.referencePrice)} / CARB
                </p>
                <div className="mt-2 text-xs text-blue-500">🔮 {t('liquidity.priceInfo.referencePrice', '参考价格')}</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl border border-gray-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">{t('liquidity.priceInfo.priceDeviation', '价格偏离')}</p>
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
                <div className="mt-2 text-xs text-gray-500">📈 {t('liquidity.priceInfo.deviation', '偏离度')}</div>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-100 rounded-xl border border-purple-200 shadow-lg">
                <p className="text-sm text-gray-600 mb-2">{t('liquidity.priceInfo.totalLiquidity', '总流动性')}</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {formatPrice(poolData.totalLiquidity)}
                </p>
                <div className="mt-2 text-xs text-purple-500">💰 {t('liquidity.priceInfo.tvl', 'TVL')}</div>
              </div>
            </div>
          </div>

          {/*Tab switch block: three items */}
          <div className="flex justify-center mb-8 gap-4">
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 0 ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'}`}
              onClick={() => setTab(0)}
            >🔄{t('liquidity.tabs.swap', '市价兑换')}</button>
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 1 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
              onClick={() => setTab(1)}
            >💧{t('liquidity.tabs.liquidityManagement', '流动性管理')}</button>
            <button
              className={`px-6 py-2 rounded-full font-semibold text-lg transition-all duration-200 border-2 ${tab === 2 ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-yellow-600 border-yellow-300 hover:bg-yellow-50'}`}
              onClick={() => setTab(2)}
            >💰{t('liquidity.tabs.marketMaking', '做市收益')}</button>
          </div>

          {/*Tab content block */}
          {tab === 0 && (
            <SwapPanel />
          )}
          {tab === 1 && (
            //Only render liquidity management-related content
            <>
              {/*Main functional area */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
                {/*Liquidity Management */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm">💧</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">{t('liquidity.management.title', '流动性管理')}</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/*LP target add liquidity */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">🎯 {t('liquidity.add.title', 'LP目标添加流动性')}</h4>
                      
                      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-lg">
                        <div className="space-y-4">
                          {/*LP target input */}
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">{t('liquidity.add.targetAmount', '目标LP代币数量')}</label>
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
                              💡 {t('liquidity.add.helpText', '输入想要获得的LP代币数量，系统按AMM池子价格自动计算需要的代币数量')}
                            </p>
                          </div>

                          {/*Show calculation results */}
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="font-semibold text-blue-900 mb-3">📋 {t('liquidity.add.calculationResult', '计算结果')}</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('liquidity.add.carbonNeeded', '需要碳币')}:</span>
                                <span className="font-semibold text-green-600">
                                  {formatTokenAmount(carbonAmount || '0')} CARB
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('liquidity.add.usdtNeeded', '需要USDT')}:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatTokenAmount(usdtAmount || '0')} USDT
                                </span>
                              </div>
                              <div className="mt-3 pt-3 border-t border-blue-300">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{t('liquidity.add.carbonBalance', 'CARB余额')}:</span>
                                  <span className={`font-semibold ${carbonAmount && parseFloat(carbonAmount) > userBalances.carbonBalanceRaw ? 'text-red-600' : 'text-gray-800'}`}>
                                    {userBalances.carbonBalance}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{t('liquidity.add.usdtBalance', 'USDT余额')}:</span>
                                  <span className={`font-semibold ${usdtAmount && parseFloat(usdtAmount) > userBalances.usdtBalanceRaw ? 'text-red-600' : 'text-gray-800'}`}>
                                    {userBalances.usdtBalance}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/*Add liquidity button */}
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
                              ? `🔗 ${t('common.connectWallet', '请连接钱包')}` 
                              : !validateNumberInput(targetLPAmount)
                                ? `📝 ${t('liquidity.add.enterAmount', '请输入LP目标数量')}`
                              : !carbonAmount || !usdtAmount
                                ? `⏳ ${t('common.calculating', '计算中...')}`
                              : parseFloat(carbonAmount || '0') > userBalances.carbonBalanceRaw
                                ? `💰 ${t('liquidity.add.insufficientCarbon', 'CARB余额不足')}`
                              : parseFloat(usdtAmount || '0') > userBalances.usdtBalanceRaw
                                ? `💰 ${t('liquidity.add.insufficientUsdt', 'USDT余额不足')}`
                              : isCarbonApproving 
                                ? `🔑 ${t('liquidity.add.approvingCarbon', '正在授权CARB...')}` 
                                : isUsdtApproving 
                                  ? `🔑 ${t('liquidity.add.approvingUsdt', '正在授权USDT...')}` 
                                  : isLoading 
                                    ? `⏳ ${t('common.processing', '处理中...')}` 
                                    : checkCarbonApprovalNeeded(carbonAmount, 18)
                                      ? `🔑 ${t('liquidity.add.step1ApproveCarbon', '第1步：授权CARB代币')}`
                                      : checkUsdtApprovalNeeded(usdtAmount, 18)
                                        ? `🔑 ${t('liquidity.add.step2ApproveUsdt', '第2步：授权USDT代币')}`
                                        : `💧 ${t('liquidity.add.addLiquidity', '添加流动性')}`
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    {/*Remove liquidity */}
                    <div className="space-y-4">
                      <h4 className="text-lg font-semibold text-gray-900">➖ {t('liquidity.remove.title', '移除流动性')}</h4>
                      
                      <div className="p-6 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 shadow-lg">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">{t('liquidity.remove.lpAmount', 'LP代币数量')}</label>
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
                              {t('liquidity.remove.available', '可用')}: {formatTokenAmount(userLiquidityInfo.lpTokens)} LP
                            </p>
                          </div>

                          {/*Show removal calculation results */}
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <h5 className="font-semibold text-orange-900 mb-3">📋 {t('liquidity.remove.preview', '移除预览')}</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('liquidity.remove.recoverCarbon', '可取回碳币')}:</span>
                                <span className="font-semibold text-green-600">
                                  {formatTokenAmount(removeCarbonAmount || '0')} CARB
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">{t('liquidity.remove.recoverUsdt', '可取回USDT')}:</span>
                                <span className="font-semibold text-blue-600">
                                  {formatTokenAmount(removeUsdtAmount || '0')} USDT
                                </span>
                              </div>
                              <div className="mt-3 pt-3 border-t border-orange-300">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{t('liquidity.remove.remainingLP', '移除后剩余LP')}:</span>
                                  <span className="font-semibold text-gray-800">
                                    {formatTokenAmount((parseFloat(userLiquidityInfo.lpTokens || '0') - parseFloat(removeAmount || '0')).toString())} LP
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">{t('liquidity.remove.removeRatio', '移除比例')}:</span>
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
                              ? `🔗 ${t('common.connectWallet', '请连接钱包')}` 
                              : !validateNumberInput(removeAmount)
                                ? `📝 ${t('liquidity.remove.enterAmount', '请输入LP代币数量')}`
                              : parseFloat(removeAmount || '0') > parseFloat(userLiquidityInfo.lpTokens || '0')
                                ? `💰 ${t('liquidity.remove.insufficientLP', 'LP余额不足')}`
                              : isLoading 
                                ? `⏳ ${t('common.processing', '处理中...')}` 
                                : `➖ ${t('liquidity.remove.removeLiquidity', '移除流动性')}`
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
          {/*My Liquidity Card: Always show under all Tab content blocks */}
          <LiquidityUserStatsPanel userLiquidityInfo={userLiquidityInfo} userPoolTokens={userPoolTokens} isConnected={isConnected} />
        </div>
      </div>
    </div>
  )
}
