'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { useContract } from '@/src/hooks/useContract';

export default function AdminPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [isAuditor, setIsAuditor] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [auditors, setAuditors] = useState<string[]>([]);
  const [newAuditor, setNewAuditor] = useState('');
  const [loading, setLoading] = useState(true);
  const { contract } = useContract();

  // 获取所有审计员
  const fetchAuditors = async () => {
    if (!contract) return;
    try {
      const filter = contract.filters.AuditorAdded();
      const events = await contract.queryFilter(filter);
      // 使用 Set 去重
      const auditorAddresses = Array.from(new Set(events.map(event => event.args?.auditor)));
      setAuditors(auditorAddresses);
      console.log('审计员列表:', auditorAddresses);
    } catch (error) {
      console.error('获取审计员列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 检查钱包连接状态和权限
  const checkWalletAndPermissions = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        setIsConnected(accounts.length > 0);
        
        if (accounts.length > 0 && contract) {
          const address = accounts[0].toLowerCase();
          setCurrentAddress(address);
          
          // 检查所有者权限
          const owner = await contract.owner();
          const ownerLower = owner.toLowerCase();
          setOwnerAddress(ownerLower);
          const isOwnerAddress = ownerLower === address;
          setIsOwner(isOwnerAddress);
          
          // 检查审计员权限
          const isAuditorAddress = await contract.auditors(address);
          setIsAuditor(isAuditorAddress);
          
          console.log('权限检查结果:', {
            currentAddress: address,
            ownerAddress: ownerLower,
            isOwner: isOwnerAddress,
            isAuditor: isAuditorAddress
          });
          
          // 如果是所有者或审计员，都获取审计员列表
          if (isOwnerAddress || isAuditorAddress) {
            fetchAuditors();
          }
        }
      } catch (error) {
        console.error('检查权限失败:', error);
        setIsConnected(false);
        setIsOwner(false);
        setIsAuditor(false);
      }
    } else {
      setIsConnected(false);
      setIsOwner(false);
      setIsAuditor(false);
    }
  };

  // 添加审计员
  const addAuditor = async () => {
    if (!contract || !newAuditor) return;
    try {
      const tx = await contract.addAuditor(newAuditor);
      await tx.wait();
      setNewAuditor('');
      fetchAuditors();
    } catch (error) {
      console.error('添加审计员失败:', error);
    }
  };

  // 移除审计员
  const removeAuditor = async (address: string) => {
    if (!contract) return;
    try {
      const tx = await contract.removeAuditor(address);
      await tx.wait();
      fetchAuditors();
    } catch (error) {
      console.error('移除审计员失败:', error);
    }
  };

  useEffect(() => {
    checkWalletAndPermissions();
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', checkWalletAndPermissions);
      window.ethereum.on('chainChanged', checkWalletAndPermissions);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', checkWalletAndPermissions);
        window.ethereum.removeListener('chainChanged', checkWalletAndPermissions);
      }
    };
  }, [contract]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">请先连接钱包</h1>
            <p className="mt-2 text-gray-600">连接钱包后即可访问管理后台</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isOwner && !isAuditor) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">无权访问</h1>
            <p className="mt-2 text-gray-600">当前地址: {currentAddress}</p>
            <p className="mt-2 text-gray-600">合约所有者地址: {ownerAddress}</p>
            <p className="mt-2 text-gray-600">所有者状态: {isOwner ? '是' : '否'}</p>
            <p className="mt-2 text-gray-600">审计员状态: {isAuditor ? '是' : '否'}</p>
            <p className="mt-2 text-gray-600">您既不是合约所有者也不是审计员，无法访问此页面</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">管理后台</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6">审计员管理</h2>
          
          {/* 添加审计员表单 - 仅所有者可见 */}
          {isOwner && (
            <div className="mb-8">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newAuditor}
                  onChange={(e) => setNewAuditor(e.target.value)}
                  placeholder="输入审计员钱包地址"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
                <button
                  onClick={addAuditor}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  添加审计员
                </button>
              </div>
            </div>
          )}

          {/* 审计员列表 */}
          <div>
            <h3 className="text-lg font-medium mb-4">当前审计员列表</h3>
            {loading ? (
              <div className="text-center py-4">加载中...</div>
            ) : auditors.length === 0 ? (
              <div className="text-center py-4 text-gray-500">暂无审计员</div>
            ) : (
              <div className="space-y-4">
                {auditors.map((address) => (
                  <div key={address} className="flex items-center justify-between border rounded-lg p-4">
                    <span className="font-mono">{address}</span>
                    {isOwner && (
                      <button
                        onClick={() => removeAuditor(address)}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 