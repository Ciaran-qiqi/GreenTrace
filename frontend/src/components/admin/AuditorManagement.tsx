'use client';

import React, { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAuditorOperations } from '@/hooks/useAuditorOperations';
import { useI18n } from '@/hooks/useI18n';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { toast } from 'react-hot-toast';

/**
 * Auditor management components
 * @description Manage auditor permissions to view auditor job statistics and performance
 */
export const AuditorManagement: React.FC = () => {
  const { t } = useI18n();
  const [newAuditorAddress, setNewAuditorAddress] = useState('');
  const [removeAuditorAddress, setRemoveAuditorAddress] = useState('');

  const { 
    auditorList, 
    auditorStats, 
    loadingAuditors,
    refetchAuditors,
    addAuditorToList,
    removeAuditorFromList,
    isCurrentUserAuditor
  } = useAuditorOperations();

  // Add an auditor's contract write

  const { 
    writeContract: addAuditor, 
    data: addTxHash, 
    isPending: isAddPending 
  } = useWriteContract();

  // Remove the auditor's contract write

  const { 
    writeContract: removeAuditor, 
    data: removeTxHash, 
    isPending: isRemovePending 
  } = useWriteContract();

  // Wait for the addition of auditor transaction confirmation

  const { isLoading: isAddConfirming, isSuccess: isAddSuccess, error: addError } = useWaitForTransactionReceipt({
    hash: addTxHash,
  });

  // Wait for the removal of auditor transaction confirmation

  const { isLoading: isRemoveConfirming, isSuccess: isRemoveSuccess, error: removeError } = useWaitForTransactionReceipt({
    hash: removeTxHash,
  });

  // Handle add auditor success
  useEffect(() => {
    if (isAddSuccess) {
      toast.success(t('admin.auditorManagement.auditorAddedSuccess'));
      addAuditorToList(newAuditorAddress);
      setNewAuditorAddress('');
      refetchAuditors();
    }
  }, [isAddSuccess, newAuditorAddress, addAuditorToList, refetchAuditors, t]);

  // Handle add auditor error
  useEffect(() => {
    if (addError) {
      toast.error(`${t('admin.auditorManagement.addFailed')} ${addError.message}`);
    }
  }, [addError, t]);

  // Handle remove auditor success
  useEffect(() => {
    if (isRemoveSuccess) {
      toast.success(t('admin.auditorManagement.auditorRemovedSuccess'));
      removeAuditorFromList(removeAuditorAddress);
      setRemoveAuditorAddress('');
      refetchAuditors();
    }
  }, [isRemoveSuccess, removeAuditorAddress, removeAuditorFromList, refetchAuditors, t]);

  // Handle remove auditor error
  useEffect(() => {
    if (removeError) {
      toast.error(`${t('admin.auditorManagement.removeFailed')} ${removeError.message}`);
    }
  }, [removeError, t]);

  // Verify address format

  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  // Processing Adding Auditors

  const handleAddAuditor = () => {
    if (!isValidAddress(newAuditorAddress)) {
      toast.error(t('admin.auditorManagement.enterValidAddressError'));
      return;
    }

    addAuditor({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'addAuditor',
      args: [newAuditorAddress as `0x${string}`],
    });
  };

  // Handle removal of auditors

  const handleRemoveAuditor = () => {
    if (!isValidAddress(removeAuditorAddress)) {
      toast.error(t('admin.auditorManagement.enterValidAddressError'));
      return;
    }

    removeAuditor({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'removeAuditor',
      args: [removeAuditorAddress as `0x${string}`],
    });
  };

  return (
    <div className="p-6">
      {/* Page title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('admin.auditorManagement.title')}</h2>
        <p className="text-gray-600">{t('admin.auditorManagement.subtitle')}</p>
      </div>

      {/* Permission reminder */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-medium text-yellow-800">{t('admin.auditorManagement.adminFunction')}</div>
            <div className="text-sm text-yellow-700">
              {t('admin.auditorManagement.adminFunctionDesc')} {isCurrentUserAuditor ? t('admin.auditorManagement.auditor') : t('admin.auditorManagement.visitor')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Add an auditor */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➕</span>
            {t('admin.auditorManagement.addAuditor')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.auditorManagement.auditorAddress')}
              </label>
              <input
                type="text"
                value={newAuditorAddress}
                onChange={(e) => setNewAuditorAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                {t('admin.auditorManagement.enterValidAddress')}
              </div>
            </div>
            
            <button
              onClick={handleAddAuditor}
              disabled={!newAuditorAddress || isAddPending || isAddConfirming}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddPending || isAddConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isAddPending ? t('admin.auditorManagement.sendingTransaction') : t('admin.auditorManagement.confirming')}
                </div>
              ) : (
                t('admin.auditorManagement.addAuditorButton')
              )}
            </button>
          </div>
        </div>

        {/* Remove the auditor */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➖</span>
            {t('admin.auditorManagement.removeAuditor')}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('admin.auditorManagement.auditorAddress')}
              </label>
              <input
                type="text"
                value={removeAuditorAddress}
                onChange={(e) => setRemoveAuditorAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                {t('admin.auditorManagement.enterAddressToRemove')}
              </div>
            </div>
            
            <button
              onClick={handleRemoveAuditor}
              disabled={!removeAuditorAddress || isRemovePending || isRemoveConfirming}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRemovePending || isRemoveConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRemovePending ? t('admin.auditorManagement.sendingTransaction') : t('admin.auditorManagement.confirming')}
                </div>
              ) : (
                t('admin.auditorManagement.removeAuditorButton')
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Auditor list and statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auditor statistics */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('admin.auditorManagement.auditorStats')}</h3>
          
          {loadingAuditors ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <div className="text-gray-600">{t('admin.auditorManagement.loadingAuditors')}</div>
            </div>
          ) : auditorList.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{auditorList.length}</div>
                <div className="text-sm text-blue-800">{t('admin.auditorManagement.totalAuditors')}</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {auditorList.filter(addr => {
                    const stats = auditorStats[addr];
                    return stats && (stats.totalMintAudits + stats.totalCashAudits) > 0;
                  }).length}
                </div>
                <div className="text-sm text-green-800">{t('admin.auditorManagement.activeAuditors')}</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(auditorStats).reduce((total, stats) => 
                    total + stats.totalMintAudits + stats.totalCashAudits, 0
                  )}
                </div>
                <div className="text-sm text-purple-800">{t('admin.auditorManagement.totalAudits')}</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {(() => {
                    const totalAudits = Object.values(auditorStats).reduce((total, stats) => 
                      total + stats.totalMintAudits + stats.totalCashAudits, 0
                    );
                    const totalApproved = Object.values(auditorStats).reduce((total, stats) => 
                      total + stats.approvedMintAudits + stats.approvedCashAudits, 0
                    );
                    return totalAudits > 0 ? Math.round((totalApproved / totalAudits) * 100) : 0;
                  })()}%
                </div>
                <div className="text-sm text-orange-800">{t('admin.auditorManagement.averageApprovalRate')}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('admin.auditorManagement.noAuditors')}
            </div>
          )}
        </div>

        {/* List of auditors */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('admin.auditorManagement.auditorList')}</h3>
          
          {loadingAuditors ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <div className="text-gray-600">{t('admin.auditorManagement.loadingAuditors')}</div>
            </div>
          ) : auditorList && auditorList.length > 0 ? (
            <div className="space-y-3">
              {auditorList.map((auditorAddress, index) => {
                const stats = auditorStats[auditorAddress];
                const totalAudits = stats ? stats.totalMintAudits + stats.totalCashAudits : 0;
                const approvalRate = stats ? 
                  ((stats.approvedMintAudits + stats.approvedCashAudits) / Math.max(1, totalAudits)) * 100 : 0;
                
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {auditorAddress.slice(0, 6)}...{auditorAddress.slice(-4)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {t('admin.auditorManagement.auditCount')}: {totalAudits} | {t('admin.auditorManagement.approvalRate')}: {approvalRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {t('admin.auditorManagement.lastActive')}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('admin.auditorManagement.noAuditors')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 