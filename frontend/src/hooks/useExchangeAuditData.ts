'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { getGreenTraceABI } from '@/contracts/hooks/useGreenTrace';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { formatTokenAmount } from '@/utils/tokenUtils';
import { readContracts } from '@wagmi/core';
import { config } from '@/lib/wagmi';

// Redemption audit application data structure

export interface ExchangeAuditRequest {
  cashId: string; // Redemption application id (real id in the contract)

  requestId: string; // Common application id, same as cash id (maintain compatibility)

  nftTokenId: string; // NFT Token ID

  requester: string; // Applicant's address

  basePrice: string; // Nft basic price

  requestFee: string; // Application fee

  blockTimestamp: string; // Application time

  transactionHash: string; // Transaction hash

  auditStatus: 'pending' | 'approved' | 'rejected'; // Audit status

  auditor?: string; // Auditor's address

  auditedCarbonValue?: string; // The redemption value confirmed by the auditor

  auditComment?: string; // Audit opinion

  auditTimestamp?: string; // Audit time

  source?: 'event' | 'contract'; // Data source identification

}

// Exchange audit statistics

export interface ExchangeAuditStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

// Cache related constants

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const EXCHANGE_AUDIT_CACHE_PREFIX = 'exchange_audit_center_';

// Read local cache

