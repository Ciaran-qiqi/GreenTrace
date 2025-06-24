'use client';

import React from 'react';
import { Navigation } from '@/components/Navigation';
import { AuditCenter } from '@/components/AuditCenter';

// 审计中心页面 - 用于审计员审核NFT申请
export default function AuditPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          {/* 页面标题 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">审计中心</h1>
            <p className="text-gray-600">审核NFT申请，验证环保行为的真实性</p>
          </div>
          
          {/* 审计中心组件 */}
          <AuditCenter />
        </div>
      </div>
    </>
  );
} 