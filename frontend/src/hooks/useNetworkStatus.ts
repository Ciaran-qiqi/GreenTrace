import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

// 网络状态接口
export interface NetworkStatus {
  isOnline: boolean;
  rpcStatus: 'healthy' | 'degraded' | 'failed';
  lastError: string | null;
  retryCount: number;
  canRetry: boolean;
}

// RPC节点健康检查
const checkRPCHealth = async (rpcUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000), // 5秒超时
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.result !== undefined;
  } catch {
    return false;
  }
};

// 网络状态管理Hook
export const useNetworkStatus = () => {
  const { isConnected } = useAccount();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    rpcStatus: 'healthy',
    lastError: null,
    retryCount: 0,
    canRetry: true,
  });

  // 检测浏览器网络状态
  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: true,
        rpcStatus: 'healthy',
        lastError: null,
      }));
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({
        ...prev,
        isOnline: false,
        rpcStatus: 'failed',
        lastError: '网络连接已断开',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // RPC节点健康检查
  const checkRPCNodes = useCallback(async () => {
    if (!networkStatus.isOnline || !isConnected) {
      return;
    }

    const rpcUrls = [
      process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL,
      process.env.SEPOLIA_RPC_URL,
      'https://rpc.sepolia.ethpandaops.io',
    ].filter(Boolean);

    let healthyNodes = 0;
    const healthChecks = await Promise.allSettled(
      rpcUrls.map(url => checkRPCHealth(url!))
    );

    healthChecks.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        healthyNodes++;
      }
    });

    const totalNodes = rpcUrls.length;
    const healthRatio = healthyNodes / totalNodes;

    setNetworkStatus(prev => ({
      ...prev,
      rpcStatus: healthRatio >= 0.7 ? 'healthy' : 
                 healthRatio >= 0.3 ? 'degraded' : 'failed',
      lastError: healthRatio === 0 ? '所有RPC节点均不可用' : null,
    }));
  }, [networkStatus.isOnline, isConnected]);

  // 定期检查RPC节点健康状态
  useEffect(() => {
    // 立即检查一次
    checkRPCNodes();

    // 每30秒检查一次
    const interval = setInterval(checkRPCNodes, 30000);

    return () => clearInterval(interval);
  }, [checkRPCNodes]);

  // 记录网络错误
  const recordNetworkError = useCallback((error: string) => {
    setNetworkStatus(prev => ({
      ...prev,
      lastError: error,
      retryCount: prev.retryCount + 1,
      canRetry: prev.retryCount < 5, // 最多重试5次
      rpcStatus: 'degraded',
    }));
  }, []);

  // 重置错误状态
  const resetNetworkStatus = useCallback(() => {
    setNetworkStatus(prev => ({
      ...prev,
      lastError: null,
      retryCount: 0,
      canRetry: true,
      rpcStatus: 'healthy',
    }));
  }, []);

  // 手动重试连接
  const retryConnection = useCallback(async () => {
    if (!networkStatus.canRetry) {
      return false;
    }

    setNetworkStatus(prev => ({
      ...prev,
      lastError: null,
    }));

    await checkRPCNodes();
    return networkStatus.rpcStatus !== 'failed';
  }, [networkStatus.canRetry, networkStatus.rpcStatus, checkRPCNodes]);

  return {
    networkStatus,
    recordNetworkError,
    resetNetworkStatus,
    retryConnection,
    checkRPCNodes,
  };
}; 