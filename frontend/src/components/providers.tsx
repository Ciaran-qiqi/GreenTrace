'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import dynamic from 'next/dynamic';

// 创建React Query客户端实例
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1分钟
      refetchOnWindowFocus: false,
    },
  },
});

// Web3提供者组件的内部实现
function ProvidersInternal({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          locale="zh-CN"
          initialChain={config.chains[0]}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// 使用dynamic导入来避免hydration错误
const DynamicProviders = dynamic(() => Promise.resolve(ProvidersInternal), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  ),
});

// Web3提供者组件 - 包装整个应用
export function Providers({ children }: { children: React.ReactNode }) {
  return <DynamicProviders>{children}</DynamicProviders>;
} 