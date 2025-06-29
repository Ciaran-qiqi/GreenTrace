'use client';

import React from 'react';
import { Navigation } from '@/components/Navigation';
import { CreateNFT } from '@/components/CreateNFT';
import Link from 'next/link';
import { useTranslation } from '@/hooks/useI18n';

// NFT创建页面 -专门用于创建新的绿色NFT
// NFT Creation Page -Dedicated to creating new green NFTs

export default function CreatePage() {
  const { t, language } = useTranslation();

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* Page title and return button */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <Link 
                href={`/created/${language}`}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('create.backToRecords', '返回创建记录')}
              </Link>
            </div>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                {t('create.title', '创建绿色NFT')}
              </h1>
              <p className="text-gray-600">
                {t('create.subtitle', '提交您的环保项目，铸造独特的绿色NFT')}
              </p>
            </div>
          </div>
          
          {/* Create a form */}
          <div className="max-w-4xl mx-auto">
            <CreateNFT />
          </div>
          
          {/* Bottom tips */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              {t('create.bottomTip', '创建完成后，您可以在')}{' '}
              <Link href={`/created/${language}`} className="text-green-600 hover:text-green-700 underline">
                {t('create.recordsPage', '创建记录页面')}
              </Link>
              {' '}{t('create.checkStatus', '查看申请状态')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 