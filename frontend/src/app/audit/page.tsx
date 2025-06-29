'use client';

// Import Audit Center Components

import { Navigation } from '@/components/Navigation';
import { AuditCenter } from '@/components/AuditCenter';
import { useTranslation } from '@/hooks/useI18n';

// Audit Center Page -Used for auditors to review NFT applications

export default function AuditPage() {
  const { t } = useTranslation();
  
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-4">
              {t('audit.title', '审计中心')}
            </h1>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              {t('audit.description', '专业审计员审核NFT创建申请和兑换申请，确保碳减排数据的真实性和准确性')}
            </p>
          </div>
          
          <AuditCenter />
        </div>
      </div>
    </>
  );
} 