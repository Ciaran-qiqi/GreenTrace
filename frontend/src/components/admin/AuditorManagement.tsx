'use client';

import React, { useState } from 'react';
import { useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { useAdminData } from '@/hooks/useAdminData';
import { useAuditorOperations } from '@/hooks/useAuditorOperations';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { toast } from 'react-hot-toast';

/**
 * 审计员管理组件
 * @description 管理审计员权限，查看审计员工作统计和绩效
 */
export const AuditorManagement: React.FC = () => {
  const { address } = useAccount();
  const [newAuditorAddress, setNewAuditorAddress] = useState('');
  const [removeAuditorAddress, setRemoveAuditorAddress] = useState('');

  const { isAuditor } = useAdminData();
  const { 
    auditorList, 
    auditorStats, 
    loadingAuditors,
    refetchAuditors,
    addAuditorToList,
    removeAuditorFromList,
    isCurrentUserAuditor
  } = useAuditorOperations();

  // 添加审计员的合约写入
  const { 
    writeContract: addAuditor, 
    data: addTxHash, 
    isPending: isAddPending 
  } = useWriteContract();

  // 移除审计员的合约写入
  const { 
    writeContract: removeAuditor, 
    data: removeTxHash, 
    isPending: isRemovePending 
  } = useWriteContract();

  // 等待添加审计员交易确认
  const { isLoading: isAddConfirming } = useWaitForTransactionReceipt({
    hash: addTxHash,
    onSuccess: () => {
      toast.success('审计员添加成功！');
      addAuditorToList(newAuditorAddress);
      setNewAuditorAddress('');
      refetchAuditors();
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    }
  });

  // 等待移除审计员交易确认
  const { isLoading: isRemoveConfirming } = useWaitForTransactionReceipt({
    hash: removeTxHash,
    onSuccess: () => {
      toast.success('审计员移除成功！');
      removeAuditorFromList(removeAuditorAddress);
      setRemoveAuditorAddress('');
      refetchAuditors();
    },
    onError: (error) => {
      toast.error(`移除失败: ${error.message}`);
    }
  });

  // 验证地址格式
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  // 处理添加审计员
  const handleAddAuditor = () => {
    if (!isValidAddress(newAuditorAddress)) {
      toast.error('请输入有效的地址');
      return;
    }

    addAuditor({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'addAuditor',
      args: [newAuditorAddress as `0x${string}`],
    });
  };

  // 处理移除审计员
  const handleRemoveAuditor = () => {
    if (!isValidAddress(removeAuditorAddress)) {
      toast.error('请输入有效的地址');
      return;
    }

    removeAuditor({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'removeAuditor',
      args: [removeAuditorAddress as `0x${string}`],
    });
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">审计员管理</h2>
        <p className="text-gray-600">管理系统审计员权限和查看工作统计</p>
      </div>

      {/* 权限提醒 */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-medium text-yellow-800">管理员功能</div>
            <div className="text-sm text-yellow-700">
              只有合约所有者可以添加或移除审计员。当前用户权限: {isCurrentUserAuditor ? '审计员' : '访客'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 添加审计员 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➕</span>
            添加审计员
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                审计员地址
              </label>
              <input
                type="text"
                value={newAuditorAddress}
                onChange={(e) => setNewAuditorAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                请输入有效的以太坊地址
              </div>
            </div>
            
            <button
              onClick={handleAddAuditor}
              disabled={!newAuditorAddress || isAddPending || isAddConfirming}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddPending || isAddConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isAddPending ? '发送交易中...' : '确认中...'}
                </div>
              ) : (
                '添加审计员'
              )}
            </button>
          </div>
        </div>

        {/* 移除审计员 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➖</span>
            移除审计员
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                审计员地址
              </label>
              <input
                type="text"
                value={removeAuditorAddress}
                onChange={(e) => setRemoveAuditorAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                请输入要移除的审计员地址
              </div>
            </div>
            
            <button
              onClick={handleRemoveAuditor}
              disabled={!removeAuditorAddress || isRemovePending || isRemoveConfirming}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRemovePending || isRemoveConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRemovePending ? '发送交易中...' : '确认中...'}
                </div>
              ) : (
                '移除审计员'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 审计员列表和统计 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-xl">👥</span>
            审计员列表
          </h3>
          <button
            onClick={refetchAuditors}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            🔄 刷新
          </button>
        </div>

        {loadingAuditors ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
            <div className="text-gray-600 mt-2">加载审计员数据...</div>
          </div>
        ) : (
          <div className="space-y-4">
            {auditorList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">👤</div>
                <div>暂无审计员数据</div>
                <div className="text-sm text-gray-400 mt-1">
                  {isCurrentUserAuditor ? '当前用户是审计员，但列表为空' : '添加审计员后将在此显示'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {auditorList.map((auditor, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">👨‍💼</span>
                          <div>
                            <div className="font-medium text-gray-800 font-mono">
                              {auditor}
                            </div>
                            <div className="text-sm text-gray-500">
                              {auditor === address && <span className="text-green-600 font-medium">(当前用户)</span>}
                              {auditor !== address && <span className="text-blue-600">审计员</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 审计员统计 */}
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-blue-600">
                            {auditorStats[auditor]?.totalMintAudits || 0}
                          </div>
                          <div className="text-gray-500">铸造审计</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600">
                            {auditorStats[auditor]?.totalCashAudits || 0}
                          </div>
                          <div className="text-gray-500">兑换审计</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-purple-600">
                            {((auditorStats[auditor]?.totalMintAudits || 0) + 
                              (auditorStats[auditor]?.totalCashAudits || 0))}
                          </div>
                          <div className="text-gray-500">总计</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* 审计员列表说明 */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">ℹ️</span>
                    <div className="text-sm">
                      <div className="font-medium text-blue-800">审计员列表说明</div>
                      <div className="text-blue-700 mt-1">
                        • 当前显示 {auditorList.length} 位审计员
                        {isCurrentUserAuditor && <span className="block">• 您拥有审计权限，可以处理NFT铸造和兑换申请</span>}
                        • 统计数据仅供参考，实际审计记录以区块链数据为准
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 审计员绩效概览 */}
      {auditorList.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">📊</span>
            审计员绩效概览
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 总审计数统计 */}
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(auditorStats).reduce((sum, stat) => 
                  sum + (stat?.totalMintAudits || 0) + (stat?.totalCashAudits || 0), 0
                )}
              </div>
              <div className="text-blue-700 font-medium">总审计数</div>
              <div className="text-sm text-blue-600">
                所有审计员处理的申请总数
              </div>
            </div>

            {/* 平均审计数 */}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {auditorList.length > 0 ? Math.round(
                  Object.values(auditorStats).reduce((sum, stat) => 
                    sum + (stat?.totalMintAudits || 0) + (stat?.totalCashAudits || 0), 0
                  ) / auditorList.length
                ) : 0}
              </div>
              <div className="text-green-700 font-medium">平均审计数</div>
              <div className="text-sm text-green-600">
                每位审计员的平均处理量
              </div>
            </div>

            {/* 活跃审计员 */}
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(auditorStats).filter(stat => 
                  (stat?.totalMintAudits || 0) + (stat?.totalCashAudits || 0) > 0
                ).length}
              </div>
              <div className="text-purple-700 font-medium">活跃审计员</div>
              <div className="text-sm text-purple-600">
                已处理过申请的审计员数量
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 