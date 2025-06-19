import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAccount, useDisconnect } from 'wagmi';

export const Navigation: React.FC = () => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">🌱</span>
            <span className="text-xl font-bold text-gray-800">GreenTrace</span>
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            <Link 
              href="/" 
              className={`px-4 py-2 rounded-lg transition-colors ${
                router.pathname === '/' 
                  ? 'bg-green-100 text-green-700' 
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              首页
            </Link>
            <Link 
              href="/create" 
              className={`px-4 py-2 rounded-lg transition-colors ${
                router.pathname === '/create' 
                  ? 'bg-green-100 text-green-700' 
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              创建NFT
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {isConnected ? (
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-600">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <button
                  onClick={() => disconnect()}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  断开连接
                </button>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                未连接钱包
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button className="text-gray-600 hover:text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}; 