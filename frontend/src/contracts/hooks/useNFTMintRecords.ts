import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { useGetUserMintRequests, getGreenTraceABI } from './useGreenTrace';
import { CONTRACT_ADDRESSES } from '../addresses';

// NFT创建记录接口
export interface MintRecord {
  tokenId: number;
  title: string;
  details: string;
  carbonReduction: string;
  tokenURI: string;
  totalFee: string;
  status: 'pending' | 'approved' | 'rejected' | 'minted';
  timestamp: number;
  auditor?: string;
  carbonValue?: string;
  reason?: string;
  transactionHash?: string; // 交易哈希，用于唯一标识记录
  source?: 'event' | 'contract'; // 数据来源标识
}

// 缓存相关常量
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时
const CACHE_PREFIX = 'mint_records_';

// 读取本地缓存
function getLocalCache(address: string | undefined): MintRecord[] | null {
  if (!address) return null;
  try {
    const key = `${CACHE_PREFIX}${address.toLowerCase()}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (err) {
    console.warn('读取本地缓存失败:', err);
  }
  return null;
}

// 保存到本地缓存
function saveLocalCache(address: string | undefined, data: MintRecord[]) {
  if (!address) return;
  try {
    const key = `${CACHE_PREFIX}${address.toLowerCase()}`;
    const cacheData = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (err) {
    console.warn('保存本地缓存失败:', err);
  }
}

// 清除本地缓存
function clearLocalCache(address: string | undefined) {
  if (!address) return;
  try {
    const key = `${CACHE_PREFIX}${address.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除本地缓存失败:', err);
  }
}

// 混合数据源hook：事件监听（按需启用）+ 合约查询（准确性）+ 缓存（性能）
export const useNFTMintRecords = () => {
  const { address, isConnected } = useAccount();
  const [records, setRecords] = useState<MintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventRecords, setEventRecords] = useState<MintRecord[]>([]); // 事件监听获得的记录
  const [contractRecords, setContractRecords] = useState<MintRecord[]>([]); // 合约查询获得的记录
  const [eventListeningEnabled, setEventListeningEnabled] = useState(false); // 控制事件监听是否启用

  // 合约查询hooks - 在组件顶层调用
  const { data: requestIds, refetch: refetchIds } = useGetUserMintRequests(address);

  // 合并数据源：事件记录 + 合约记录，去重并优先使用合约数据
  const mergeRecords = useCallback(() => {
    const merged = new Map<string, MintRecord>();
    
    // 先添加事件记录（临时、实时数据）
    eventRecords.forEach(record => {
      const key = record.transactionHash || `${record.tokenId}_${record.timestamp}`;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // 再添加合约记录（权威、准确数据），会覆盖同key的事件记录
    contractRecords.forEach(record => {
      const key = record.transactionHash || `${record.tokenId}_${record.timestamp}`;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // 按时间戳降序排序
    const finalRecords = Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
    
    console.log('合并数据源:', {
      eventCount: eventRecords.length,
      contractCount: contractRecords.length,
      finalCount: finalRecords.length
    });
    
    setRecords(finalRecords);
  }, [eventRecords, contractRecords]);

  // 当任一数据源更新时，重新合并
  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // 按需启用的事件监听：只在合约交互后短时间内监听
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'MintRequested',
    onLogs: (logs) => {
      console.log('检测到MintRequested事件:', logs);
      
      // 立即处理事件，添加到事件记录中
      const newEventRecords: MintRecord[] = [];
      // 简化事件处理，只添加基本信息 - 不依赖具体的事件数据解析
      if (logs.length > 0) {
        const record: MintRecord = {
          tokenId: Date.now(), // 临时使用时间戳作为ID
          title: '新申请正在处理中...',
          details: '等待区块确认，正在获取详细信息...',
          carbonReduction: '0',
          tokenURI: '',
          totalFee: '0',
          status: 'pending',
          timestamp: Date.now(),
          transactionHash: `event_${Date.now()}_${Math.random()}`,
          source: 'event'
        };
        newEventRecords.push(record);
      }
      
      if (newEventRecords.length > 0) {
        console.log('从事件获得新记录:', newEventRecords.length, '条');
        setEventRecords(prev => [...newEventRecords, ...prev]);
        
        // 3秒后触发合约查询，获取准确数据
        setTimeout(() => {
          refreshRecords(true);
        }, 3000);
      }
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  // 审计事件监听：更新现有记录的状态
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditSubmitted',
    onLogs: () => {
      console.log('检测到AuditSubmitted事件，刷新合约数据');
      setTimeout(() => {
        refreshRecords(true);
      }, 2000);
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'AuditRejected',
    onLogs: () => {
      console.log('检测到AuditRejected事件，刷新合约数据');
      setTimeout(() => {
        refreshRecords(true);
      }, 2000);
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTMintedAfterAudit',
    onLogs: () => {
      console.log('检测到NFTMintedAfterAudit事件，刷新合约数据');
      setTimeout(() => {
        refreshRecords(true);
      }, 2000);
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  // 合约查询：批量获取用户所有申请ID，再并发获取详情
  const fetchRecordsFromContract = useCallback(async () => {
    if (!isConnected || !address) {
      setContractRecords([]);
      return;
    }

    console.log('开始从合约获取NFT铸造记录...', { address, requestIds });
    setLoading(true);
    setError(null);

    try {
      // 1. 确保有申请ID数据
      let idArray = requestIds;
      if (!idArray) {
        console.log('requestIds为空，尝试重新获取...');
        const refetchResult = await refetchIds();
        idArray = refetchResult.data;
      }

      if (!idArray || !Array.isArray(idArray) || idArray.length === 0) {
        console.log('用户没有NFT铸造申请记录');
        setContractRecords([]);
        saveLocalCache(address, []);
        setLoading(false);
        return;
      }

      console.log(`找到 ${idArray.length} 个申请ID:`, idArray.map(id => id.toString()));

      // 2. 使用wagmi的readContracts批量查询详情
      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      
      const contractConfig = {
        address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
        abi: getGreenTraceABI(),
      };

      // 构建批量查询配置  
      const contracts = idArray.map((id: bigint) => ({
        address: contractConfig.address,
        abi: contractConfig.abi as any, // 临时处理类型问题
        functionName: 'getRequestById',
        args: [id],
      }));

      console.log('开始批量查询合约数据...');
      const results = await readContracts(config, { contracts });
      
      console.log('批量查询结果:', results);

      // 3. 转换为MintRecord格式
      const mintRecords: MintRecord[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as any;
          const requestId = idArray[index];
          
          // 解析状态：0=pending, 1=approved, 2=rejected
          let status: MintRecord['status'] = 'pending';
          if (item.status === 1) {
            // 如果已批准且有NFT ID，则检查是否已铸造
            if (item.nftTokenId && Number(item.nftTokenId) > 0) {
              status = 'minted';
            } else {
              status = 'approved';
            }
          } else if (item.status === 2) {
            status = 'rejected';
          }
          
          // 格式化数据 - 将Wei转换为可读格式
          const formatTokenAmount = (amount: bigint | string | undefined): string => {
            if (!amount) return '0';
            try {
              const value = BigInt(amount);
              // 除以10^18转换为标准单位
              const formatted = Number(value) / Math.pow(10, 18);
              return formatted.toFixed(2);
            } catch {
              return '0';
            }
          };

          const record: MintRecord = {
            tokenId: Number(requestId), // 使用申请ID作为tokenId（前端显示用）
            title: item.requestData?.title || '未知标题',
            details: item.requestData?.storyDetails || '无详情',
            carbonReduction: formatTokenAmount(item.requestData?.carbonReduction), // 格式化碳减排量
            tokenURI: item.requestData?.tokenURI || '',
            totalFee: formatTokenAmount(item.requestData?.requestFee), // 格式化费用
            status,
            timestamp: Number(item.requestTimestamp || 0) * 1000,
            auditor: item.auditor && item.auditor !== '0x0000000000000000000000000000000000000000' ? item.auditor : undefined,
            carbonValue: formatTokenAmount(item.carbonValue), // 格式化审计确认价值
            reason: item.auditComment || undefined, // 审计意见
            transactionHash: `request_${requestId}`, // 使用申请ID生成唯一标识
            source: 'contract'
          };
          
          mintRecords.push(record);
        } else {
          console.warn(`查询申请ID ${idArray[index]} 失败:`, result);
        }
      });

      // 按时间戳降序排序（最新的在前）
      mintRecords.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`成功获取 ${mintRecords.length} 条NFT铸造记录:`, mintRecords);
      
      setContractRecords(mintRecords);
      saveLocalCache(address, mintRecords);
      
    } catch (err) {
      console.error('从合约获取NFT记录失败:', err);
      setError('链上数据获取失败: ' + (err as Error).message);
      setContractRecords([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, requestIds, refetchIds]);

  // 刷新记录，force=true时清除缓存
  const refreshRecords = useCallback(async (force = false) => {
    console.log('refreshRecords被调用', { force, address });
    if (force) {
      clearLocalCache(address);
      setEventRecords([]); // 清除事件记录，重新开始
    }
    // 先刷新申请ID列表，再获取详情
    await refetchIds();
    fetchRecordsFromContract();
  }, [address, refetchIds, fetchRecordsFromContract]);

  // 启用事件监听，持续指定时间（默认30秒）
  const enableEventListening = useCallback((duration = 30000) => {
    console.log(`启用事件监听 ${duration}ms`);
    setEventListeningEnabled(true);
    // 自动关闭
    setTimeout(() => {
      console.log('自动关闭事件监听');
      setEventListeningEnabled(false);
    }, duration);
  }, []);

  // 手动关闭事件监听
  const disableEventListening = useCallback(() => {
    console.log('手动关闭事件监听');
    setEventListeningEnabled(false);
  }, []);

  // 首次加载：优先用缓存，但要监听requestIds变化
  useEffect(() => {
    if (!isConnected || !address) {
      setRecords([]);
      setContractRecords([]);
      setEventRecords([]);
      return;
    }

    console.log('useNFTMintRecords: 触发数据加载', { 
      isConnected, 
      address, 
      requestIds: Array.isArray(requestIds) ? requestIds.length : 0,
      hasCache: !!getLocalCache(address)
    });
    
    const cache = getLocalCache(address);
    if (cache) {
      console.log('使用缓存数据:', cache.length, '条记录');
      setContractRecords(cache);
      setLoading(false);
      // 即使有缓存，也在后台刷新数据（如果requestIds已加载）
      if (requestIds) {
        fetchRecordsFromContract();
      }
    } else {
      console.log('无缓存，从合约获取数据');
      fetchRecordsFromContract();
    }
  }, [isConnected, address, requestIds, fetchRecordsFromContract]);

  return {
    records, // 合并后的最终记录
    loading,
    error,
    refreshRecords,
    // 事件监听控制
    enableEventListening, // 启用事件监听指定时间
    disableEventListening, // 手动关闭事件监听
    isEventListening: eventListeningEnabled, // 当前事件监听状态
    // 额外提供的信息，用于调试和状态展示
    eventCount: eventRecords.length,
    contractCount: contractRecords.length,
    getCacheStatus: () => {
      const cache = getLocalCache(address);
      return {
        hasCache: !!cache,
        cacheCount: cache?.length || 0,
        cacheValid: !!cache && (Date.now() - (localStorage.getItem(`${CACHE_PREFIX}${address?.toLowerCase()}`) ? JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${address?.toLowerCase()}`)!).timestamp : 0) < CACHE_DURATION),
      };
    },
  };
};

// 保持向后兼容性 - 原来的实时数据集成Hook  
export const useRealNFTMintRecords = () => {
  console.warn('useRealNFTMintRecords已废弃，请使用useNFTMintRecords');
  return useNFTMintRecords();
}; 