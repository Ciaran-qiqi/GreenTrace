'use client';

import "@/src/styles/globals.css";
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { RainbowKitProvider } from "@/src/providers/RainbowKitProvider";

// 动态导入钱包连接按钮组件
const WalletConnectButton = dynamic(
  () => import('@/src/providers/RainbowKitProvider').then(mod => mod.WalletConnectButton),
  { 
    ssr: false,
    loading: () => (
      <div className="fixed top-0 right-0 p-4 z-50">
        <div className="w-[200px] h-[40px] bg-gray-100 rounded-lg animate-pulse"></div>
      </div>
    )
  }
);

// 根布局组件
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <RainbowKitProvider>
          <Suspense fallback={null}>
            <WalletConnectButton />
          </Suspense>
          <div className="min-h-screen">
            {children}
          </div>
        </RainbowKitProvider>
      </body>
    </html>
  );
} 