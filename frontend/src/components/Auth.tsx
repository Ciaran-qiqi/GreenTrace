'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

// 钱包连接组件 - 用于用户身份验证
export const Auth: React.FC = () => {
  const { isConnected, address } = useAccount();
  const [mounted, setMounted] = useState(false);

  // 确保组件只在客户端渲染
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="text-center">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="text-2xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            钱包已连接
          </h3>
          <p className="text-green-600 mb-4">
            地址: {address?.slice(0, 6)}...{address?.slice(-4)}
          </p>
          <p className="text-sm text-green-700">
            您现在可以开始创建绿色NFT了！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="text-2xl mb-4">🔗</div>
        <h3 className="text-lg font-semibold text-blue-800 mb-2">
          连接钱包
        </h3>
        <p className="text-blue-600 mb-6">
          请连接您的钱包以开始使用GreenTrace
        </p>
        <div className="flex justify-center">
          <ConnectButton 
            chainStatus="icon"
            showBalance={false}
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
        <p className="text-xs text-blue-500 mt-4">
          支持MetaMask、WalletConnect等主流钱包
        </p>
      </div>
    </div>
  );
}; 