'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { getGreenTraceABI } from '@/contracts/hooks/useGreenTrace';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import { formatTokenAmount } from '@/utils/tokenUtils';

// 审计申请数据结构
export interface AuditRequest {
  requestId: string; // 申请ID（合约中的真实ID）
  tokenId: string; // 用于显示的ID（保持兼容性）
  requester: string;
  title: string;
  details: string;
  carbonReduction: string; // 用户原始申请的碳减排量
  auditedCarbonValue?: string; // 审计员确认的碳减排量（只有approved状态才有）
  tokenURI: string;
  totalFee: string;
  blockTimestamp: string;
  transactionHash: string;
  auditStatus: 'pending' | 'approved' | 'rejected';
  auditor?: string; // 审计员地址
  auditComment?: string; // 审计意见
  nftTokenId?: string; // 真实的NFT ID（铸造成功后才有）
  source?: 'event' | 'contract'; // 数据来源标识
}

// 审计统计数据
export interface AuditStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

// 缓存相关常量
const CACHE_DURATION = 30 * 60 * 1000; // 30分钟
const AUDIT_CACHE_PREFIX = 'audit_center_';

// 读取本地缓存
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

// 保存到本地缓存
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

// 清除本地缓存
function clearLocalCache() {
  try {
    const key = `${AUDIT_CACHE_PREFIX}all`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除审计中心缓存失败:', err);
  }
}

// 混合数据源hook：事件监听（实时性）+ 合约查询（准确性）+ 缓存（性能）
export const useAuditData = () => {
  const { isConnected } = useAccount();
  const [auditRequests, setAuditRequests] = useState<AuditRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [eventRecords, setEventRecords] = useState<AuditRequest[]>([]); // 事件监听获得的记录
  const [contractRecords, setContractRecords] = useState<AuditRequest[]>([]); // 合约查询获得的记录

  // 合并数据源：事件记录 + 合约记录，去重并优先使用合约数据
  const mergeRecords = useCallback(() => {
    const merged = new Map<string, AuditRequest>();
    
    // 先添加事件记录（临时、实时数据）
    eventRecords.forEach(record => {
      const key = record.requestId || record.transactionHash;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // 再添加合约记录（权威、准确数据），会覆盖同key的事件记录
    contractRecords.forEach(record => {
      const key = record.requestId || record.transactionHash;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // 按时间戳降序排序
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

  // 当任一数据源更新时，重新合并
  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // 格式化数据 - 使用统一的代币格式化工具
  // 移除本地formatTokenAmount函数，使用utils/tokenUtils.ts中的统一实现

  // 事件监听：立即获取新申请，提供实时性
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'MintRequested',
    onLogs: (logs) => {
      console.log('审计中心检测到MintRequested事件:', logs);
      
      // 简化事件处理，只添加基本信息
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
        
        // 3秒后触发合约查询，获取准确数据
        setTimeout(() => {
          refreshAuditData(true);
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

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTMintedAfterAudit',
    onLogs: () => {
      console.log('审计中心检测到NFTMintedAfterAudit事件，刷新合约数据');
      setTimeout(() => {
        refreshAuditData(true);
      }, 2000);
    },
    enabled: isConnected,
  });

  // 合约查询：获取待审计申请 + 已审计申请
  const fetchAuditRecordsFromContract = useCallback(async () => {
    if (!isConnected) {
      setContractRecords([]);
      return;
    }

    console.log('开始从合约获取审计数据...');
    setLoading(true);
    setError(null);

    try {
      // 使用wagmi的readContracts批量查询
      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      
      const contractConfig = {
        address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
        abi: getGreenTraceABI() as any,
      };

      // 1. 获取待审计申请ID列表
      const pendingResult = await readContracts(config, { 
        contracts: [{
          ...contractConfig,
          functionName: 'getPendingMintAudits',
          args: [],
        }]
      });

      // 2. 获取已审计申请ID列表
      const auditedResult = await readContracts(config, { 
        contracts: [{
          ...contractConfig,
          functionName: 'getAllAuditedMintRequests',
          args: [],
        }]
      });

      console.log('查询结果:', { pendingResult, auditedResult });

      // 合并所有申请ID
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

      // 3. 批量查询每个申请的详情
      const detailContracts = allRequestIds.map((id: bigint) => ({
        ...contractConfig,
        functionName: 'getRequestById',
        args: [id],
      }));

      const detailResults = await readContracts(config, { contracts: detailContracts });
      
      console.log('详情查询结果:', detailResults);

      // 4. 转换为AuditRequest格式
      const auditRecords: AuditRequest[] = [];
      
      detailResults.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as Record<string, unknown>;
          const requestId = allRequestIds[index];
          
          // 解析状态：0=pending, 1=approved, 2=rejected
          let auditStatus: AuditRequest['auditStatus'] = 'pending';
          if (item.status === 1) {
            auditStatus = 'approved';
          } else if (item.status === 2) {
            auditStatus = 'rejected';
          }
          
          const record: AuditRequest = {
            requestId: requestId.toString(),
            tokenId: requestId.toString(), // 使用申请ID作为显示ID
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
            nftTokenId: item.nftTokenId && Number(item.nftTokenId) > 0 
              ? (item.nftTokenId as bigint).toString() : undefined,
            source: 'contract'
          };
          
          auditRecords.push(record);
        } else {
          console.warn(`查询申请ID ${allRequestIds[index]} 失败:`, result);
        }
      });

      // 按时间戳降序排序（最新的在前）
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

  // 刷新审计数据
  const refreshAuditData = useCallback(async (force = false) => {
    console.log('refreshAuditData被调用', { force });
    if (force) {
      clearLocalCache();
      setEventRecords([]); // 清除事件记录，重新开始
    }
    await fetchAuditRecordsFromContract();
  }, [fetchAuditRecordsFromContract]);

  // 首次加载：优先用缓存
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
      // 在后台刷新数据
      fetchAuditRecordsFromContract();
    } else {
      console.log('无缓存，从合约获取数据');
      fetchAuditRecordsFromContract();
    }
  }, [isConnected, fetchAuditRecordsFromContract]);

  // 只在客户端渲染
  useEffect(() => { setIsClient(true); }, []);

  // 审计统计数据
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

  // 获取待审核申请
  const getPendingRequests = (): AuditRequest[] => {
    return auditRequests.filter(req => req.auditStatus === 'pending');
  };

  // 获取已完成审计的申请
  const getCompletedRequests = (): AuditRequest[] => {
    return auditRequests.filter(req => req.auditStatus === 'approved' || req.auditStatus === 'rejected');
  };

  return {
    auditRequests, // 合并后的最终记录
    loading,
    error,
    isClient,
    // 重构后的刷新函数
    refresh: () => refreshAuditData(false), // 普通刷新：优先使用缓存
    forceRefresh: () => refreshAuditData(true), // 强制刷新：清缓存重新获取
    // 统计和筛选函数
    getAuditStats,
    getPendingRequests,
    getCompletedRequests,
    // 额外提供的信息，用于调试和状态展示
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