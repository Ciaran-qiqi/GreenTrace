'use client';

import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { useTranslation, useLocalizedNavigation } from '@/hooks/useI18n';
import { LanguageToggle } from '@/components/LanguageToggle';

// Get the green trace contract address according to the chain id

const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // Local foundry test network

      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// Navigation Component -Includes wallet connection and three-level permission navigation menu

export const Navigation: React.FC = () => {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();
  const { getLocalizedPath, mounted: i18nMounted } = useLocalizedNavigation();

  // Make sure components are rendered only on the client side

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get the contract address

  const greenTraceAddress = getGreenTraceAddress(chainId);

  // Check whether the user is the contract owner

  const { data: contractOwner } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'owner',
    query: {
      enabled: !!address && mounted,
    }
  });

  // Check whether the user is an auditor

  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && mounted,
    }
  });

  // Determine user permissions

  const isContractOwner = Boolean(mounted && address && contractOwner && 
    address.toLowerCase() === (contractOwner as string).toLowerCase());
  const isAuthorizedAuditor = Boolean(mounted && address && isAuditor);

  // Display basic navigation structure when rendering on server side

  if (!mounted || !i18nMounted) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-8xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between h-16">
            {/* Logo on the left */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2 group">
                <div className="text-2xl group-hover:scale-110 transition-transform duration-200">🌱</div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  GreenTrace
                </span>
              </div>
            </div>
            
            {/* Right placeholder */}
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
          {/* Logo and navigation link on the left */}
          <div className="flex items-center">
            <Link href={getLocalizedPath("/")} className="flex items-center space-x-2 group">
              <div className="text-2xl group-hover:scale-110 transition-transform duration-200">🌱</div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                GreenTrace
              </span>
            </Link>
            
            {/* Desktop navigation menu */}
            <div className="ml-16 flex items-center space-x-2">
              {/* Group 1: Access without a wallet */}
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
              
              {/* Group 2: Need to connect to the wallet */}
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
              
              {/* Group 3: Special permissions are required */}
              {mounted && isConnected && (isAuthorizedAuditor || isContractOwner) && (
                <>
                  <div className="w-px h-6 bg-gray-200 mx-4 self-center"></div>
                  <div className="flex space-x-2">
                    {/* Audit Center -only visible to the auditor */}
                    {isAuthorizedAuditor && (
                  <Link 
                    href={getLocalizedPath("/audit")} 
                    className="relative px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-purple-600 transition-all duration-200 hover:bg-purple-50 group"
                  >
                    <span className="relative z-10">{t('navigation.auditCenter', '🔍 审计中心')}</span>
                    <div className="absolute inset-0 bg-purple-100 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  </Link>
                    )}
                  
                    {/* Management Center -Only visible to contract owners */}
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

          {/* Language toggle, permission status and wallet connection buttons on the right */}
          <div className="flex items-center space-x-4">
            {/* Language Switcher */}
            <LanguageToggle 
              style="dropdown" 
              size="md" 
              showFlag={true} 
              showName={true}
            />
            {/* Permission status indicator */}
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
            
            {/* Wallet Connection Button */}
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

      {/* Mobile navigation menu */}
      <div className="md:hidden bg-white border-t border-gray-100">
        <div className="px-4 py-3 space-y-2">
          {/* Mobile language switcher */}
          <div className="flex justify-center mb-4">
            <LanguageToggle 
              style="buttons" 
              size="sm" 
              showFlag={true} 
              showName={false}
            />
          </div>
          {/* Group 1: No wallet required */}
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
          
          {/* Group 2: Wallet required */}
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
          
          {/* Group 3: Permissions required */}
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
          
          {/* Permission status display */}
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