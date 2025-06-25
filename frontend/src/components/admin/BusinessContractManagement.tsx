'use client';

import React, { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import { toast } from 'react-hot-toast';

/**
 * 业务合约管理组件
 * @description 管理授权的业务合约，添加或移除业务合约权限
 */
export const BusinessContractManagement: React.FC = () => {
  const [newContractAddress, setNewContractAddress] = useState('');
  const [removeContractAddress, setRemoveContractAddress] = useState('');
  const [contractList, setContractList] = useState<string[]>([
    // 模拟已存在的业务合约
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
  ]);

  // 添加业务合约
  const { 
    writeContract: addContract, 
    data: addTxHash, 
    isPending: isAddPending 
  } = useWriteContract();

  // 移除业务合约
  const { 
    writeContract: removeContract, 
    data: removeTxHash, 
    isPending: isRemovePending 
  } = useWriteContract();

  // 等待添加交易确认
  const { isLoading: isAddConfirming } = useWaitForTransactionReceipt({
    hash: addTxHash,
    onSuccess: () => {
      toast.success('业务合约添加成功！');
      setContractList(prev => [...prev, newContractAddress]);
      setNewContractAddress('');
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    }
  });

  // 等待移除交易确认
  const { isLoading: isRemoveConfirming } = useWaitForTransactionReceipt({
    hash: removeTxHash,
    onSuccess: () => {
      toast.success('业务合约移除成功！');
      setContractList(prev => prev.filter(addr => addr !== removeContractAddress));
      setRemoveContractAddress('');
    },
    onError: (error) => {
      toast.error(`移除失败: ${error.message}`);
    }
  });

  // 验证地址格式
  const isValidAddress = (addr: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  // 处理添加业务合约
  const handleAddContract = () => {
    if (!isValidAddress(newContractAddress)) {
      toast.error('请输入有效的合约地址');
      return;
    }

    if (contractList.includes(newContractAddress)) {
      toast.error('该合约已在授权列表中');
      return;
    }

    addContract({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'addBusinessContract',
      args: [newContractAddress as `0x${string}`],
    });
  };

  // 处理移除业务合约
  const handleRemoveContract = () => {
    if (!isValidAddress(removeContractAddress)) {
      toast.error('请输入有效的合约地址');
      return;
    }

    removeContract({
      address: CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`,
      abi: GreenTraceABI.abi,
      functionName: 'removeBusinessContract',
      args: [removeContractAddress as `0x${string}`],
    });
  };

  // 快速移除合约
  const quickRemoveContract = (address: string) => {
    setRemoveContractAddress(address);
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">业务合约管理</h2>
        <p className="text-gray-600">管理授权的业务合约，控制哪些合约可以调用特殊功能</p>
      </div>

      {/* 权限提醒 */}
      <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="font-medium text-yellow-800">管理员功能</div>
            <div className="text-sm text-yellow-700">
              只有合约所有者可以添加或移除业务合约。请谨慎管理授权列表。
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 添加业务合约 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➕</span>
            添加业务合约
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                合约地址
              </label>
              <input
                type="text"
                value={newContractAddress}
                onChange={(e) => setNewContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                请输入要授权的业务合约地址
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-1">授权后该合约将可以:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>在测试环境直接铸造NFT</li>
                  <li>更新NFT价格信息</li>
                  <li>调用其他业务相关功能</li>
                </ul>
              </div>
            </div>
            
            <button
              onClick={handleAddContract}
              disabled={!newContractAddress || isAddPending || isAddConfirming}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAddPending || isAddConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isAddPending ? '发送交易中...' : '确认中...'}
                </div>
              ) : (
                '添加业务合约'
              )}
            </button>
          </div>
        </div>

        {/* 移除业务合约 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">➖</span>
            移除业务合约
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                合约地址
              </label>
              <input
                type="text"
                value={removeContractAddress}
                onChange={(e) => setRemoveContractAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="text-xs text-gray-500 mt-1">
                请输入要移除的业务合约地址
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-sm text-red-800">
                <div className="font-medium mb-1">⚠️ 移除授权后:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>该合约将失去所有特殊权限</li>
                  <li>无法再调用管理员功能</li>
                  <li>此操作不可逆转</li>
                </ul>
              </div>
            </div>
            
            <button
              onClick={handleRemoveContract}
              disabled={!removeContractAddress || isRemovePending || isRemoveConfirming}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRemovePending || isRemoveConfirming ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isRemovePending ? '发送交易中...' : '确认中...'}
                </div>
              ) : (
                '移除业务合约'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 业务合约列表 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-xl">🏢</span>
            已授权业务合约列表
          </h3>
          <div className="text-sm text-gray-500">
            共 {contractList.length} 个合约
          </div>
        </div>

        {contractList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📝</div>
            <div>暂无授权的业务合约</div>
            <div className="text-sm text-gray-400 mt-1">
              添加业务合约后将在此显示
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {contractList.map((contract, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📋</span>
                      <div>
                        <div className="font-medium text-gray-800 font-mono">
                          {contract}
                        </div>
                        <div className="text-sm text-gray-500">
                          业务合约 #{index + 1}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      ✅ 已授权
                    </span>
                    <button
                      onClick={() => quickRemoveContract(contract)}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm transition-colors"
                    >
                      移除
                    </button>
                  </div>
                </div>

                {/* 合约权限说明 */}
                <div className="mt-3 pl-9 text-sm text-gray-600">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="font-medium text-gray-700 mb-2">授权权限:</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">✓</span>
                        <span>铸造NFT权限</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">✓</span>
                        <span>更新价格权限</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">✓</span>
                        <span>测试环境功能</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-green-500">✓</span>
                        <span>特殊业务调用</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 安全提示 */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-xl">🔒</span>
          安全提示
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <div className="font-medium text-gray-800 mb-2">添加合约前请确认:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>合约地址正确无误</li>
              <li>合约代码已经审计</li>
              <li>了解合约的具体功能</li>
              <li>确认合约的安全性</li>
            </ul>
          </div>
          <div>
            <div className="font-medium text-gray-800 mb-2">权限管理建议:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>定期检查授权列表</li>
              <li>及时移除不需要的合约</li>
              <li>记录每次授权的原因</li>
              <li>监控合约的调用行为</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 