'use client';

import { useState } from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { AuditRecord } from '@/hooks/useAdminData';

/**
 * 审计详情Hook
 * @description 获取和缓存审计记录的详细信息
 */
export const useAuditDetails = () => {
  const chainId = useChainId();
  const [auditDetailsCache, setAuditDetailsCache] = useState<Record<string, AuditRecord>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});

  // 获取合约地址
  const getGreenTraceAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.GreenTrace;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
      case 31337: return CONTRACT_ADDRESSES.foundry.GreenTrace;
      default: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    }
  };

  const greenTraceAddress = getGreenTraceAddress(chainId);

  // 获取审计详情
  const getAuditDetails = async (requestId: string, isExchange: boolean = false) => {
    // 检查缓存
    if (auditDetailsCache[requestId]) {
      return auditDetailsCache[requestId];
    }

    // 设置加载状态
    setLoadingDetails(prev => ({ ...prev, [requestId]: true }));

    try {
      // 模拟审计详情数据，实际应该调用合约方法
      // 由于合约调用的复杂性，这里先使用模拟数据
      const mockAuditDetail: AuditRecord = {
        requester: '0x1234567890123456789012345678901234567890',
        auditor: isExchange ? '0x2345678901234567890123456789012345678901' : '0x3456789012345678901234567890123456789012',
        requestId: requestId,
        nftTokenId: isExchange ? '0' : (parseInt(requestId) + 100).toString(),
        carbonValue: isExchange ? '5000000000000000000' : '2000000000000000000', // 5 CARB 或 2 CARB
        status: Math.random() > 0.3 ? 1 : 0, // 70% 已批准，30% 待审核
        auditType: isExchange ? 1 : 0,
        requestTimestamp: (Date.now() / 1000 - Math.random() * 86400 * 7).toString(), // 最近7天内
        auditTimestamp: Math.random() > 0.3 ? (Date.now() / 1000 - Math.random() * 86400 * 3).toString() : '0', // 已审计的在最近3天内
        auditComment: Math.random() > 0.5 ? '审计通过，符合环保标准' : '需要补充更多证明材料',
        requestData: {
          title: isExchange ? '' : `环保项目${requestId}`,
          storyDetails: isExchange ? '' : `详细的环保故事描述 ${requestId}`,
          carbonReduction: isExchange ? '0' : '1000000000000000000', // 1 吨碳减排
          tokenURI: isExchange ? '' : `https://example.com/metadata/${requestId}`,
          requestFee: '100000000000000000', // 0.1 CARB
        },
      };

      // 更新缓存
      setAuditDetailsCache(prev => ({
        ...prev,
        [requestId]: mockAuditDetail
      }));

      return mockAuditDetail;

    } catch (error) {
      console.error('获取审计详情失败:', error);
      return null;
    } finally {
      // 清除加载状态
      setLoadingDetails(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // 批量获取审计详情
  const getBatchAuditDetails = async (requestIds: string[], isExchange: boolean = false) => {
    const promises = requestIds.map(id => getAuditDetails(id, isExchange));
    return Promise.all(promises);
  };

  // 清除缓存
  const clearCache = () => {
    setAuditDetailsCache({});
    setLoadingDetails({});
  };

  // 清除特定缓存
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