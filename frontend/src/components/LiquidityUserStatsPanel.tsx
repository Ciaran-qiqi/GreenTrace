import React from 'react'
import { formatTokenAmount, formatPercentage } from '@/utils/formatters'
import { useTranslation } from '@/hooks/useI18n'

/**
 * 我的流动性统计卡片组件
 * 展示用户在池子的LP、份额、碳币、USDT数量
 * 需传入userLiquidityInfo和userPoolTokens
 */
export default function LiquidityUserStatsPanel({ userLiquidityInfo, userPoolTokens, isConnected }) {
  const { t } = useTranslation();
  
  if (!isConnected) return null
  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-gray-900">📊 {t('liquidity.userStats.title', '我的流动性')}</h4>
        <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          💡 {t('liquidity.userStats.subtitle', 'LP代币对应的实际资产')}
        </div>
      </div>
      {/* 四个数据并排显示 */}
      <div className="grid grid-cols-4 gap-6">
        <div className="text-center p-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl border border-blue-300 shadow-lg">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg">🏆</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{t('liquidity.userStats.lpTokens', 'LP代币')}</p>
          <p className="text-2xl font-bold text-blue-700">
            {formatTokenAmount(userLiquidityInfo.lpTokens)}
          </p>
        </div>
        <div className="text-center p-6 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl border border-purple-300 shadow-lg">
          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg">📊</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{t('liquidity.userStats.poolShare', '池子份额')}</p>
          <p className="text-2xl font-bold text-purple-700">
            {formatPercentage(userLiquidityInfo.sharePercentage)}
          </p>
        </div>
        <div className="text-center p-6 bg-gradient-to-br from-green-100 to-green-200 rounded-xl border border-green-300 shadow-lg">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg">🌱</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{t('liquidity.userStats.carbonAmount', '碳币数量')}</p>
          <p className="text-2xl font-bold text-green-700">
            {formatTokenAmount(userPoolTokens.carbonAmount)}
          </p>
          <p className="text-sm text-green-600 font-medium">CARB</p>
        </div>
        <div className="text-center p-6 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl border border-indigo-300 shadow-lg">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg">💎</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{t('liquidity.userStats.usdtAmount', 'USDT数量')}</p>
          <p className="text-2xl font-bold text-indigo-700">
            {formatTokenAmount(userPoolTokens.usdtAmount)}
          </p>
          <p className="text-sm text-indigo-600 font-medium">USDT</p>
        </div>
      </div>
    </div>
  )
} 