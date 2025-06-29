'use client';

import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { CarbonPriceCard } from '@/components/CarbonPriceCard';
import { useTranslation } from '@/hooks/useI18n';

// Main page component -Showcase GreenTrace project introduction

export default function Home() {
  const { t, mounted } = useTranslation();
  
  // Display infrastructure when rendering on server side

  if (!mounted) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 relative overflow-hidden">
          <div className="container mx-auto px-4 py-8 relative z-10">
            <div className="max-w-4xl mx-auto">
              {/* Main title area placeholder */}
              <div className="text-center mb-16">
                <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto mb-4 animate-pulse"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-8 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto animate-pulse"></div>
              </div>
              
              {/* Featured area placeholders */}
              <div className="grid md:grid-cols-3 gap-8 mb-16">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl animate-pulse">
                    <div className="h-12 bg-gray-200 rounded mb-4"></div>
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                ))}
              </div>
              
              {/* Carbon Price Index Placeholder */}
              <div className="mb-16">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 animate-pulse">
                  <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="h-6 bg-gray-200 rounded"></div>
                      <div className="h-6 bg-gray-200 rounded"></div>
                      <div className="h-6 bg-gray-200 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="h-6 bg-gray-200 rounded"></div>
                      <div className="h-6 bg-gray-200 rounded"></div>
                      <div className="h-6 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }
  
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-blue-50 relative overflow-hidden">
        {/* Premium background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dynamic gradient circle */}
          <div className="absolute top-20 left-10 w-64 h-64 bg-gradient-to-r from-green-400/20 to-emerald-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute top-40 right-20 w-48 h-48 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full blur-2xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl animate-pulse delay-2000"></div>
          
          {/* Grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
          
          {/* Floating particle effect */}
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-400/40 rounded-full animate-bounce delay-300"></div>
          <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-blue-400/40 rounded-full animate-bounce delay-700"></div>
          <div className="absolute bottom-1/3 left-3/4 w-1.5 h-1.5 bg-emerald-400/40 rounded-full animate-bounce delay-1100"></div>
        </div>
        
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="max-w-4xl mx-auto">
            {/* Main title area */}
            <div className="text-center mb-16">
              {/* Technical Tag Bar */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-semibold rounded-full">
                  {t('home.hero.tags.blockchain', 'Blockchain')}
                </span>
                <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold rounded-full">
                  {t('home.hero.tags.nft', 'NFT')}
                </span>
                <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full">
                  {t('home.hero.tags.defi', 'DeFi')}
                </span>
                <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold rounded-full">
                  {t('home.hero.tags.carbon', 'Carbon Credits')}
                </span>
              </div>
              
              <div className="inline-block p-6 bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md rounded-full mb-8 shadow-2xl">
                <div className="text-6xl animate-pulse">🌱</div>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-blue-600 bg-clip-text text-transparent mb-6 leading-tight">
                {t('home.hero.title', '记录绿色碳迹，创造可续未来')}
              </h1>
              
              <p className="text-lg lg:text-xl text-gray-600 mb-10 max-w-4xl mx-auto leading-relaxed">
                {t('home.hero.description', '通过区块链技术记录您的环保行为，将绿色行动转化为有价值的NFT资产，为地球贡献一份力量，同时获得碳信用奖励。')}
              </p>
              
              {/* Enhanced cta button group */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link 
                  href="/carbon-market"
                  className="group px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-full hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-bold shadow-2xl hover:shadow-green-500/25 transform hover:scale-105 relative overflow-hidden"
                >
                  <span className="relative z-10">{t('home.hero.startCreating', '开始获取碳币')}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </Link>
                <Link 
                  href="/market"
                  className="group px-10 py-4 bg-transparent border-2 border-green-600 text-green-600 rounded-full hover:bg-gradient-to-r hover:from-green-600 hover:to-emerald-600 hover:text-white transition-all duration-300 font-bold shadow-lg hover:shadow-xl relative overflow-hidden"
                >
                  <span className="relative z-10">{t('home.hero.exploreMarket', '探索NFT市场')}</span>
                </Link>
              </div>
              
              {/* Trust indicators */}
              <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>{t('home.hero.trust.decentralized', 'Decentralized')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                  <span>{t('home.hero.trust.verified', 'Verified')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-600"></div>
                  <span>{t('home.hero.trust.transparent', 'Transparent')}</span>
                </div>
              </div>
            </div>

            {/* Functional feature area */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl text-center border border-white/20 hover:shadow-2xl transition-all duration-300 group">
                <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🌱</div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">{t('home.features.createNFT.title', '创建绿色NFT')}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {t('home.features.createNFT.description', '记录您的环保行为，创建独特的绿色NFT，包括出行方式、能源使用、废物处理等环保行动。')}
                </p>
                <Link 
                  href="/create"
                  className="inline-block px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {t('home.features.createNFT.action', '开始创建')}
                </Link>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl text-center border border-white/20 hover:shadow-2xl transition-all duration-300 group">
                <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🔍</div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">{t('home.features.audit.title', '专业审计验证')}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {t('home.features.audit.description', '专业审计员验证您的绿色行为真实性，确保每个NFT都代表真实的环保贡献。')}
                </p>
                <div className="text-sm text-green-600 font-medium bg-green-50 px-4 py-2 rounded-full">
                  {t('home.features.audit.subtitle', '透明可信的审计流程')}
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl text-center border border-white/20 hover:shadow-2xl transition-all duration-300 group">
                <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🔄</div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">{t('home.features.exchange.title', '碳代币兑换')}</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {t('home.features.exchange.description', '将审核通过的NFT兑换为有价值的碳代币，参与碳信用交易，实现环保价值变现。')}
                </p>
                
                {/* Get the usdt button */}
                <a 
                  href="https://sepolia.etherscan.io/address/0xdcdc73413c6136c9abcc3e8d250af42947ac2fc7#writeContract"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {t('home.features.exchange.getUsdtButton', '获得USDT')}
                </a>
              </div>
            </div>

            {/* Carbon Price Index */}
            <div className="mb-16">
              <CarbonPriceCard />
            </div>

            {/* Display of technical advantages */}
            <div className="mb-16">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
                  {t('home.tech.title', '构建于尖端技术之上')}
                </h2>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  {t('home.tech.subtitle', '利用最先进的区块链技术和Web3基础设施')}
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border border-green-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">⛓️</div>
                  <h3 className="font-bold text-gray-800 mb-2">{t('home.tech.blockchain.title', 'Blockchain')}</h3>
                  <p className="text-sm text-gray-600">{t('home.tech.blockchain.desc', 'Immutable ledger')}</p>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border border-blue-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">🛡️</div>
                  <h3 className="font-bold text-gray-800 mb-2">{t('home.tech.security.title', 'Zero-Knowledge')}</h3>
                  <p className="text-sm text-gray-600">{t('home.tech.security.desc', 'Privacy-first')}</p>
                </div>
                
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border border-purple-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
                  <h3 className="font-bold text-gray-800 mb-2">{t('home.tech.speed.title', 'Lightning Fast')}</h3>
                  <p className="text-sm text-gray-600">{t('home.tech.speed.desc', 'Optimized gas')}</p>
                </div>
                
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-100 hover:shadow-xl transition-all duration-300 group">
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300">🌐</div>
                  <h3 className="font-bold text-gray-800 mb-2">{t('home.tech.interop.title', 'Cross-Chain')}</h3>
                  <p className="text-sm text-gray-600">{t('home.tech.interop.desc', 'Multi-network')}</p>
                </div>
              </div>
            </div>

            {/* Statistical information */}
            <div className="mt-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                  {t('home.stats.title', '平台数据')}
                </h2>
                <p className="text-gray-600">
                  {t('home.stats.subtitle', '实时链上数据展示')}
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div className="relative bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 to-green-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <div className="relative z-10">
                    <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">1000+</div>
                    <div className="text-gray-600 font-semibold text-sm lg:text-base">{t('home.stats.nftsCreated', '已创建NFT')}</div>
                  </div>
                </div>
                
                <div className="relative bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-100"></div>
                  <div className="relative z-10">
                    <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">500+</div>
                    <div className="text-gray-600 font-semibold text-sm lg:text-base">{t('home.stats.activeUsers', '活跃用户')}</div>
                  </div>
                </div>
                
                <div className="relative bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 to-purple-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-200"></div>
                  <div className="relative z-10">
                    <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">50+</div>
                    <div className="text-gray-600 font-semibold text-sm lg:text-base">{t('home.stats.auditors', '专业审计员')}</div>
                  </div>
                </div>
                
                <div className="relative bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/30 hover:shadow-2xl transition-all duration-500 group overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 to-orange-500/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 delay-300"></div>
                  <div className="relative z-10">
                    <div className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2 group-hover:scale-110 transition-transform duration-300">10,000+</div>
                    <div className="text-gray-600 font-semibold text-sm lg:text-base">{t('home.stats.carbonReduction', '碳减排量(kg)')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
