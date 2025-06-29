'use client';

import { useState } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { AuditRecord } from '@/hooks/useAdminData';

/**
 * Audit details Hook
 * @description Get and cache audit records details
 */
export const useAuditDetails = () => {
  const chainId = useChainId();
  const [auditDetailsCache, setAuditDetailsCache] = useState<Record<string, AuditRecord>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // Get the contract address

  const getGreenTraceAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.GreenTrace;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
      case 31337: return CONTRACT_ADDRESSES.foundry.GreenTrace;
      default: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    }
  };

  const greenTraceAddress = getGreenTraceAddress(chainId);

  // Get audit details

  const getAuditDetails = async (requestId: string, isExchange: boolean = false) => {
    // Check the cache

    if (auditDetailsCache[requestId]) {
      return auditDetailsCache[requestId];
    }

    // Set loading status

    setLoadingDetails(prev => ({ ...prev, [requestId]: true }));

    try {
      // Simulate audit details data, the contract method should actually be called
      // Due to the complexity of contract calls, we use simulation data first.

      const mockAuditDetail: AuditRecord = {
        requester: '0x1234567890123456789012345678901234567890',
        auditor: isExchange ? '0x2345678901234567890123456789012345678901' : '0x3456789012345678901234567890123456789012',
        requestId: requestId,
        nftTokenId: isExchange ? '0' : (parseInt(requestId) + 100).toString(),
        carbonValue: isExchange ? '5000000000000000000' : '2000000000000000000', // 5 CARB or 2 CARB

        status: Math.random() > 0.3 ? 1 : 0, // 70% approved, 30% pending review

        auditType: isExchange ? 1 : 0,
        requestTimestamp: (Date.now() / 1000 - Math.random() * 86400 * 7).toString(), // In the last 7 days

        auditTimestamp: Math.random() > 0.3 ? (Date.now() / 1000 - Math.random() * 86400 * 3).toString() : '0', // Audited within the last 3 days

        auditComment: Math.random() > 0.5 ? '审计通过，符合环保标准' : '需要补充更多证明材料',
        requestData: {
          title: isExchange ? '' : `环保项目${requestId}`,
          storyDetails: isExchange ? '' : `详细的环保故事描述 ${requestId}`,
          carbonReduction: isExchange ? '0' : '1000000000000000000', // 1 ton of carbon emission reduction

          tokenURI: isExchange ? '' : `https://example.com/metadata/${requestId}`,
          requestFee: '100000000000000000', // 0.1 CARB

        },
      };

      // Update cache

      setAuditDetailsCache(prev => ({
        ...prev,
        [requestId]: mockAuditDetail
      }));

      return mockAuditDetail;

    } catch (error) {
      console.error('获取审计详情失败:', error);
      return null;
    } finally {
      // Clear loading status

      setLoadingDetails(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Get audit details in batches

  const getBatchAuditDetails = async (requestIds: string[], isExchange: boolean = false) => {
    const promises = requestIds.map(id => getAuditDetails(id, isExchange));
    return Promise.all(promises);
  };

  // Clear cache

  const clearCache = () => {
    setAuditDetailsCache({});
    setLoadingDetails({});
  };

  // Clear a specific cache

  const clearSpecificCache = (requestId: string) => {
    setAuditDetailsCache(prev => {
      const newCache = { ...prev };
      delete newCache[requestId];
      return newCache;
    });
    setLoadingDetails(prev => {
      const newLoading = { ...prev };
      delete newLoading[requestId];
      return newLoading;
    });
  };

  return {
    auditDetailsCache,
    loadingDetails,
    getAuditDetails,
    getBatchAuditDetails,
    clearCache,
    clearSpecificCache,
  };
}; 