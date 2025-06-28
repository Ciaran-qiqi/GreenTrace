'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Navigation } from '@/components/Navigation';
import { useAdminData } from '@/hooks/useAdminData';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AuditorManagement } from '@/components/admin/AuditorManagement';
import { AuditDataManagement } from '@/components/admin/AuditDataManagement';
import { BusinessContractManagement } from '@/components/admin/BusinessContractManagement';
import { SystemSettings } from '@/components/admin/SystemSettings';

// 管理中心菜单项
type AdminMenuItem = 'dashboard' | 'auditors' | 'audits' | 'contracts' | 'settings';

interface AdminMenuConfig {
  id: AdminMenuItem;
  label: string;
  icon: string;
  description: string;
  requireOwner?: boolean;
}

const adminMenuItems: AdminMenuConfig[] = [
  {
    id: 'dashboard',
    label: '仪表板',
    icon: '📊',
    description: '系统概览',
  },
  {
    id: 'auditors',
    label: '审计员管理',
    icon: '👥',
    description: '管理审计员',
    requireOwner: true,
  },
  {
    id: 'audits',
    label: '审计数据',
    icon: '📋',
    description: '审计记录',
  },
  {
    id: 'contracts',
    label: '业务合约',
    icon: '🏢',
    description: '合约管理',
    requireOwner: true,
  },
  {
    id: 'settings',
    label: '系统设置',
    icon: '⚙️',
    description: '系统配置',
    requireOwner: true,
  },
];

/**
 * 管理中心主页面
 * @description GreenTrace管理中心，提供系统管理和数据分析功能
 */
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const [activeMenu, setActiveMenu] = useState<AdminMenuItem>('dashboard');
  
  // 获取管理数据
  const {
    systemStats,
    statsLoading,
    isAuditor,
    isOwner,
    refetchAll,
  } = useAdminData();

  // 未连接钱包
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">管理中心</h2>
          <p className="text-gray-600 mb-6">
            请连接钱包以访问GreenTrace管理中心
          </p>
          <div className="text-sm text-gray-500">
            需要管理员或审计员权限
          </div>
        </div>
      </div>
    );
  }

  // 渲染活跃组件
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

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* 页面头部 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛡️</span>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">GreenTrace 管理中心</h1>
                  <p className="text-gray-600">
                    系统管理和数据分析平台
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* 快速统计 */}
                {systemStats && !statsLoading && (
                  <div className="flex gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {systemStats.pendingMintRequests + systemStats.pendingCashRequests}
                      </div>
                      <div className="text-xs text-gray-600">待审核</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {systemStats.totalMintRequests + systemStats.totalCashRequests}
                      </div>
                      <div className="text-xs text-gray-600">总申请</div>
                    </div>
                  </div>
                )}
                
                {/* 刷新按钮 */}
                <button
                  onClick={refetchAll}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  🔄 刷新数据
                </button>
              </div>
            </div>

            {/* 当前用户信息条 */}
            <div className="bg-white rounded-lg p-3 border-l-4 border-green-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">👤</span>
                <div>
                  <span className="font-medium text-gray-800">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <span className="ml-4 text-sm text-gray-600">
                    权限: {isOwner && isAuditor ? '管理员 + 审计员' : isOwner ? '管理员' : isAuditor ? '审计员' : '访客'}
                  </span>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>

          {/* 水平标签页菜单 */}
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
                          管理员
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[700px]">
            {renderActiveComponent()}
          </div>
        </div>
      </div>
    </>
  );
} 