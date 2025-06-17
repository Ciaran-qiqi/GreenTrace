'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/src/components/Navbar';
import { NFTMintForm } from '@/src/components/NFTMintForm';
import { useContract } from '@/src/hooks/useContract';
import { ethers } from 'ethers';

export default function NFTCenter() {
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [minting, setMinting] = useState<string | null>(null);
  const { contract } = useContract();

  // 检查钱包连接状态
  const checkWalletConnection = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        setIsConnected(accounts.length > 0);
      } catch (error) {
        console.error('检查钱包连接失败:', error);
        setIsConnected(false);
      }
    } else {
      setIsConnected(false);
    }
  };

  // 获取历史申请记录
  const fetchHistoricalRequests = async () => {
    if (!contract || !isConnected) return;
    try {
      const filter = contract.filters.MintRequested(null, null);
      const events = await contract.queryFilter(filter);
      
      const requests = await Promise.all(events
        .filter(event => event.args && event.args.requester.toLowerCase() === window.ethereum.selectedAddress.toLowerCase())
        .map(async (event) => {
          if (!event.args) return null;
          const audit = await contract.audits(event.args.tokenId);
          return {
            tokenId: event.args.tokenId.toString(),
            title: event.args.title,
            details: event.args.details,
            carbonReduction: event.args.carbonReduction.toString(),
            tokenURI: event.args.tokenURI,
            totalFee: event.args.totalFee.toString(),
            status: audit.status === 0 ? 'pending' : audit.status === 1 ? 'approved' : 'rejected'
          };
        }));

      setMyRequests(requests.filter((req): req is NonNullable<typeof req> => req !== null));
    } catch (error) {
      console.error('获取历史申请记录失败:', error);
    }
  };

  // 支付铸造费用并铸造NFT
  const handleMintNFT = async (tokenId: string, title: string, details: string, carbonReduction: string, tokenURI: string) => {
    if (!contract) return;
    try {
      setMinting(tokenId);
      console.log('开始铸造NFT:', { tokenId, title, details, carbonReduction, tokenURI });
      
      const tx = await contract.payAndMintNFT(
        tokenId,
        window.ethereum.selectedAddress,
        title,
        details,
        carbonReduction,
        tokenURI
      );
      
      console.log('铸造交易已发送:', tx.hash);
      await tx.wait();
      console.log('铸造交易已确认');
      
      // 刷新申请列表
      await fetchHistoricalRequests();
    } catch (error) {
      console.error('铸造NFT失败:', error);
    } finally {
      setMinting(null);
    }
  };

  // 监听钱包连接状态变化
  useEffect(() => {
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
  }, []);

  // 当钱包连接状态改变时，获取历史记录
  useEffect(() => {
    if (isConnected) {
      fetchHistoricalRequests();
    }
  }, [isConnected]);

  // 监听NFT申请事件
  useEffect(() => {
    if (!contract || !isConnected) return;

    const filter = contract.filters.MintRequested(null, null);
    contract.on(filter, (tokenId, requester, title, details, carbonReduction, tokenURI, totalFee) => {
      if (requester.toLowerCase() === window.ethereum.selectedAddress.toLowerCase()) {
        setMyRequests(prev => [...prev, {
          tokenId: tokenId.toString(),
          title,
          details,
          carbonReduction: carbonReduction.toString(),
          tokenURI,
          totalFee: totalFee.toString(),
          status: 'pending'
        }]);
      }
    });

    const auditFilter = contract.filters.AuditCompleted();
    contract.on(auditFilter, async (tokenId, status) => {
      console.log('审计完成事件:', { tokenId: tokenId.toString(), status });
      setMyRequests(prev => prev.map(req => {
        if (req.tokenId === tokenId.toString()) {
          return {
            ...req,
            status: status === 1 ? 'approved' : 'rejected'
          };
        }
        return req;
      }));
    });

    return () => {
      contract.removeAllListeners(filter);
      contract.removeAllListeners(auditFilter);
    };
  }, [contract, isConnected]);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">请先连接钱包</h1>
            <p className="mt-2 text-gray-600">连接钱包后即可申请铸造NFT</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">NFT中心</h1>
        
        {/* 我的申请列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">我的NFT申请</h2>
          {myRequests.length === 0 ? (
            <p className="text-gray-500">暂无申请记录</p>
          ) : (
            <div className="space-y-4">
              {myRequests.map((request) => (
                <div key={request.tokenId} className="border rounded-lg p-4">
                  <h3 className="font-medium">{request.title}</h3>
                  <p className="text-gray-600 mt-2">{request.details}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    <p>碳减排量: {request.carbonReduction}</p>
                    <p>申请费用: {ethers.utils.formatEther(request.totalFee)} ETH</p>
                    <p>状态: {
                      request.status === 'pending' ? '等待审计' :
                      request.status === 'approved' ? '已通过' :
                      request.status === 'rejected' ? '已拒绝' : '未知'
                    }</p>
                  </div>
                  {request.status === 'approved' && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleMintNFT(
                          request.tokenId,
                          request.title,
                          request.details,
                          request.carbonReduction,
                          request.tokenURI
                        )}
                        disabled={minting === request.tokenId}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400"
                      >
                        {minting === request.tokenId ? '铸造中...' : '支付费用并铸造NFT'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NFT铸造表单 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-6">铸造新NFT</h2>
          <NFTMintForm />
        </div>
      </div>
    </main>
  );
} 