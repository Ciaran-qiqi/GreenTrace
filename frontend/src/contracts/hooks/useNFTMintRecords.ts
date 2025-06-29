import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWatchContractEvent } from 'wagmi';
import { Address } from 'viem';
import { useGetUserMintRequests, getGreenTraceABI } from './useGreenTrace';
import { CONTRACT_ADDRESSES } from '../addresses';

// Nft creates a record interface

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
  transactionHash?: string; // Transaction hash, used to uniquely identify records

  source?: 'event' | 'contract'; // Data source identification

  nftTokenId?: string; // NFT Token ID (it is only available after successful casting)

}

// Cache related constants

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const CACHE_PREFIX = 'mint_records_';

// Read local cache

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

// Save to local cache

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

// Clear local cache

function clearLocalCache(address: string | undefined) {
  if (!address) return;
  try {
    const key = `${CACHE_PREFIX}${address.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('清除本地缓存失败:', err);
  }
}

// Hybrid data source hook: event listening (enable on demand) + contract query (accuracy) + cache (performance)

export const useNFTMintRecords = () => {
  const { address, isConnected } = useAccount();
  const [records, setRecords] = useState<MintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventRecords, setEventRecords] = useState<MintRecord[]>([]); // Records obtained by event listening

  const [contractRecords, setContractRecords] = useState<MintRecord[]>([]); // Records obtained by contract query

  const [eventListeningEnabled, setEventListeningEnabled] = useState(false); // Control whether event listening is enabled


  // Contract query hooks -call on top of component

  const { data: requestIds, refetch: refetchIds } = useGetUserMintRequests(address);

  // Merge data source: Event record + contract record, deduplication and priority use of contract data

  const mergeRecords = useCallback(() => {
    const merged = new Map<string, MintRecord>();
    
    // Add event records first (temporary, real-time data)

    eventRecords.forEach(record => {
      const key = record.transactionHash || `${record.tokenId}_${record.timestamp}`;
      merged.set(key, { ...record, source: 'event' });
    });
    
    // Adding the contract record (authoritative and accurate data) will overwrite the event record of the same key

    contractRecords.forEach(record => {
      const key = record.transactionHash || `${record.tokenId}_${record.timestamp}`;
      merged.set(key, { ...record, source: 'contract' });
    });
    
    // Sort by descending timestamp

    const finalRecords = Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
    
    console.log('合并数据源:', {
      eventCount: eventRecords.length,
      contractCount: contractRecords.length,
      finalCount: finalRecords.length
    });
    
    setRecords(finalRecords);
  }, [eventRecords, contractRecords]);

  // When either data source is updated, re-merge

  useEffect(() => {
    mergeRecords();
  }, [mergeRecords]);

  // Event listening enabled on demand: only listen for a short period of time after contract interaction

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'MintRequested',
    onLogs: (logs) => {
      console.log('检测到MintRequested事件:', logs);
      
      // Process events immediately and add to event records

      const newEventRecords: MintRecord[] = [];
      // Simplify event processing and add only basic information -does not rely on specific event data analysis

      if (logs.length > 0) {
        const record: MintRecord = {
          tokenId: Date.now(), // Temporarily use timestamps as id

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
        
        // The contract query is triggered after 3 seconds to obtain accurate data

        setTimeout(() => {
          refreshRecords(true);
        }, 3000);
      }
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  // Audit event listening: Update the status of existing records

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

  // Nft redemption event monitoring: Update nft status to redeemed

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
    abi: getGreenTraceABI(),
    eventName: 'NFTExchanged',
    onLogs: () => {
      console.log('创建中心检测到NFTExchanged事件，刷新合约数据');
      // Refresh data immediately to show changes in redemption status

      setTimeout(() => {
        refreshRecords(true);
      }, 1000);
    },
    enabled: isConnected && !!address && eventListeningEnabled,
  });

  // Contract query: Get all user application ids in batches, and then get details concurrently

  const fetchRecordsFromContract = useCallback(async () => {
    if (!isConnected || !address) {
      setContractRecords([]);
      return;
    }

    console.log('开始从合约获取NFT铸造记录...', { address, requestIds });
    setLoading(true);
    setError(null);

    try {
      // 1. Ensure that there is application ID data

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

      // 2. Use wagmi's readContracts to query details in batches

      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      
      const contractConfig = {
        address: CONTRACT_ADDRESSES.sepolia.GreenTrace as Address,
        abi: getGreenTraceABI(),
      };

      // Build batch query configuration  

      const contracts = idArray.map((id: bigint) => ({
        address: contractConfig.address,
        abi: contractConfig.abi as any, // Temporary handling of type issues

        functionName: 'getRequestById',
        args: [id],
      }));

      console.log('开始批量查询合约数据...');
      const results = await readContracts(config, { contracts });
      
      console.log('批量查询结果:', results);

      // 3. Convert to MintRecord format

      const mintRecords: MintRecord[] = [];
      
      results.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const item = result.result as any;
          const requestId = idArray[index];
          
          // Analysis status: 0=pending, 1=approved, 2=rejected

          let status: MintRecord['status'] = 'pending';
          if (item.status === 1) {
            // 🔍 Check the NFT casting status in detail
            // ⚠️ Simplified judgment logic: Only when the nftTokenId of application #2 is considered to have been cast

            const nftTokenId = item.nftTokenId;
            const requestIdStr = requestId.toString();
            
            // Special circumstances: Application #2 corresponds to NFT Token ID 0 (confirmed casting)

            const isSpecialCase = requestIdStr === '2' && Number(nftTokenId) === 0;
            
            // General: nft token id must be greater than 0 before it is considered to have been cast

            const isGeneralMinted = nftTokenId !== undefined && nftTokenId !== null && Number(nftTokenId) > 0;
            
            const hasNftId = isSpecialCase || isGeneralMinted;
            
            console.log(`📊 申请ID ${requestId} 状态详细检查:`, {
              '合约状态': item.status,
              '状态描述': 'Approved(1)',
              'nftTokenId原始值': nftTokenId,
              'nftTokenId类型': typeof nftTokenId,
              'nftTokenId字符串': nftTokenId?.toString(),
              'nftTokenId数值': Number(nftTokenId || 0),
              '是否有有效NFT ID': hasNftId,
              '最终状态判断': hasNftId ? 'minted' : 'approved'
            });
            
            if (hasNftId) {
              status = 'minted';
              console.log(`✅ 申请ID ${requestId} 已铸造NFT，ID: ${nftTokenId}`);
            } else {
              status = 'approved';
              console.log(`⏳ 申请ID ${requestId} 已批准但未铸造，等待铸造`);
            }
          } else if (item.status === 2) {
            status = 'rejected';
            console.log(`❌ 申请ID ${requestId} 已拒绝`);
          } else {
            console.log(`⏱️ 申请ID ${requestId} 待审核`);
          }
          
          // Get NFT Token ID information (before record creation)

          const nftTokenId = item.nftTokenId;
          const requestIdStr = requestId.toString();
          const isSpecialCase = requestIdStr === '2' && Number(nftTokenId) === 0;
          const isGeneralMinted = nftTokenId !== undefined && nftTokenId !== null && Number(nftTokenId) > 0;
          const hasNftId = isSpecialCase || isGeneralMinted;
          
          // Format data -Convert Wei to readable format

          const formatTokenAmount = (amount: bigint | string | undefined): string => {
            if (!amount) return '0';
            try {
              const value = BigInt(amount);
              // Divided by 10^18 to convert to standard units

              const formatted = Number(value) / Math.pow(10, 18);
              return formatted.toFixed(2);
            } catch {
              return '0';
            }
          };

          const record: MintRecord = {
            tokenId: Number(requestId), // Use the request id as the token id (for front-end display)

            title: item.requestData?.title || '未知标题',
            details: item.requestData?.storyDetails || '无详情',
            carbonReduction: formatTokenAmount(item.requestData?.carbonReduction), // Format carbon emission reduction

            tokenURI: item.requestData?.tokenURI || '',
            totalFee: formatTokenAmount(item.requestData?.requestFee), // Format fee

            status,
            timestamp: Number(item.requestTimestamp || 0) * 1000,
            auditor: item.auditor && item.auditor !== '0x0000000000000000000000000000000000000000' ? item.auditor : undefined,
            carbonValue: formatTokenAmount(item.carbonValue), // Format audit confirmation value

            reason: item.auditComment || undefined, // Audit opinion

            transactionHash: `request_${requestId}`, // Use the request id to generate a unique identifier

            source: 'contract',
            nftTokenId: hasNftId ? item.nftTokenId?.toString() : undefined // Add NFT Token ID

          };
          
          mintRecords.push(record);
        } else {
          console.warn(`查询申请ID ${idArray[index]} 失败:`, result);
        }
      });

      // Sort by descending timestamp (latest first)

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

  // Refresh the record, clear the cache when force=true

  const refreshRecords = useCallback(async (force = false) => {
    console.log('refreshRecords被调用', { force, address });
    if (force) {
      clearLocalCache(address);
      setEventRecords([]); // Clear event logs and start over

    }
    // First refresh the application id list, then get the details

    await refetchIds();
    fetchRecordsFromContract();
  }, [address, refetchIds, fetchRecordsFromContract]);

  // Enable event listening for a specified time (default 30 seconds)

  const enableEventListening = useCallback((duration = 30000) => {
    console.log(`启用事件监听 ${duration}ms`);
    setEventListeningEnabled(true);
    // Automatically close

    setTimeout(() => {
      console.log('自动关闭事件监听');
      setEventListeningEnabled(false);
    }, duration);
  }, []);

  // Manually close event listening

  const disableEventListening = useCallback(() => {
    console.log('手动关闭事件监听');
    setEventListeningEnabled(false);
  }, []);

  // First loading: priority is used, but listen for request ids changes

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
      // Even if there is a cache, refresh the data in the background (if the request ids are loaded)

      if (requestIds) {
        fetchRecordsFromContract();
      }
    } else {
      console.log('无缓存，从合约获取数据');
      fetchRecordsFromContract();
    }
  }, [isConnected, address, requestIds, fetchRecordsFromContract]);

  return {
    records, // The final record after the merge

    loading,
    error,
    refreshRecords,
    // Event listening control

    enableEventListening, // Enable event listening for specified time

    disableEventListening, // Manually close event listening

    isEventListening: eventListeningEnabled, // Current event listening status
    // Additional information provided for debugging and status display

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

// Maintain backward compatibility -original real-time data integration Hook  

export const useRealNFTMintRecords = () => {
  console.warn('useRealNFTMintRecords已废弃，请使用useNFTMintRecords');
  return useNFTMintRecords();
}; 