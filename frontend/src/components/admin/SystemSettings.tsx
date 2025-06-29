'use client';

import React from 'react';
import { useChainId } from 'wagmi';
import { useI18n } from '@/hooks/useI18n';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';

/**
 * System Settings Components
 * @description Display system configuration information, rate settings, contract status, etc.
 */
export const SystemSettings: React.FC = () => {
  const { t } = useI18n();
  const chainId = useChainId();

  // Get the contract address

  const getContractAddresses = (chainId: number) => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet;
      case 11155111: return CONTRACT_ADDRESSES.sepolia;
      case 31337: return CONTRACT_ADDRESSES.foundry;
      default: return CONTRACT_ADDRESSES.sepolia;
    }
  };

  const contracts = getContractAddresses(chainId);

  // Network information

  const getNetworkInfo = (chainId: number) => {
    switch (chainId) {
      case 1: return { name: 'Ethereum Mainnet', color: 'bg-blue-100 text-blue-800' };
      case 11155111: return { name: 'Sepolia Testnet', color: 'bg-yellow-100 text-yellow-800' };
      case 31337: return { name: 'Foundry Local', color: 'bg-green-100 text-green-800' };
      default: return { name: 'Unknown Network', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const networkInfo = getNetworkInfo(chainId);

  return (
    <div className="p-6">
      {/* Page title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('admin.systemSettings.title')}</h2>
        <p className="text-gray-600">{t('admin.systemSettings.subtitle')}</p>
      </div>

      {/* Network and environment information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">🌐</span>
            {t('admin.systemSettings.networkInfo')}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.network')}:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${networkInfo.color}`}>
                {networkInfo.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.chainId')}:</span>
              <span className="font-semibold">{chainId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.environment')}:</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {t('admin.systemSettings.production')}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            {t('admin.systemSettings.systemStatus')}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.initialized')}:</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ {t('admin.systemSettings.initialized')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.mintRequestId')}:</span>
              <span className="font-semibold">#1</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.exchangeRequestId')}:</span>
              <span className="font-semibold">#1</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">💰</span>
            {t('admin.systemSettings.feeSettings')}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.systemFee')}:</span>
              <span className="font-semibold text-blue-600">1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.auditFee')}:</span>
              <span className="font-semibold text-green-600">4%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.totalFee')}:</span>
              <span className="font-semibold text-purple-600">5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contract address information */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <span className="text-xl">📋</span>
          {t('admin.businessContractManagement.contractAddresses')}
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="font-medium text-gray-800">{t('admin.systemSettings.greenTraceContract')}</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.GreenTrace}
            </div>
            <div className="text-xs text-gray-500">
              {t('admin.systemSettings.mainBusinessContract')}
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-800">{t('admin.systemSettings.carbonTokenContract')}</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.CarbonToken}
            </div>
            <div className="text-xs text-gray-500">
              {t('admin.systemSettings.carbonTokenContractDesc')}
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-800">{t('admin.systemSettings.greenTalesNFTContract')}</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.NFT}
            </div>
            <div className="text-xs text-gray-500">
              {t('admin.systemSettings.greenTalesNFTContractDesc')}
            </div>
          </div>
        </div>
      </div>

      {/* Tokens and NFT information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            {t('admin.systemSettings.carbonTokenInfo')}
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.tokenName')}:</span>
              <span className="font-semibold">Carbon Token</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.tokenSymbol')}:</span>
              <span className="font-semibold">CARB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.decimals')}:</span>
              <span className="font-semibold">18</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.totalSupply')}:</span>
              <span className="font-semibold text-green-600">1,000,000 CARB</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">🎨</span>
            {t('admin.systemSettings.nftContractInfo')}
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.nftName')}:</span>
              <span className="font-semibold">GreenTales NFT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.nftSymbol')}:</span>
              <span className="font-semibold">GTNFT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.contractStandard')}:</span>
              <span className="font-semibold">ERC-721</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('admin.systemSettings.totalMinted')}:</span>
              <span className="font-semibold text-blue-600">0 NFTs</span>
            </div>
          </div>
        </div>
      </div>

      {/* System configuration instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
          <span className="text-xl">ℹ️</span>
          {t('admin.systemSettings.systemConfigInfo')}
        </h3>
        <div className="text-sm text-blue-700 space-y-2">
          <p>{t('admin.systemSettings.configInfo1')}</p>
          <p>{t('admin.systemSettings.configInfo2')}</p>
          <p>{t('admin.systemSettings.configInfo3')}</p>
        </div>
      </div>
    </div>
  );
}; 