import React, { useEffect, useState } from 'react'
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'
import { formatTokenAmount } from '@/utils/formatters'
import { useTranslation } from '@/hooks/useI18n'
import { useAccount } from 'wagmi'
import { readContract } from '@wagmi/core'
import { config } from '../lib/wagmi'
import GreenTalesLiquidityPoolABI from '@/contracts/abi/GreenTalesLiquidityPool.json'
import { formatUnits } from 'viem'

/**
 * Market-making income block component (optimized version)
 * Displays that users can collect processing fees, platform cumulative processing fees, and LP cumulative processing fees, and provide one-click withdrawal button
 * Instructions for increasing revenue mechanisms, visualization of share ratios, FAQ and other contents
 */
export default function LiquidityEarningsPanel() {
  const { t } = useTranslation();
  
  // Get liquidity pool hook
  const {
    getUserEarnings,
    claimFees,
    getFeeStats,
    isConnected,
    liquidityPoolAddress,
  } = useGreenTalesLiquidityPool()
  const { address } = useAccount()

  // User income
  const [userEarnings, setUserEarnings] = useState({ carbonFees: '0', usdtFees: '0' })
  // Platform and lp cumulative handling fees
  const [feeStats, setFeeStats] = useState({
    platformCarbonFees: '0',
    platformUsdtFees: '0',
    totalLpCarbonFees: '0',
    totalLpUsdtFees: '0',
  })
  // Cumulative revenue received (real data on the chain)
  const [claimed, setClaimed] = useState({ carbon: '0', usdt: '0' })

  // Share ratio (can be read from the contract, write it to 70/30 here)
  const platformShare = 70
  const lpShare = 30

  // Loading revenue information
  const fetchClaimed = async () => {
    if (!address || !liquidityPoolAddress) return
    try {
      const claimedCarbon = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'userClaimedCarbonFees',
        args: [address],
      })
      const claimedUsdt = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'userClaimedUsdtFees',
        args: [address],
      })
      setClaimed({
        carbon: Number(formatUnits(claimedCarbon as bigint || BigInt(0), 18)).toFixed(6),
        usdt: Number(formatUnits(claimedUsdt as bigint || BigInt(0), 18)).toFixed(6),
      })
    } catch {
      setClaimed({ carbon: '0', usdt: '0' })
    }
  }

  useEffect(() => {
    setUserEarnings(getUserEarnings())
    getFeeStats().then(res => {
      if (res) setFeeStats(res)
    })
    fetchClaimed()
  }, [getUserEarnings, getFeeStats, address, liquidityPoolAddress])

  // Processing and receiving income
  const handleClaim = async () => {
    await claimFees()
    setUserEarnings(getUserEarnings())
    getFeeStats().then(res => {
      if (res) setFeeStats(res)
    })
    fetchClaimed()
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 to-blue-50 rounded-2xl shadow-xl p-6 border border-white/20 mb-8">
      {/* Revenue mechanism description block */}
      <div className="mb-6 p-4 bg-gradient-to-r from-yellow-100 to-blue-100 rounded-xl border border-yellow-200 flex items-center gap-4">
        <div className="text-3xl">💡</div>
        <div>
          <div className="text-lg font-bold text-yellow-700 mb-1">{t('earnings.explanation.title', '做市收益说明')}</div>
          <div className="text-gray-700 text-sm">
            {t('earnings.explanation.description', '作为流动性提供者（LP），你可以获得平台每笔交易手续费的')} <span className="font-bold text-blue-600">30%</span> {t('earnings.explanation.share', '分成，剩余')} <span className="font-bold text-yellow-600">70%</span> {t('earnings.explanation.platform', '归平台所有。手续费来源于所有碳币/USDT兑换操作，随时可领取。')}
          </div>
        </div>
      </div>

      {/* Visualization of proportions */}
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <span className="text-sm text-gray-600 mr-2">{t('earnings.feeShare.title', '手续费分成比例')}</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t('earnings.feeShare.platform', '平台')} {platformShare}%</span>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-2">LP {lpShare}%</span>
        </div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex">
          <div className="bg-yellow-400 h-4" style={{ width: `${platformShare}%` }} />
          <div className="bg-green-400 h-4" style={{ width: `${lpShare}%` }} />
        </div>
      </div>

      {/* Currently available and accumulated earned */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🟢</span>
            <span className="font-semibold text-green-700">{t('earnings.claimable.title', '当前可领取收益')}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>{t('earnings.claimable.carbonFees', '碳币手续费')}:</span>
            <span className="font-semibold text-green-600">{userEarnings.carbonFees} CARB</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>{t('earnings.claimable.usdtFees', 'USDT手续费')}:</span>
            <span className="font-semibold text-blue-600">{userEarnings.usdtFees} USDT</span>
          </div>
          <button
            onClick={handleClaim}
            disabled={!isConnected || (userEarnings.carbonFees === '0' && userEarnings.usdtFees === '0')}
            className="mt-3 w-full py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg hover:from-green-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200"
          >
            {!isConnected ? `🔗 ${t('common.connectWallet', '请连接钱包')}` : t('earnings.claimable.claimButton', '一键领取手续费收益')}
          </button>
        </div>
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📈</span>
            <span className="font-semibold text-blue-700">{t('earnings.claimed.title', '累计已领取收益')}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>{t('earnings.claimed.carbonFees', '碳币手续费')}:</span>
            <span className="font-semibold text-green-600">{claimed.carbon} CARB</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>{t('earnings.claimed.usdtFees', 'USDT手续费')}:</span>
            <span className="font-semibold text-blue-600">{claimed.usdt} USDT</span>
          </div>
        </div>
      </div>

      {/* Platform and lp cumulative handling fees */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="text-xs text-gray-500 mb-1">{t('earnings.stats.platformTotal', '平台累计手续费')}</div>
          <div className="flex justify-between text-sm">
            <span>{t('earnings.stats.carbon', '碳币')}:</span>
            <span className="font-semibold text-yellow-600">{formatTokenAmount(feeStats.platformCarbonFees)} CARB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>USDT:</span>
            <span className="font-semibold text-yellow-600">{formatTokenAmount(feeStats.platformUsdtFees)} USDT</span>
          </div>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs text-gray-500 mb-1">{t('earnings.stats.lpTotal', 'LP累计手续费')}</div>
          <div className="flex justify-between text-sm">
            <span>{t('earnings.stats.carbon', '碳币')}:</span>
            <span className="font-semibold text-purple-600">{formatTokenAmount(feeStats.totalLpCarbonFees)} CARB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>USDT:</span>
            <span className="font-semibold text-purple-600">{formatTokenAmount(feeStats.totalLpUsdtFees)} USDT</span>
          </div>
        </div>
      </div>

      {/* Faq/Description Block */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="font-semibold text-gray-700 mb-2">{t('earnings.faq.title', '常见问题 FAQ')}</div>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <span className="font-medium text-blue-700">{t('earnings.faq.q1', '为什么有时收益为0？')}</span> {t('earnings.faq.a1', '可能近期没有相关方向的兑换，或手续费尚未累计到最小单位。')}</li>
          <li>• <span className="font-medium text-blue-700">{t('earnings.faq.q2', '收益多久结算一次？')}</span> {t('earnings.faq.a2', '每次兑换后实时结算，可随时领取。')}</li>
          <li>• <span className="font-medium text-blue-700">{t('earnings.faq.q3', '平台和LP分成比例可以调整吗？')}</span> {t('earnings.faq.a3', '支持，需管理员操作。')}</li>
          <li>• <span className="font-medium text-blue-700">{t('earnings.faq.q4', '支持多币种收益吗？')}</span> {t('earnings.faq.a4', '是，碳币和USDT均可获得手续费分成。')}</li>
        </ul>
      </div>
    </div>
  )
} 