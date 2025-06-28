'use client';

import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useI18n } from '@/hooks/useI18n';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { toast } from 'react-hot-toast';

/**
 * 业务合约管理组件
 * @description 管理授权的业务合约，添加或移除业务合约权限
 */
export const BusinessContractManagement: React.FC = () => {
  const { t } = useI18n();
  const [newContractAddress, setNewContractAddress] = useState('');
  const [removeContractAddress, setRemoveContractAddress] = useState('');
  const [contractList, setContractList] = useState<string[]>([
    // 模拟已存在的业务合约
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
  ]);

  // 添加业务合约
  const { 
    writeContract: addContract, 
    data: addTxHash, 
    isPending: isAddPending 
  } = useWriteContract();

  // 移除业务合约
  const { 
    writeContract: removeContract, 
    data: removeTxHash, 
    isPending: isRemovePending 
  } = useWriteContract();

  // 等待添加交易确认
  const { isLoading: isAddConfirming } = useWaitForTransactionReceipt({
    hash: addTxHash,
    onSuccess: () => {
      toast.success(t('admin.businessContractManagement.contractAddedSuccess'));
      setContractList(prev => [...prev, newContractAddress]);
      setNewContractAddress('');
    },
    onError: (error) => {
      toast.error(`${t('admin.businessContractManagement.addFailed')} ${error.message}`);
    }
  });

  // 等待移除交易确认
  const { isLoading: isRemoveConfirming } = useWaitForTransactionReceipt({
    hash: removeTxHash,
    onSuccess: () => {
      toast.success(t('admin.businessContractManagement.contractRemovedSuccess'));
      setContractList(prev => prev.filter(addr => addr !== removeContractAddress));
      setRemoveContractAddress('');
    },
    onError: (error) => {
      toast.error(`${t('admin.businessContractManagement.removeFailed')} ${error.message}`);
    }
  });

  // 验证地址格式
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  // 处理添加业务合约
  const handleAddContract = () => {
    if (!isValidAddress(newContractAddress)) {
      toast.error(t('admin.businessContractManagement.enterValidContractAddress'));
      return;
    }

    if (contractList.includes(newContractAddress)) {
      toast.error(t('admin.businessContractManagement.contractAlreadyAuthorized'));
      return;
    }

    addContract({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'addBusinessContract',
      args: [newContractAddress as `0x${string}`],
    });
  };

  // 处理移除业务合约
  const handleRemoveContract = () => {
    if (!isValidAddress(removeContractAddress)) {
      toast.error(t('admin.businessContractManagement.enterValidContractAddress'));
      return;
    }

    removeContract({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'removeBusinessContract',
      args: [removeContractAddress as `0x${string}`],
    });
  };

  // 快速移除合约
  const quickRemoveContract = (address: string) => {
    setRemoveContractAddress(address);
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('admin.businessContractManagement.title')}</h2>
        <p className="text-gray-600">{t('admin.businessContractManagement.subtitle')}</p>
      </div>

      {/* 权限提醒 */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-medium text-yellow-800">{t('admin.auditorManagement.adminFunction')}</div>
            <div className="text-sm text-yellow-700">
              {t('admin.businessContractManagement.adminFunctionDesc')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 添加业务合约 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➕</span>
            {t('admin.businessContractManagement.addContract')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.businessContractManagement.contractAddress')}
              </label>
              <input
                type="text"
                value={newContractAddress}
                onChange={(e) => setNewContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                {t('admin.businessContractManagement.enterContractAddressToAuthorize')}
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">{t('admin.businessContractManagement.authorizedCapabilities')}</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>{t('admin.businessContractManagement.capability1')}</li>
                  <li>{t('admin.businessContractManagement.capability2')}</li>
                  <li>{t('admin.businessContractManagement.capability3')}</li>
                </ul>
              </div>
            </div>
            
            <button
              onClick={handleAddContract}
              disabled={!newContractAddress || isAddPending || isAddConfirming}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddPending || isAddConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isAddPending ? t('admin.auditorManagement.sendingTransaction') : t('admin.auditorManagement.confirming')}
                </div>
              ) : (
                t('admin.businessContractManagement.addContractButton')
              )}
            </button>
          </div>
        </div>

        {/* 移除业务合约 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➖</span>
            {t('admin.businessContractManagement.removeContract')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.businessContractManagement.contractAddress')}
              </label>
              <input
                type="text"
                value={removeContractAddress}
                onChange={(e) => setRemoveContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                {t('admin.businessContractManagement.enterContractAddressToRemove')}
              </div>
            </div>
            
            <button
              onClick={handleRemoveContract}
              disabled={!removeContractAddress || isRemovePending || isRemoveConfirming}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRemovePending || isRemoveConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRemovePending ? t('admin.auditorManagement.sendingTransaction') : t('admin.auditorManagement.confirming')}
                </div>
              ) : (
                t('admin.businessContractManagement.removeContractButton')
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 已授权合约列表 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('admin.businessContractManagement.authorizedContracts')}</h3>
        
        {contractList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {t('admin.businessContractManagement.noAuthorizedContracts')}
          </div>
        ) : (
          <div className="space-y-3">
            {contractList.map((contract, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-mono text-gray-800">
                    {contract}
                  </div>
                  <div className="text-sm text-gray-500">
                    {t('admin.businessContractManagement.contractName')}: {t('admin.businessContractManagement.businessContract')} #{index + 1}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                    {t('admin.businessContractManagement.authorized')}
                  </span>
                  <button
                    onClick={() => quickRemoveContract(contract)}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
                  >
                    {t('admin.businessContractManagement.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 