function getLocalCache(): ExchangeAuditRequest[] | null {
  try {
    const key = `${EXCHANGE_AUDIT_CACHE_PREFIX}all`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (err) {
    console.warn('读取兑换审计缓存失败:', err);
  }
  return null;
}

// Save to local cache

function saveLocalCache(data: ExchangeAuditRequest[]) {
  try {
    const key = `${EXCHANGE_AUDIT_CACHE_PREFIX}all`;
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (err) {
    console.warn('保存兑换审计缓存失败:', err);
  }
}

// Clear local cache

function clearLocalCache() {
  try {
    const key = `${EXCHANGE_AUDIT_CACHE_PREFIX}all`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除兑换审计缓存失败:', err);
  }
}

// Redeem audit data Hook: event listening (real time) + contract query (accuracy) + cache (performance)

export const useExchangeAuditData = () => {
  const { isConnected } = useAccount();
  const [exchangeAuditRequests, setExchangeAuditRequests] = useState<ExchangeAuditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [eventRecords, setEventRecords] = useState<ExchangeAuditRequest[]>([]); // Records obtained by event listening

  const [contractRecords, setContractRecords] = useState<ExchangeAuditRequest[]>([]); // Records obtained by contract query


  // Merge data source: Event record + contract record, deduplication and priority use of contract data

  const mergeRecords = useCallback(() => {
    const merged = new Map<string, ExchangeAuditRequest>();
    
    // Add event records first (temporary, real-time data)

    eventRecords.forEach(record => {
      const key = record.cashId || record.transactionHash;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // Adding the contract record (authoritative and accurate data) will overwrite the event record of the same key

    contractRecords.forEach(record => {
      const key = record.cashId || record.transactionHash;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // Sort by descending timestamp

    const finalRecords = Array.from(merged.values()).sort((a, b) => 
      parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
    );
    
    console.log('兑换审计中心合并数据源:', {
      eventCount: eventRecords.length,
      contractCount: contractRecords.length,
      finalCount: finalRecords.length
    });
    
    setExchangeAuditRequests(finalRecords);
  }, [eventRecords, contractRecords]);

  // When either data source is updated, re-merge

  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // Event monitoring: Get new redemption application immediately, providing real-time

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'ExchangeRequested',
    onLogs: (logs) => {
      console.log('兑换审计中心检测到ExchangeRequested事件:', logs);
      
      // Simplify event processing and add only basic information

      const newEventRecords: ExchangeAuditRequest[] = [];
      if (logs.length > 0) {
        const record: ExchangeAuditRequest = {
          cashId: `event_${Date.now()}`,
          requestId: `event_${Date.now()}`,
          nftTokenId: '0',
          requester: 'Unknown',
          basePrice: '0',
          requestFee: '0',
          blockTimestamp: Date.now().toString(),
          transactionHash: `exchange_event_${Date.now()}_${Math.random()}`,
          auditStatus: 'pending',
          source: 'event'
        };
        newEventRecords.push(record);
      }
      
      if (newEventRecords.length > 0) {
        console.log('兑换审计中心从事件获得新记录:', newEventRecords.length, '条');
        setEventRecords(prev => [...newEventRecords, ...prev]);
        
        // The contract query is triggered after 3 seconds to obtain accurate data

        setTimeout(() => {
          refreshExchangeAuditData(true);
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
    onLogs: (logs) => {
      // Check whether it is a redemption audit event (audit type is exchange)

      const exchangeAudits = logs.filter((log: any) => 
        log.args?.auditType === 1 // audit type.Exchange = 1

      );
      
      if (exchangeAudits.length > 0) {
        console.log('兑换审计中心检测到AuditSubmitted兑换事件，刷新合约数据');
        setTimeout(() => {
          refreshExchangeAuditData(true);
        }, 2000);
      }
    },
    enabled: isConnected,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditRejected',
    onLogs: () => {
      console.log('兑换审计中心检测到AuditRejected事件，刷新合约数据');
      setTimeout(() => {
        refreshExchangeAuditData(true);
      }, 2000);
    },
    enabled: isConnected,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTExchanged',
    onLogs: () => {
      console.log('兑换审计中心检测到NFTExchanged事件，刷新合约数据');
      setTimeout(() => {
        refreshExchangeAuditData(true);
      }, 2000);
    },
    enabled: isConnected,
  });

  // Obtain redemption audit data from the contract

  const fetchExchangeAuditRecordsFromContract = useCallback(async () => {
    if (!isConnected) return;

    setLoading(true);
    setError(null);

    try {
      console.log('开始从合约获取兑换审计数据...');

      const contractConfig = {
        address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
        abi: getGreenTraceABI(),
      };

      // 1. Obtain all redemption applications to be audited

      const pendingResult = await readContracts(config, {
        contracts: [
          {
            ...contractConfig,
            abi: contractConfig.abi as any,
            functionName: 'getPendingCashAudits',
            args: [],
          }
        ]
      });

      // 2. Obtain all audited redemption applications

      const auditedResult = await readContracts(config, {
        contracts: [
          {
            ...contractConfig,
            abi: contractConfig.abi as any,
            functionName: 'getAllAuditedCashRequests',
            args: [],
          }
        ]
      });

              const allCashIds: bigint[] = [];

      if (pendingResult[0].status === 'success' && pendingResult[0].result) {
        const pendingIds = pendingResult[0].result as bigint[];
        allCashIds.push(...pendingIds);
        console.log('待审计兑换申请ID:', pendingIds.map(id => id.toString()));
      }

      if (auditedResult[0].status === 'success' && auditedResult[0].result) {
        const auditedIds = auditedResult[0].result as bigint[];
        allCashIds.push(...auditedIds);
        console.log('已审计兑换申请ID:', auditedIds.map(id => id.toString()));
      }

      if (allCashIds.length === 0) {
        console.log('没有找到任何兑换审计申请');
        setContractRecords([]);
        saveLocalCache([]);
        setLoading(false);
        return;
      }

      console.log(`找到 ${allCashIds.length} 个兑换申请ID，开始批量查询详情...`);

      // 3. Bulk query of the details of each redemption application

      const detailContracts = allCashIds.map((id: bigint) => ({
        ...contractConfig,
        abi: contractConfig.abi as any,
        functionName: 'getCashById',
        args: [id],
      }));

      const detailResults = await readContracts(config, { contracts: detailContracts });
      
      console.log('兑换详情查询结果:', detailResults);

      // 4. Convert to ExchangeAuditRequest format

      const exchangeRecords: ExchangeAuditRequest[] = [];
      
      detailResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as Record<string, unknown>;
          const cashId = allCashIds[index];
          
          // Analysis status: 0=pending, 1=approved, 2=rejected

          let auditStatus: ExchangeAuditRequest['auditStatus'] = 'pending';
          if (item.status === 1) {
            auditStatus = 'approved';
          } else if (item.status === 2) {
            auditStatus = 'rejected';
          }
          
          console.log(`🔄 兑换审计中心 - 申请ID ${cashId} 状态检查:`, {
            '合约状态': item.status,
            '状态描述': item.status === 0 ? 'Pending(0)' : item.status === 1 ? 'Approved(1)' : 'Rejected(2)',
            '审计状态': auditStatus,
            'nftTokenId': item.nftTokenId,
            '碳价值': item.carbonValue
          });
          
          const record: ExchangeAuditRequest = {
            cashId: cashId.toString(),
            requestId: cashId.toString(), // Use cash id as request id to maintain compatibility

            nftTokenId: (item.nftTokenId as bigint).toString(),
            requester: item.requester as string || 'Unknown',
            basePrice: formatTokenAmount(item.carbonValue as bigint), // Use audited carbon value as the base price

            requestFee: formatTokenAmount((item.requestData as any)?.requestFee || BigInt(0)),
            blockTimestamp: (Number(item.requestTimestamp || 0) * 1000).toString(),
            transactionHash: `exchange_request_${cashId}`,
            auditStatus,
            auditor: item.auditor && item.auditor !== '0x0000000000000000000000000000000000000000' 
              ? item.auditor as string : undefined,
            auditedCarbonValue: formatTokenAmount(item.carbonValue as bigint),
            auditComment: item.auditComment as string || undefined,
            auditTimestamp: item.auditTimestamp && Number(item.auditTimestamp) > 0 
              ? (Number(item.auditTimestamp) * 1000).toString() : undefined,
            source: 'contract'
          };
          
          exchangeRecords.push(record);
        } else {
          console.warn(`查询兑换申请ID ${allCashIds[index]} 失败:`, result);
        }
      });

      // Sort by descending timestamp (latest first)

      exchangeRecords.sort((a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp));
      
      console.log(`成功获取 ${exchangeRecords.length} 条兑换审计记录:`, exchangeRecords);
      
      setContractRecords(exchangeRecords);
      saveLocalCache(exchangeRecords);
      
    } catch (err) {
      console.error('从合约获取兑换审计数据失败:', err);
      setError('兑换审计数据获取失败: ' + (err as Error).message);
      setContractRecords([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  // Refresh redemption audit data

  const refreshExchangeAuditData = useCallback(async (force = false) => {
    console.log('refreshExchangeAuditData被调用', { force });
    if (force) {
      clearLocalCache();
      setEventRecords([]); // Clear event logs and start over

    }
    await fetchExchangeAuditRecordsFromContract();
  }, [fetchExchangeAuditRecordsFromContract]);

  // First loading: priority cache

  useEffect(() => {
    if (!isConnected) {
      setExchangeAuditRequests([]);
      setContractRecords([]);
      setEventRecords([]);
      return;
    }

    console.log('useExchangeAuditData: 触发数据加载', { 
      isConnected,
      hasCache: !!getLocalCache()
    });
    
    const cache = getLocalCache();
    if (cache) {
      console.log('使用兑换审计缓存数据:', cache.length, '条记录');
      setContractRecords(cache);
      setLoading(false);
      // Refresh data in the background

      fetchExchangeAuditRecordsFromContract();
    } else {
      console.log('无兑换审计缓存，从合约获取数据');
      fetchExchangeAuditRecordsFromContract();
    }
  }, [isConnected, fetchExchangeAuditRecordsFromContract]);

  // Render only on the client side

  useEffect(() => { setIsClient(true); }, []);

  // Exchange audit statistics

  const getExchangeAuditStats = (): ExchangeAuditStats => {
    const pendingCount = exchangeAuditRequests.filter(req => req.auditStatus === 'pending').length;
    const approvedCount = exchangeAuditRequests.filter(req => req.auditStatus === 'approved').length;
    const rejectedCount = exchangeAuditRequests.filter(req => req.auditStatus === 'rejected').length;
    
    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      totalCount: exchangeAuditRequests.length
    };
  };

  // Obtain a redemption application to be reviewed

  const getPendingExchangeRequests = (): ExchangeAuditRequest[] => {
    return exchangeAuditRequests.filter(req => req.auditStatus === 'pending');
  };

  // Obtain redemption application for completed audits

  const getCompletedExchangeRequests = (): ExchangeAuditRequest[] => {
    return exchangeAuditRequests.filter(req => req.auditStatus === 'approved' || req.auditStatus === 'rejected');
  };

  return {
    exchangeAuditRequests, // The final record after the merge

    loading,
    error,
    isClient,
    // Refactored refresh function

    refresh: () => refreshExchangeAuditData(false), // Normal refresh: priority for cache use

    forceRefresh: () => refreshExchangeAuditData(true), // Force refresh: clear cache and re-get
    // Statistics and filtering functions

    getExchangeAuditStats,
    getPendingExchangeRequests,
    getCompletedExchangeRequests,
    // Additional information provided for debugging and status display

    eventCount: eventRecords.length,
    contractCount: contractRecords.length,
    getCacheStatus: () => {
      const cache = getLocalCache();
      return {
        hasCache: !!cache,
        cacheCount: cache?.length || 0,
        cacheValid: !!cache && (Date.now() - (localStorage.getItem(`${EXCHANGE_AUDIT_CACHE_PREFIX}all`) ? JSON.parse(localStorage.getItem(`${EXCHANGE_AUDIT_CACHE_PREFIX}all`)!).timestamp : 0) < CACHE_DURATION),
      };
    },
  };
}; 