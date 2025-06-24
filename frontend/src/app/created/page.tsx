'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { NFTMintRecords } from '@/components/NFTMintRecords';
import { CreateNFTCard } from '@/components/CreateNFTCard';

// NFT创建记录页面 - 显示所有创建记录
export default function CreatedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState(false);
  const [showRefreshTip, setShowRefreshTip] = useState(false);

  // 检查是否需要自动刷新（从创建页面跳转过来）
  useEffect(() => {
    const fromCreate = searchParams.get('from');
    const refresh = searchParams.get('refresh');
    
    if (fromCreate === 'create' || refresh === 'true') {
      console.log('从创建页面跳转过来，自动刷新数据');
      setShouldAutoRefresh(true);
      setShowRefreshTip(true);
      
      // 清除URL参数，避免重复刷新
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // 10秒后隐藏提示
      setTimeout(() => {
        setShowRefreshTip(false);
      }, 10000);
    }
  }, [searchParams]);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="space-y-8">
            {/* 页面标题 */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">我的NFT创建记录</h1>
              <p className="text-gray-600">查看和管理您的所有NFT创建申请</p>
              
              {/* 自动刷新提示 */}
              {showRefreshTip && (
                <div className="mt-4 mx-auto max-w-lg">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3 mt-0.5"></div>
                      <div className="text-blue-800 text-sm">
                        <div className="font-medium mb-1">正在获取最新申请记录...</div>
                        <div className="text-blue-600">
                          📋 NFT申请已提交到区块链，等待区块确认后即可在此页面查看。
                          <br />
                          ⏱️ 通常需要1-2个区块确认时间（约15-30秒）。
                          <br />
                          🔄 如果没有显示，请点击&ldquo;刷新&rdquo;按钮手动更新。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 记录列表 */}
            <NFTMintRecords autoRefresh={shouldAutoRefresh} />
            
            {/* 创建新NFT卡片 */}
            <CreateNFTCard 
              onShowForm={() => {
                // 跳转到创建页面
                router.push('/create');
              }} 
            />
          </div>
        </div>
      </div>
    </>
  );
} 