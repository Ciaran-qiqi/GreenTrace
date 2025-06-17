'use client';

import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider as RainbowKitProviderComponent,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  mainnet,
  sepolia,
  polygon,
  optimism,
  arbitrum,
  base,
  Chain,
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";
import { useWallet } from '@/src/hooks/useWallet';
import { useEffect, useState } from 'react';

// 创建 QueryClient 实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// 定义本地 Foundry 测试网配置
const foundryChain: Chain = {
  id: 31337,
  name: 'Foundry',
  nativeCurrency: {
    decimals: 18,
    name: 'Carbon Token',
    symbol: 'CARB',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Foundry', url: '' },
  },
  testnet: true,
};

// 配置 Sepolia 测试网
const sepoliaChain = {
  ...sepolia,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || ''] },
    public: { http: [process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || ''] },
  },
};

// 配置主网
const mainnetChain = {
  ...mainnet,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MAINNET_RPC_URL || ''] },
    public: { http: [process.env.NEXT_PUBLIC_MAINNET_RPC_URL || ''] },
  },
};

// 配置 RainbowKit
const config = getDefaultConfig({
  appName: 'GreenTrace',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [sepoliaChain, mainnetChain, foundryChain, polygon, optimism, arbitrum, base],
  ssr: false,
});

// 导出钱包连接按钮组件
export const WalletConnectButton = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed top-0 right-0 p-4 z-50">
      <ConnectButton />
    </div>
  );
};

// 导出 Provider 组件
export const RainbowKitProvider = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      setMounted(true);
    } catch (err) {
      console.error('RainbowKitProvider mount error:', err);
      setError(err as Error);
    }
  }, []);

  if (error) {
    return <div>加载出错，请刷新页面重试</div>;
  }

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProviderComponent
          modalSize="compact"
          showRecentTransactions={true}
        >
          {children}
        </RainbowKitProviderComponent>
      </WagmiProvider>
    </QueryClientProvider>
  );
};