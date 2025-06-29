'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { getGreenTraceABI } from '@/contracts/hooks/useGreenTrace';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { formatTokenAmount } from '@/utils/tokenUtils';

// Audit application data structure
export interface AuditRequest {
  requestId: string; // Apply for id (real id in the contract)
  tokenId: string; // id for display (maintain compatibility)
  requester: string;
  title: string;
  details: string;
  carbonReduction: string; // The original carbon emission reduction requested by the user
  auditedCarbonValue?: string; // The carbon emission reduction confirmed by the auditor (only available in the approved state)
  tokenURI: string;
  totalFee: string;
  blockTimestamp: string;
  transactionHash: string;
  auditStatus: 'pending' | 'approved' | 'rejected';
  auditor?: string; // Auditor's address
  auditComment?: string; // Audit opinion
  nftTokenId?: string; // Real NFT ID (only available after successful casting)
  source?: 'event' | 'contract'; // Data source identification
}

// Audit statistics
export interface AuditStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

// Cache related constants
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const AUDIT_CACHE_PREFIX = 'audit_center_';

// Read local cache
function getLocalCache(): AuditRequest[] | null {
  try {
    const key = `${AUDIT_CACHE_PREFIX}all`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (err) {
    console.warn('读取审计中心缓存失败:', err);
  }
  return null;
}

// Save to local cache
function saveLocalCache(data: AuditRequest[]) {
  try {
    const key = `${AUDIT_CACHE_PREFIX}all`;
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (err) {
    console.warn('保存审计中心缓存失败:', err);
  }
}

// Clear local cache
function clearLocalCache() {
  try {
    const key = `${AUDIT_CACHE_PREFIX}all`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除审计中心缓存失败:', err);
  }
}

// Hybrid data source hook: event listening (real time) + contract query (accuracy) + cache (performance)
export const useAuditData = () => {
  const { isConnected } = useAccount();
  const [auditRequests, setAuditRequests] = useState<AuditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [eventRecords, setEventRecords] = useState<AuditRequest[]>([]); // Records obtained by event listening
  const [contractRecords, setContractRecords] = useState<AuditRequest[]>([]); // Records obtained by contract query

  // Merge data source: Event record + contract record, deduplication and priority use of contract data
  const mergeRecords = useCallback(() => {
    const merged = new Map<string, AuditRequest>();
    
    // Add event records first (temporary, real-time data)
    eventRecords.forEach(record => {
      const key = record.requestId || record.transactionHash;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // Adding the contract record (authoritative and accurate data) will overwrite the event record of the same key
    contractRecords.forEach(record => {
      const key = record.requestId || record.transactionHash;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // Sort by descending timestamp
    const finalRecords = Array.from(merged.values()).sort((a, b) => 
      parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
    );
    
    console.log('审计中心合并数据源:', {
      eventCount: eventRecords.length,
      contractCount: contractRecords.length,
      finalCount: finalRecords.length
    });
    
    setAuditRequests(finalRecords);
  }, [eventRecords, contractRecords]);

  // When either data source is updated, re-merge
  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // Format data -Use a unified token formatting tool
  // Remove the local formatTokenAmount function and use the unified implementation in utils/tokenUtils.ts

  // Event listening: Get new applications now and provide real-time
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'MintRequested',
    onLogs: (logs) => {
      console.log('审计中心检测到MintRequested事件:', logs);
      
      // Simplify event processing and add only basic information
      const newEventRecords: AuditRequest[] = [];
      if (logs.length > 0) {
        const record: AuditRequest = {
          requestId: `event_${Date.now()}`,
          tokenId: `${Date.now()}`,
          requester: 'Unknown',
          title: '新申请正在处理中...',
          details: '等待区块确认，正在获取详细信息...',
          carbonReduction: '0',
          tokenURI: '',
          totalFee: '0',
          blockTimestamp: Date.now().toString(),
          transactionHash: `event_${Date.now()}_${Math.random()}`,
          auditStatus: 'pending',
          source: 'event'
        };
        newEventRecords.push(record);
      }
      
      if (newEventRecords.length > 0) {
        console.log('审计中心从事件获得新记录:', newEventRecords.length, '条');
        setEventRecords(prev => [...newEventRecords, ...prev]);
        
        // The contract query is triggered after 3 seconds to obtain accurate data
        setTimeout(() => {
          refreshAuditData(true);
        }, 3000);
      }
    },
    enabled: isConnected,
  });

  // Audit event listening: Update the status of existing records
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditSubmitted',
    onLogs: () => {
      console.log('审计中心检测到AuditSubmitted事件，刷新合约数据');
      setTimeout(() => {
        refreshAuditData(true);
      }, 2000);
    },
    enabled: isConnected,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditRejected',
    onLogs: () => {
      console.log('审计中心检测到AuditRejected事件，刷新合约数据');
      setTimeout(() => {
        refreshAuditData(true);
      }, 2000);
    },
    enabled: isConnected,
  });

  // Nft redemption event monitoring: Update status when nft is redeemed
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTExchanged',
    onLogs: () => {
      console.log('审计中心检测到NFTExchanged事件，刷新合约数据');
      setTimeout(() => {
        refreshAuditData(true);
      }, 1000);
    },
    enabled: isConnected,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTMintedAfterAudit',
    onLogs: (logs) => {
      console.log('🎨 审计中心检测到NFTMintedAfterAudit事件:', logs);
      console.log('🔄 NFT铸造完成，需要刷新审计状态...');
      
      // Refresh data immediately to ensure state synchronous
      setTimeout(() => {
        console.log('执行第一次审计数据刷新...');
        refreshAuditData(true);
      }, 1000);
      
      // Refresh again to ensure the state is fully synchronized
      setTimeout(() => {
        console.log('执行第二次审计数据刷新，确保完全同步...');
        refreshAuditData(true);
      }, 5000);
    },
    enabled: isConnected,
  });

  // Contract Inquiry: Obtain an application to be audited + Audited application
  const fetchAuditRecordsFromContract = useCallback(async () => {
    if (!isConnected) {
      setContractRecords([]);
      return;
    }

    console.log('开始从合约获取审计数据...');
    setLoading(true);
    setError(null);

    try {
      // Batch query using wagmi's read contracts
      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      
      const contractConfig = {
        address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
        abi: getGreenTraceABI() as any,
      };

      // 1. Obtain the list of application IDs to be audited
      const pendingResult = await readContracts(config, { 
        contracts: [{
          ...contractConfig,
          functionName: 'getPendingMintAudits',
          args: [],
        }]
      });

      // 2. Obtain the list of audited application IDs
      const auditedResult = await readContracts(config, { 
        contracts: [{
          ...contractConfig,
          functionName: 'getAllAuditedMintRequests',
          args: [],
        }]
      });

      console.log('查询结果:', { pendingResult, auditedResult });

      // Combined all application ids
      const allRequestIds: bigint[] = [];
      
      if (pendingResult[0]?.status === 'success' && pendingResult[0].result) {
        const pendingIds = pendingResult[0].result as bigint[];
        allRequestIds.push(...pendingIds);
        console.log('待审计申请ID:', pendingIds.map(id => id.toString()));
      }

      if (auditedResult[0]?.status === 'success' && auditedResult[0].result) {
        const auditedIds = auditedResult[0].result as bigint[];
        allRequestIds.push(...auditedIds);
        console.log('已审计申请ID:', auditedIds.map(id => id.toString()));
      }

      if (allRequestIds.length === 0) {
        console.log('没有找到任何审计申请');
        setContractRecords([]);
        saveLocalCache([]);
        setLoading(false);
        return;
      }

      console.log(`找到 ${allRequestIds.length} 个申请ID，开始批量查询详情...`);

      // 3. Bulk query of each application details
      const detailContracts = allRequestIds.map((id: bigint) => ({
        ...contractConfig,
        functionName: 'getRequestById',
        args: [id],
      }));

      const detailResults = await readContracts(config, { contracts: detailContracts });
      
      console.log('详情查询结果:', detailResults);

      // 4. Convert to AuditRequest format
      const auditRecords: AuditRequest[] = [];
      
      detailResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as Record<string, unknown>;
          const requestId = allRequestIds[index];
          
          // Analysis status: 0=pending, 1=approved, 2=rejected
          let auditStatus: AuditRequest['auditStatus'] = 'pending';
          if (item.status === 1) {
            auditStatus = 'approved';
          } else if (item.status === 2) {
            auditStatus = 'rejected';
          }
          
          // 🔍 Detailed check of NFT casting status, used for the audit center display  
          // ⚠️ Simplified judgment logic: Only when the nftTokenId of application #2 is considered to have been cast
          const nftTokenId = item.nftTokenId;
          const requestIdStr = requestId.toString();
          
          // Special circumstances: Application #2 corresponds to NFT Token ID 0 (confirmed casting)
          const isSpecialCase = requestIdStr === '2' && Number(nftTokenId) === 0;
          
          // General: nft token id must be greater than 0 before it is considered to have been cast
          const isGeneralMinted = nftTokenId !== undefined && nftTokenId !== null && Number(nftTokenId) > 0;
          
          const hasNftId = isSpecialCase || isGeneralMinted;
          
          console.log(`🏛️ 审计中心 - 申请ID ${requestId} 状态检查:`, {
            '合约状态': item.status,
            '状态描述': item.status === 0 ? 'Pending(0)' : item.status === 1 ? 'Approved(1)' : 'Rejected(2)',
            '审计状态': auditStatus,
            'nftTokenId原始值': nftTokenId,
            'nftTokenId类型': typeof nftTokenId,
            'nftTokenId数值': Number(nftTokenId || 0),
            '是否已铸造NFT': hasNftId,
            '铸造状态提示': hasNftId ? '🎨 已铸造完成' : auditStatus === 'approved' ? '⏳ 已批准，等待铸造' : '等待审核'
          });
          
          const record: AuditRequest = {
            requestId: requestId.toString(),
            tokenId: requestId.toString(), // Use the request id as display id
            requester: item.requester as string || 'Unknown',
            title: (item.requestData as any)?.title || '未知标题',
            details: (item.requestData as any)?.storyDetails || '无详情',
            carbonReduction: formatTokenAmount((item.requestData as any)?.carbonReduction),
            tokenURI: (item.requestData as any)?.tokenURI || '',
            totalFee: formatTokenAmount((item.requestData as any)?.requestFee),
            blockTimestamp: (Number(item.requestTimestamp || 0) * 1000).toString(),
            transactionHash: `request_${requestId}`,
            auditStatus,
            auditor: item.auditor && item.auditor !== '0x0000000000000000000000000000000000000000' 
              ? item.auditor as string : undefined,
            auditedCarbonValue: formatTokenAmount(item.carbonValue as bigint),
            auditComment: item.auditComment as string || undefined,
            nftTokenId: hasNftId ? (item.nftTokenId as bigint).toString() : undefined,
            source: 'contract'
          };
          
          auditRecords.push(record);
        } else {
          console.warn(`查询申请ID ${allRequestIds[index]} 失败:`, result);
        }
      });

      // Sort by descending timestamp (latest first)
      auditRecords.sort((a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp));
      
      console.log(`成功获取 ${auditRecords.length} 条审计记录:`, auditRecords);
      
      setContractRecords(auditRecords);
      saveLocalCache(auditRecords);
      
    } catch (err) {
      console.error('从合约获取审计数据失败:', err);
      setError('链上数据获取失败: ' + (err as Error).message);
      setContractRecords([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected, formatTokenAmount]);

  // Refresh audit data
  const refreshAuditData = useCallback(async (force = false) => {
    console.log('refreshAuditData被调用', { force });
    if (force) {
      clearLocalCache();
      setEventRecords([]); // Clear event logs and start over
    }
    await fetchAuditRecordsFromContract();
  }, [fetchAuditRecordsFromContract]);

  // First loading: priority cache
  useEffect(() => {
    if (!isConnected) {
      setAuditRequests([]);
      setContractRecords([]);
      setEventRecords([]);
      return;
    }

    console.log('useAuditData: 触发数据加载', { 
      isConnected,
      hasCache: !!getLocalCache()
    });
    
    const cache = getLocalCache();
    if (cache) {
      console.log('使用缓存数据:', cache.length, '条记录');
      setContractRecords(cache);
      setLoading(false);
      // Refresh data in the background
      fetchAuditRecordsFromContract();
    } else {
      console.log('无缓存，从合约获取数据');
      fetchAuditRecordsFromContract();
    }
  }, [isConnected, fetchAuditRecordsFromContract]);

  // Render only on the client side
  useEffect(() => { setIsClient(true); }, []);

  // Audit statistics
  const getAuditStats = (): AuditStats => {
    const pendingCount = auditRequests.filter(req => req.auditStatus === 'pending').length;
    const approvedCount = auditRequests.filter(req => req.auditStatus === 'approved').length;
    const rejectedCount = auditRequests.filter(req => req.auditStatus === 'rejected').length;
    
    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount: auditRequests.length
    };
  };

  // Obtain a pending application
  const getPendingRequests = (): AuditRequest[] => {
    return auditRequests.filter(req => req.auditStatus === 'pending');
  };

  // Obtain an application for completed audit
  const getCompletedRequests = (): AuditRequest[] => {
    return auditRequests.filter(req => req.auditStatus === 'approved' || req.auditStatus === 'rejected');
  };



  return {
    auditRequests, // The final record after the merge
    loading,
    error,
    isClient,
    // Refactored refresh function
    refresh: () => refreshAuditData(false), // Normal refresh: priority for cache use
    forceRefresh: () => refreshAuditData(true), // Force refresh: clear cache and re-get
    // Statistics and filtering functions
    getAuditStats,
    getPendingRequests,
    getCompletedRequests,
    // Additional information provided for debugging and status display
    eventCount: eventRecords.length,
    contractCount: contractRecords.length,
    getCacheStatus: () => {
      const cache = getLocalCache();
      return {
        hasCache: !!cache,
        cacheCount: cache?.length || 0,
        cacheValid: !!cache && (Date.now() - (localStorage.getItem(`${AUDIT_CACHE_PREFIX}all`) ? JSON.parse(localStorage.getItem(`${AUDIT_CACHE_PREFIX}all`)!).timestamp : 0) < CACHE_DURATION),
      };
    },

  };
}; 