import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';

// Network status interface

export interface NetworkStatus {
  isOnline: boolean;
  rpcStatus: 'healthy' | 'degraded' | 'failed';
  lastError: string | null;
  retryCount: number;
  canRetry: boolean;
}

// Rpc node health check

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
      signal: AbortSignal.timeout(5000), // 5 seconds timeout

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

// Network status management hook

export const useNetworkStatus = () => {
  const { isConnected } = useAccount();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    rpcStatus: 'healthy',
    lastError: null,
    retryCount: 0,
    canRetry: true,
  });

  // Detect the browser network status

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

  // Rpc node health check

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

  // Regularly check the health status of rpc nodes

  useEffect(() => {
    // Check it now

    checkRPCNodes();

    // Check every 30 seconds

    const interval = setInterval(checkRPCNodes, 30000);

    return () => clearInterval(interval);
  }, [checkRPCNodes]);

  // Log network errors

  const recordNetworkError = useCallback((error: string) => {
    setNetworkStatus(prev => ({
      ...prev,
      lastError: error,
      retryCount: prev.retryCount + 1,
      canRetry: prev.retryCount < 5, // Try up to 5 times

      rpcStatus: 'degraded',
    }));
  }, []);

  // Reset the error status

  const resetNetworkStatus = useCallback(() => {
    setNetworkStatus(prev => ({
      ...prev,
      lastError: null,
      retryCount: 0,
      canRetry: true,
      rpcStatus: 'healthy',
    }));
  }, []);

  // Retry the connection manually

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