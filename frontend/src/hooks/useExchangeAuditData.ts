'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { getGreenTraceABI } from '@/contracts/hooks/useGreenTrace';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { formatTokenAmount } from '@/utils/tokenUtils';
import { readContracts } from '@wagmi/core';
import { config } from '@/lib/wagmi';

// 兑换审计申请数据结构
export interface ExchangeAuditRequest {
  cashId: string; // 兑换申请ID（合约中的真实ID）
  requestId: string; // 通用申请ID，与cashId相同（保持兼容性）
  nftTokenId: string; // NFT Token ID
  requester: string; // 申请人地址
  basePrice: string; // NFT基础价格
  requestFee: string; // 申请手续费
  blockTimestamp: string; // 申请时间
  transactionHash: string; // 交易哈希
  auditStatus: 'pending' | 'approved' | 'rejected'; // 审计状态
  auditor?: string; // 审计员地址
  auditedCarbonValue?: string; // 审计员确认的兑换价值
  auditComment?: string; // 审计意见
  auditTimestamp?: string; // 审计时间
  source?: 'event' | 'contract'; // 数据来源标识
}

// 兑换审计统计数据
export interface ExchangeAuditStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

// 缓存相关常量
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟
const EXCHANGE_AUDIT_CACHE_PREFIX = 'exchange_audit_center_';

// 读取本地缓存
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

// 保存到本地缓存
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

// 清除本地缓存
function clearLocalCache() {
  try {
    const key = `${EXCHANGE_AUDIT_CACHE_PREFIX}all`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除兑换审计缓存失败:', err);
  }
}

// 兑换审计数据Hook：事件监听（实时性）+ 合约查询（准确性）+ 缓存（性能）
export const useExchangeAuditData = () => {
  const { isConnected } = useAccount();
  const [exchangeAuditRequests, setExchangeAuditRequests] = useState<ExchangeAuditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [eventRecords, setEventRecords] = useState<ExchangeAuditRequest[]>([]); // 事件监听获得的记录
  const [contractRecords, setContractRecords] = useState<ExchangeAuditRequest[]>([]); // 合约查询获得的记录

  // 合并数据源：事件记录 + 合约记录，去重并优先使用合约数据
  const mergeRecords = useCallback(() => {
    const merged = new Map<string, ExchangeAuditRequest>();
    
    // 先添加事件记录（临时、实时数据）
    eventRecords.forEach(record => {
      const key = record.cashId || record.transactionHash;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // 再添加合约记录（权威、准确数据），会覆盖同key的事件记录
    contractRecords.forEach(record => {
      const key = record.cashId || record.transactionHash;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // 按时间戳降序排序
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

  // 当任一数据源更新时，重新合并
  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // 事件监听：立即获取新的兑换申请，提供实时性
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'ExchangeRequested',
    onLogs: (logs) => {
      console.log('兑换审计中心检测到ExchangeRequested事件:', logs);
      
      // 简化事件处理，只添加基本信息
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
        
        // 3秒后触发合约查询，获取准确数据
        setTimeout(() => {
          refreshExchangeAuditData(true);
        }, 3000);
      }
    },
    enabled: isConnected,
  });

  // 审计事件监听：更新现有记录的状态
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditSubmitted',
    onLogs: (logs) => {
      // 检查是否是兑换审计事件（auditType为Exchange）
      const exchangeAudits = logs.filter((log: any) => 
        log.args?.auditType === 1 // AuditType.Exchange = 1
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

  // 从合约获取兑换审计数据
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

      // 1. 获取所有待审计的兑换申请
      const pendingResult = await readContracts(config, {
        contracts: [
          {
            ...contractConfig,
            functionName: 'getPendingCashAudits',
            args: [],
          }
        ]
      });

      // 2. 获取所有已审计的兑换申请
      const auditedResult = await readContracts(config, {
        contracts: [
          {
            ...contractConfig,
            functionName: 'getAllAuditedCashRequests',
            args: [],
          }
        ]
      });

      let allCashIds: bigint[] = [];

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

      // 3. 批量查询每个兑换申请的详情
      const detailContracts = allCashIds.map((id: bigint) => ({
        ...contractConfig,
        functionName: 'getCashById',
        args: [id],
      }));

      const detailResults = await readContracts(config, { contracts: detailContracts });
      
      console.log('兑换详情查询结果:', detailResults);

      // 4. 转换为ExchangeAuditRequest格式
      const exchangeRecords: ExchangeAuditRequest[] = [];
      
      detailResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as Record<string, unknown>;
          const cashId = allCashIds[index];
          
          // 解析状态：0=pending, 1=approved, 2=rejected
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
            requestId: cashId.toString(), // 使用cashId作为requestId保持兼容性
            nftTokenId: (item.nftTokenId as bigint).toString(),
            requester: item.requester as string || 'Unknown',
            basePrice: formatTokenAmount(item.carbonValue as bigint), // 使用审计后的碳价值作为基础价格
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

      // 按时间戳降序排序（最新的在前）
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

  // 刷新兑换审计数据
  const refreshExchangeAuditData = useCallback(async (force = false) => {
    console.log('refreshExchangeAuditData被调用', { force });
    if (force) {
      clearLocalCache();
      setEventRecords([]); // 清除事件记录，重新开始
    }
    await fetchExchangeAuditRecordsFromContract();
  }, [fetchExchangeAuditRecordsFromContract]);

  // 首次加载：优先用缓存
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
      // 在后台刷新数据
      fetchExchangeAuditRecordsFromContract();
    } else {
      console.log('无兑换审计缓存，从合约获取数据');
      fetchExchangeAuditRecordsFromContract();
    }
  }, [isConnected, fetchExchangeAuditRecordsFromContract]);

  // 只在客户端渲染
  useEffect(() => { setIsClient(true); }, []);

  // 兑换审计统计数据
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

  // 获取待审核兑换申请
  const getPendingExchangeRequests = (): ExchangeAuditRequest[] => {
    return exchangeAuditRequests.filter(req => req.auditStatus === 'pending');
  };

  // 获取已完成审计的兑换申请
  const getCompletedExchangeRequests = (): ExchangeAuditRequest[] => {
    return exchangeAuditRequests.filter(req => req.auditStatus === 'approved' || req.auditStatus === 'rejected');
  };

  return {
    exchangeAuditRequests, // 合并后的最终记录
    loading,
    error,
    isClient,
    // 重构后的刷新函数
    refresh: () => refreshExchangeAuditData(false), // 普通刷新：优先使用缓存
    forceRefresh: () => refreshExchangeAuditData(true), // 强制刷新：清缓存重新获取
    // 统计和筛选函数
    getExchangeAuditStats,
    getPendingExchangeRequests,
    getCompletedExchangeRequests,
    // 额外提供的信息，用于调试和状态展示
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