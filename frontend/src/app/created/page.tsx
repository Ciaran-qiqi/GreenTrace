'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/Navigation';
import { NFTMintRecords } from '@/components/NFTMintRecords';
import { CreateNFTCard } from '@/components/CreateNFTCard';
import { useTranslation } from '@/hooks/useI18n';

// NFT Creation Record Page -Show all Creation Records

export default function CreatedPage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState(false);
  const [showRefreshTip, setShowRefreshTip] = useState(false);

  // Check if automatic refresh is required (jump from the creation page)

  useEffect(() => {
    const fromCreate = searchParams.get('from');
    const refresh = searchParams.get('refresh');
    
    if (fromCreate === 'create' || refresh === 'true') {
      console.log('从创建页面跳转过来，自动刷新数据');
      setShouldAutoRefresh(true);
      setShowRefreshTip(true);
      
      // Clear the url parameter to avoid repeated refresh

      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Hide the prompt after 10 seconds

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
            {/* Page title */}
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('created.title')}</h1>
              <p className="text-gray-600">{t('created.subtitle')}</p>
              
              {/* Automatic refresh prompt */}
              {showRefreshTip && (
                <div className="mt-4 mx-auto max-w-lg">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3 mt-0.5"></div>
                      <div className="text-blue-800 text-sm">
                        <div className="font-medium mb-1">{t('created.refreshTip.fetching')}</div>
                        <div className="text-blue-600">
                          📋 {t('created.refreshTip.submitted')}
                          <br />
                          ⏱️ {t('created.refreshTip.confirmTime')}
                          <br />
                          🔄 {t('created.refreshTip.manualRefresh')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Record list */}
            <NFTMintRecords autoRefresh={shouldAutoRefresh} />
            
            {/* Create a new nft card */}
            <CreateNFTCard 
              onShowForm={() => {
                // Jump to the creation page

                router.push(`/create/${language}`);
              }} 
            />
          </div>
        </div>
      </div>
    </>
  );
} 