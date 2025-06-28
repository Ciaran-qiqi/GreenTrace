'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { useTranslation, useLocalizedNavigation } from '@/hooks/useI18n';
import { LanguageToggle } from '@/components/LanguageToggle';

// 根据链ID获取GreenTrace合约地址
const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // 本地Foundry测试网
      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// 导航组件 - 包含钱包连接和三级权限导航菜单
export const Navigation: React.FC = () => {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();
  const { getLocalizedPath, mounted: i18nMounted } = useLocalizedNavigation();

  // 确保组件只在客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  // 获取合约地址
  const greenTraceAddress = getGreenTraceAddress(chainId);

  // 检查用户是否是合约所有者
  const { data: contractOwner } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'owner',
    query: {
      enabled: !!address && mounted,
    }
  });

  // 检查用户是否是审计员
  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && mounted,
    }
  });

  // 判断用户权限
  const isContractOwner = Boolean(mounted && address && contractOwner && 
    address.toLowerCase() === (contractOwner as string).toLowerCase());
  const isAuthorizedAuditor = Boolean(mounted && address && isAuditor);

  // 在服务器端渲染时显示基础导航结构
  if (!mounted || !i18nMounted) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-8xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between h-16">
            {/* 左侧Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2 group">
                <div className="text-2xl group-hover:scale-110 transition-transform duration-200">🌱</div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  GreenTrace
                </span>
              </div>
            </div>
            
            {/* 右侧占位符 */}
            <div className="flex items-center space-x-4">
              <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-8xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex justify-between h-16">
          {/* 左侧Logo和导航链接 */}
          <div className="flex items-center">
            <Link href={getLocalizedPath("/")} className="flex items-center space-x-2 group">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-200">🌱</div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                GreenTrace
              </span>
            </Link>
            
            {/* 桌面端导航菜单 */}
            <div className="ml-16 flex items-center space-x-2">
              {/* 第一组：无需钱包即可访问 */}
              <div className="flex space-x-2">
              <Link 
                href={getLocalizedPath("/")} 
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-green-600 transition-all duration-200 hover:bg-green-50 group"
              >
                  <span className="relative z-10">{t('navigation.home', '🏠 首页')}</span>
                  <div className="absolute inset-0 bg-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </Link>
                
                <Link 
                href={getLocalizedPath("/carbon-market")} 
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-green-600 transition-all duration-200 hover:bg-green-50 group"
              >
                <span className="relative z-10">{t('navigation.carbonMarket', '📈 碳币市场')}</span>
                <div className="absolute inset-0 bg-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
              
              <Link 
                href={getLocalizedPath("/liquidity")} 
                  className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-green-600 transition-all duration-200 hover:bg-green-50 group"
                >
                <span className="relative z-10">{t('navigation.liquidityPool', '💧 流动性池')}</span>
                <div className="absolute inset-0 bg-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
              
              <Link 
                  href={getLocalizedPath("/created")} 
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-green-600 transition-all duration-200 hover:bg-green-50 group"
              >
                  <span className="relative z-10">{t('navigation.created', '🌱 NFT创建')}</span>
                <div className="absolute inset-0 bg-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
              
              <Link 
                href={getLocalizedPath("/market")} 
                className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-green-600 transition-all duration-200 hover:bg-green-50 group"
              >
                  <span className="relative z-10">{t('navigation.nftMarket', '🛒 NFT市场')}</span>
                <div className="absolute inset-0 bg-green-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              </Link>
              </div>
              
              {/* 第二组：需要连接钱包 */}
              {mounted && isConnected && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-4 self-center"></div>
                  <div className="flex space-x-2">
                  <Link 
                    href={getLocalizedPath("/assets")} 
                    className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 transition-all duration-200 hover:bg-blue-50 group"
                  >
                    <span className="relative z-10">{t('navigation.assets', '💼 我的资产')}</span>
                    <div className="absolute inset-0 bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </Link>
                  
                  <Link 
                    href={getLocalizedPath("/my-listings")} 
                    className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 transition-all duration-200 hover:bg-blue-50 group"
                  >
                    <span className="relative z-10">{t('navigation.myListings', '🏪 我的挂单')}</span>
                    <div className="absolute inset-0 bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </Link>
                  
                    <Link 
                      href={getLocalizedPath("/exchange")} 
                      className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-600 transition-all duration-200 hover:bg-blue-50 group"
                    >
                      <span className="relative z-10">{t('navigation.nftExchange', '🔄 NFT兑换')}</span>
                      <div className="absolute inset-0 bg-blue-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    </Link>
                  </div>
                </>
              )}
              
              {/* 第三组：需要特殊权限 */}
              {mounted && isConnected && (isAuthorizedAuditor || isContractOwner) && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-4 self-center"></div>
                  <div className="flex space-x-2">
                    {/* 审计中心 - 仅审计员可见 */}
                    {isAuthorizedAuditor && (
                  <Link 
                    href={getLocalizedPath("/audit")} 
                    className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-purple-600 transition-all duration-200 hover:bg-purple-50 group"
                  >
                    <span className="relative z-10">{t('navigation.auditCenter', '🔍 审计中心')}</span>
                    <div className="absolute inset-0 bg-purple-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </Link>
                    )}
                  
                    {/* 管理中心 - 仅合约所有者可见 */}
                    {isContractOwner && (
                  <Link 
                        href={getLocalizedPath("/admin")} 
                        className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-red-600 transition-all duration-200 hover:bg-red-50 group"
                  >
                        <span className="relative z-10">{t('navigation.adminCenter', '⚙️ 管理中心')}</span>
                        <div className="absolute inset-0 bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </Link>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 右侧语言切换、权限状态和钱包连接按钮 */}
          <div className="flex items-center space-x-4">
            {/* 语言切换器 */}
            <LanguageToggle 
              style="dropdown" 
              size="md" 
              showFlag={true} 
              showName={true}
            />
            {/* 权限状态指示器 */}
            {mounted && isConnected && (
              <div className="flex items-center space-x-2 text-xs">
                {isContractOwner && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-red-100 to-pink-100 text-red-700 rounded-full border border-red-200 shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1">
                    <span>👑</span>
                    <span className="font-medium">{t('navigation.roles.admin', '管理员')}</span>
                  </span>
                )}
                {isAuthorizedAuditor && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 rounded-full border border-purple-200 shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-1">
                    <span>🔍</span>
                    <span className="font-medium">{t('navigation.roles.auditor', '审计员')}</span>
                  </span>
                )}
              </div>
            )}
            
            {/* 钱包连接按钮 */}
            {mounted && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-1">
                <ConnectButton 
                  chainStatus="icon"
                  showBalance={false}
                  accountStatus={{
                    smallScreen: 'avatar',
                    largeScreen: 'full',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 移动端导航菜单 */}
      <div className="md:hidden bg-white border-t border-gray-100">
        <div className="px-4 py-3 space-y-2">
          {/* 移动端语言切换器 */}
          <div className="flex justify-center mb-4">
            <LanguageToggle 
              style="buttons" 
              size="sm" 
              showFlag={true} 
              showName={false}
            />
          </div>
          {/* 第一组：无需钱包 */}
          <div className="space-y-1">
          <Link 
            href={getLocalizedPath("/")} 
            className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
          >
            {t('navigation.home', '🏠 首页')}
          </Link>
          <Link 
            href={getLocalizedPath("/carbon-market")} 
            className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
          >
            {t('navigation.carbonMarket', '📈 碳币市场')}
          </Link>
          <Link 
            href={getLocalizedPath("/liquidity")} 
              className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
            >
            {t('navigation.liquidityPool', '💧 流动性池')}
            </Link>
            <Link 
            href={getLocalizedPath("/created")} 
            className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
          >
            {t('navigation.created', '🌱 NFT创建')}
          </Link>
          <Link 
            href={getLocalizedPath("/market")} 
            className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
          >
            {t('navigation.nftMarket', '🛒 NFT市场')}
          </Link>
          </div>
          
          {/* 第二组：需要钱包 */}
          {mounted && isConnected && (
            <>
              <div className="border-t border-gray-200 my-2"></div>
              <div className="space-y-1">
              <Link 
                href={getLocalizedPath("/assets")} 
                className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
              >
                {t('navigation.assets', '💼 我的资产')}
              </Link>
                <Link 
                href={getLocalizedPath("/my-listings")} 
                  className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                >
                {t('navigation.myListings', '🏪 我的挂单')}
                </Link>
                <Link 
                  href={getLocalizedPath("/exchange")} 
                  className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                >
                  {t('navigation.nftExchange', '🔄 NFT兑换')}
                </Link>
              </div>
            </>
          )}
          
          {/* 第三组：需要权限 */}
          {mounted && isConnected && (isAuthorizedAuditor || isContractOwner) && (
            <>
              <div className="border-t border-gray-200 my-2"></div>
              <div className="space-y-1">
                {isAuthorizedAuditor && (
              <Link 
                href={getLocalizedPath("/audit")} 
                className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                {t('navigation.auditCenter', '🔍 审计中心')}
              </Link>
                )}
                {isContractOwner && (
              <Link 
                    href={getLocalizedPath("/admin")} 
                    className="flex items-center px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                    {t('navigation.adminCenter', '⚙️ 管理中心')}
              </Link>
                )}
              </div>
            </>
          )}
          
          {/* 权限状态显示 */}
          {mounted && isConnected && (isContractOwner || isAuthorizedAuditor) && (
            <div className="border-t border-gray-200 my-3 pt-3">
              <div className="px-4">
                <div className="text-sm text-gray-500 mb-2 font-medium">{t('navigation.currentRole', '✨ 当前权限')}</div>
                <div className="flex flex-wrap gap-2">
                  {isContractOwner && (
                    <span className="px-3 py-2 bg-gradient-to-r from-red-100 to-pink-100 text-red-700 rounded-full border border-red-200 shadow-sm flex items-center space-x-1.5 text-sm">
                      <span>👑</span>
                      <span className="font-medium">{t('navigation.roles.admin', '管理员')}</span>
                    </span>
                  )}
                  {isAuthorizedAuditor && (
                    <span className="px-3 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 rounded-full border border-purple-200 shadow-sm flex items-center space-x-1.5 text-sm">
                      <span>🔍</span>
                      <span className="font-medium">{t('navigation.roles.auditor', '审计员')}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}; 