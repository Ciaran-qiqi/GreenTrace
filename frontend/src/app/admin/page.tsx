'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Navigation } from '@/components/Navigation';
import { useAdminData } from '@/hooks/useAdminData';
import { useI18n } from '@/hooks/useI18n';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AuditorManagement } from '@/components/admin/AuditorManagement';
import { AuditDataManagement } from '@/components/admin/AuditDataManagement';
import { BusinessContractManagement } from '@/components/admin/BusinessContractManagement';
import { SystemSettings } from '@/components/admin/SystemSettings';

// Management Center Menu Items

type AdminMenuItem = 'dashboard' | 'auditors' | 'audits' | 'contracts' | 'settings';

interface AdminMenuConfig {
  id: AdminMenuItem;
  label: string;
  icon: string;
  description: string;
  requireOwner?: boolean;
}

/**
 * Management Center Main Page
 * @description GreenTrace Management Center, providing system management and data analysis capabilities
 */
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [activeMenu, setActiveMenu] = useState<AdminMenuItem>('dashboard');
  const { t } = useI18n();
  
  // Get management data

  const {
    systemStats,
    statsLoading,
    isAuditor,
    isOwner,
    refetchAll,
  } = useAdminData();

  // Build menu item configuration

  const adminMenuItems: AdminMenuConfig[] = [
    {
      id: 'dashboard',
      label: t('admin.menuItems.dashboard.label'),
      icon: t('admin.menuItems.dashboard.icon'),
      description: t('admin.menuItems.dashboard.description'),
    },
    {
      id: 'auditors',
      label: t('admin.menuItems.auditors.label'),
      icon: t('admin.menuItems.auditors.icon'),
      description: t('admin.menuItems.auditors.description'),
      requireOwner: true,
    },
    {
      id: 'audits',
      label: t('admin.menuItems.audits.label'),
      icon: t('admin.menuItems.audits.icon'),
      description: t('admin.menuItems.audits.description'),
    },
    {
      id: 'contracts',
      label: t('admin.menuItems.contracts.label'),
      icon: t('admin.menuItems.contracts.icon'),
      description: t('admin.menuItems.contracts.description'),
      requireOwner: true,
    },
    {
      id: 'settings',
      label: t('admin.menuItems.settings.label'),
      icon: t('admin.menuItems.settings.icon'),
      description: t('admin.menuItems.settings.description'),
      requireOwner: true,
    },
  ];

  // Not connected to the wallet

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('admin.title')}</h2>
          <p className="text-gray-600 mb-6">
            {t('admin.connectWalletDesc')}
          </p>
          <div className="text-sm text-gray-500">
            {t('admin.permissionRequired')}
          </div>
        </div>
      </div>
    );
  }

  // Render active components

  const renderActiveComponent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'auditors':
        return <AuditorManagement />;
      case 'audits':
        return <AuditDataManagement />;
      case 'contracts':
        return <BusinessContractManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  // Get permission to display text

  const getPermissionText = () => {
    if (isOwner && isAuditor) return t('admin.userInfo.adminAndAuditor');
    if (isOwner) return t('admin.userInfo.admin');
    if (isAuditor) return t('admin.userInfo.auditor');
    return t('admin.userInfo.visitor');
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Page header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛡️</span>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{t('admin.title')}</h1>
                  <p className="text-gray-600">
                    {t('admin.subtitle')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Quick statistics */}
                {systemStats && !statsLoading && (
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {systemStats.pendingMintRequests + systemStats.pendingCashRequests}
                      </div>
                      <div className="text-xs text-gray-600">{t('admin.stats.pendingReview')}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {systemStats.totalMintRequests + systemStats.totalCashRequests}
                      </div>
                      <div className="text-xs text-gray-600">{t('admin.stats.totalApplications')}</div>
                    </div>
                  </div>
                )}
                
                {/* Refresh button */}
                <button
                  onClick={refetchAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('admin.stats.refreshData')}
                </button>
              </div>
            </div>

            {/* Current user information bar */}
            <div className="bg-white rounded-lg p-3 border-l-4 border-green-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">👤</span>
                <div>
                  <span className="font-medium text-gray-800">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <span className="ml-4 text-sm text-gray-600">
                    {t('admin.userInfo.permissions')} {getPermissionText()}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>

          {/* Horizontal Tab Menu */}
          <div className="mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
              <nav className="flex gap-1">
                {adminMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={`flex-1 p-3 rounded-lg transition-all text-center relative ${
                      activeMenu === item.id
                        ? 'bg-green-500 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl">{item.icon}</span>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className={`text-xs ${
                        activeMenu === item.id ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {item.description}
                      </div>
                      {item.requireOwner && (
                        <span className={`absolute -top-1 -right-1 text-xs px-1.5 py-0.5 rounded-full ${
                          activeMenu === item.id 
                            ? 'bg-yellow-300 text-yellow-800' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {t('admin.menuItems.auditors.requireOwner')}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content area */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[700px]">
            {renderActiveComponent()}
          </div>
        </div>
      </div>
    </>
  );
} 