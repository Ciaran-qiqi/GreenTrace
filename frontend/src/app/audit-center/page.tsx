'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { useContract } from '@/src/hooks/useContract';
import { ethers } from 'ethers';

export default function AuditCenter() {
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [auditedRequests, setAuditedRequests] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuditor, setIsAuditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [auditValues, setAuditValues] = useState<Record<string, { carbonValue: string; reason: string }>>({});
  const { contract } = useContract();

  // 检查钱包连接状态
  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        setIsConnected(accounts.length > 0);
        if (accounts.length > 0 && contract) {
          const address = accounts[0].toLowerCase();
          // 先检查审计员状态
          const auditorStatus = await contract.auditors(address);
          console.log('审计员状态检查:', { address, isAuditor: auditorStatus });
          setIsAuditor(auditorStatus);

          // 如果不是审计员，检查是否是所有者
          if (!auditorStatus) {
            const owner = await contract.owner();
            if (owner.toLowerCase() === address.toLowerCase()) {
              try {
                const tx = await contract.addAuditor(address);
                await tx.wait();
                setIsAuditor(true);
              } catch (error) {
                console.error('添加审计员失败:', error);
              }
            }
          }
        }
      } catch (error) {
        console.error('检查钱包连接失败:', error);
        setIsConnected(false);
        setIsAuditor(false);
      }
    } else {
      setIsConnected(false);
      setIsAuditor(false);
    }
  };

  // 监听钱包连接状态变化
  useEffect(() => {
    if (contract) {
      checkWalletConnection();
      
      if (window.ethereum) {
        window.ethereum.on('accountsChanged', checkWalletConnection);
        window.ethereum.on('chainChanged', checkWalletConnection);
      }

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', checkWalletConnection);
          window.ethereum.removeListener('chainChanged', checkWalletConnection);
        }
      };
    }
  }, [contract]);

  // 获取待审核的NFT铸造申请
  const fetchPendingRequests = async () => {
    if (!contract || !isConnected) return;
    try {
      setLoading(true);
      const filter = contract.filters.MintRequested();
      const events = await contract.queryFilter(filter);
      
      const requests = await Promise.all(events.map(async (event) => {
        if (!event.args) return null;
        const audit = await contract.audits(event.args.tokenId);
        if (audit.status === 0) {
          return {
            tokenId: event.args.tokenId.toString(),
            requester: event.args.requester,
            title: event.args.title,
            details: event.args.details,
            carbonReduction: event.args.carbonReduction.toString(),
            tokenURI: event.args.tokenURI,
            totalFee: event.args.totalFee.toString(),
            requestId: `${event.args.tokenId}-${event.args.requester}`
          };
        }
        return null;
      }));

      setPendingRequests(requests.filter(req => req !== null));
    } catch (error) {
      console.error('获取待审核申请失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取已审计的NFT申请
  const fetchAuditedRequests = async () => {
    if (!contract || !isConnected) return;
    try {
      const filter = contract.filters.AuditSubmitted();
      const events = await contract.queryFilter(filter);
      
      const requests = await Promise.all(events.map(async (event) => {
        if (!event.args) return null;
        const audit = await contract.audits(event.args.tokenId);
        return {
          tokenId: event.args.tokenId.toString(),
          auditor: event.args.auditor,
          carbonValue: event.args.carbonValue.toString(),
          auditType: event.args.auditType.toString(),
          status: audit.status === 0 ? 'pending' : audit.status === 1 ? 'approved' : 'rejected',
          timestamp: new Date().toLocaleString(),
          auditId: `${event.args.tokenId}-${event.args.auditor}-${event.args.auditType}`
        };
      }));

      setAuditedRequests(requests.filter(req => req !== null));
    } catch (error) {
      console.error('获取已审计申请失败:', error);
    }
  };

  // 提交审计结果
  const handleSubmitAudit = async (tokenId: string, status: number, carbonValue: string, reason: string = '') => {
    if (!contract) return;
    try {
      setSubmitting(tokenId);
      console.log('提交审计:', { tokenId, status, carbonValue, reason });
      
      let tx;
      if (status === 1) { // 通过
        tx = await contract.submitMintAudit(
          tokenId,
          carbonValue,
          reason
        );
      } else { // 拒绝
        tx = await contract.submitMintAudit(
          tokenId,
          '0',
          reason
        );
      }
      
      console.log('审计交易已发送:', tx.hash);
      await tx.wait();
      console.log('审计交易已确认');
      
      // 刷新待审核和已审计列表
      await Promise.all([
        fetchPendingRequests(),
        fetchAuditedRequests()
      ]);
    } catch (error) {
      console.error('提交审计失败:', error);
    } finally {
      setSubmitting(null);
    }
  };

  // 当钱包连接状态改变时，获取申请列表
  useEffect(() => {
    if (isConnected && isAuditor) {
      Promise.all([
        fetchPendingRequests(),
        fetchAuditedRequests()
      ]);
    }
  }, [isConnected, isAuditor]);

  // 监听审计事件
  useEffect(() => {
    if (!contract || !isConnected || !isAuditor) return;

    const auditFilter = contract.filters.AuditSubmitted();
    contract.on(auditFilter, async (tokenId, auditor, carbonValue, auditType) => {
      console.log('审计提交事件:', { tokenId: tokenId.toString(), auditor, carbonValue: carbonValue.toString(), auditType });
      await fetchAuditedRequests();
    });

    const auditCompletedFilter = contract.filters.AuditCompleted();
    contract.on(auditCompletedFilter, async (tokenId, status) => {
      console.log('审计完成事件:', { tokenId: tokenId.toString(), status });
      await Promise.all([
        fetchPendingRequests(),
        fetchAuditedRequests()
      ]);
    });

    return () => {
      contract.removeAllListeners(auditFilter);
      contract.removeAllListeners(auditCompletedFilter);
    };
  }, [contract, isConnected, isAuditor]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">请先连接钱包</h1>
            <p className="mt-2 text-gray-600">连接钱包后即可访问审计中心</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuditor) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">无权访问</h1>
            <p className="mt-2 text-gray-600">您不是审计员，无法访问此页面</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">审计中心</h1>
        
        {/* 待审核列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">待审核的NFT铸造申请</h2>
          {loading ? (
            <div className="text-center py-4">加载中...</div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-4 text-gray-500">暂无待审核的申请</div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div key={request.requestId} className="border rounded-lg p-4">
                  <h3 className="font-medium">{request.title}</h3>
                  <p className="text-gray-600 mt-2">{request.details}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    <p>申请人: {request.requester}</p>
                    <p>碳减排量: {request.carbonReduction}</p>
                    <p>申请费用: {ethers.utils.formatEther(request.totalFee)} ETH</p>
                  </div>
                  
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        确认碳减排量
                      </label>
                      <input
                        type="number"
                        value={auditValues[request.tokenId]?.carbonValue || ''}
                        onChange={(e) => setAuditValues(prev => ({
                          ...prev,
                          [request.tokenId]: {
                            ...prev[request.tokenId],
                            carbonValue: e.target.value
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        placeholder="请输入确认的碳减排量"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        审核意见
                      </label>
                      <textarea
                        value={auditValues[request.tokenId]?.reason || ''}
                        onChange={(e) => setAuditValues(prev => ({
                          ...prev,
                          [request.tokenId]: {
                            ...prev[request.tokenId],
                            reason: e.target.value
                          }
                        }))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                        rows={3}
                        placeholder="请输入审核意见"
                      />
                    </div>
                    
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleSubmitAudit(
                          request.tokenId,
                          1,
                          auditValues[request.tokenId]?.carbonValue || request.carbonReduction,
                          auditValues[request.tokenId]?.reason || '审核通过'
                        )}
                        disabled={submitting === request.tokenId}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400"
                      >
                        {submitting === request.tokenId ? '提交中...' : '通过'}
                      </button>
                      <button
                        onClick={() => handleSubmitAudit(
                          request.tokenId,
                          2,
                          '0',
                          auditValues[request.tokenId]?.reason || '审核拒绝'
                        )}
                        disabled={submitting === request.tokenId}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:bg-gray-400"
                      >
                        {submitting === request.tokenId ? '提交中...' : '拒绝'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 已审计列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6">已审计的NFT申请</h2>
          {auditedRequests.length === 0 ? (
            <div className="text-center py-4 text-gray-500">暂无已审计的申请</div>
          ) : (
            <div className="space-y-4">
              {auditedRequests.map((request) => (
                <div key={request.auditId} className="border rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Token ID</p>
                      <p className="font-medium">{request.tokenId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">审计员</p>
                      <p className="font-medium">{request.auditor}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">确认碳减排量</p>
                      <p className="font-medium">{request.carbonValue}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">审计状态</p>
                      <p className="font-medium">
                        {request.status === 'pending' ? '待审核' :
                         request.status === 'approved' ? '已通过' :
                         request.status === 'rejected' ? '已拒绝' : '未知'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">审计时间</p>
                      <p className="font-medium">{request.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 