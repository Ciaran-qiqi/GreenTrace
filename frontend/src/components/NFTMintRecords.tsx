'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNFTMintRecords, type MintRecord } from '@/contracts/hooks/useNFTMintRecords';
import { RequestDetailModal, type RequestRecord } from './RequestDetailModal';
import { usePayAndMintNFT } from '@/contracts/hooks/useGreenTrace';
import { useRouter } from 'next/navigation';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';
import { NFTViewButton } from './NFTViewButton';

// NFT创建记录列表组件Props接口
interface NFTMintRecordsProps {
  autoRefresh?: boolean; // 是否自动刷新数据
}

// NFT创建记录列表组件（只保留链上数据源）
export const NFTMintRecords: React.FC<NFTMintRecordsProps> = ({ autoRefresh = false }) => {
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RequestRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  // 删除NFT弹窗相关状态，现在由NFTViewButton组件自己管理

  // 链上数据hook
  const { 
    records, 
    loading, 
    refreshRecords, 
    enableEventListening, 
    isEventListening 
  } = useNFTMintRecords();
  const { payAndMint, isPending, isConfirming, isConfirmed, error: mintError } = usePayAndMintNFT();

  const router = useRouter();

  // 只在客户端渲染
  useEffect(() => { setIsClient(true); }, []);

  // 将MintRecord转换为RequestRecord格式
  const convertToRequestRecord = (record: MintRecord): RequestRecord => {
    return {
      tokenId: record.tokenId,
      title: record.title,
      details: record.details,
      carbonReduction: record.carbonReduction,
      tokenURI: record.tokenURI,
      totalFee: record.totalFee,
      status: record.status as 'pending' | 'approved' | 'rejected' | 'minted',
      timestamp: record.timestamp,
      auditor: record.auditor,
      carbonValue: record.carbonValue,
      reason: record.reason,
      transactionHash: record.transactionHash,
      source: record.source
    };
  };

  // 自动刷新处理
  useEffect(() => {
    if (autoRefresh && isConnected && address) {
      console.log('触发自动刷新NFT记录');
      refreshRecords();
    }
  }, [autoRefresh, isConnected, address, refreshRecords]);

  // 移除canCancel状态监听 - 现在通过disabled属性直接控制

  // 查看详情 - 将MintRecord转换为RequestRecord格式
  const handleViewDetails = (record: MintRecord) => {
    setSelectedRecord(convertToRequestRecord(record));
    setIsModalOpen(true);
  };

    // 继续铸造
  const handleContinueMint = async (record: RequestRecord) => {
    if (!address) {
      alert('请先连接钱包');
      return;
    }
    
    if (record.status !== 'approved') {
      alert(`申请状态不正确：${record.status}，只有已批准的申请才能铸造NFT`);
      return;
    }

    console.log('🎨 准备铸造NFT:', {
      申请ID: record.tokenId,
      申请标题: record.title,
      用户地址: address
    });

    // 铸造前启用事件监听
    enableEventListening(30000);
    
    setSelectedRecord(record);
    setShowMintModal(true);
    
    try {
      const requestId = typeof record.tokenId === 'string' ? parseInt(record.tokenId) : record.tokenId;
      payAndMint(BigInt(requestId));
    } catch (error) {
      console.error('铸造失败:', error);
      setShowMintModal(false);
      setSelectedRecord(null);
      alert(`铸造失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 刷新 - 手动刷新时启用短期事件监听
  const handleRefresh = () => { 
    // 刷新时启用事件监听15秒，以便捕获可能的新事件
    enableEventListening(15000);
    refreshRecords(); 
  };
  // 取消铸造
  const handleCancelMint = () => {
    console.log('用户取消铸造');
    setShowMintModal(false);
    setSelectedRecord(null);
  };

  // 铸造完成
  const handleMintComplete = () => { 
    console.log('🎉 NFT铸造完成，开始强制刷新数据...');
    setShowMintModal(false); 
    setSelectedRecord(null);
    
    // 🔧 强制刷新数据 - 清除缓存并重新获取最新状态
    console.log('强制刷新：清除缓存并重新查询合约数据');
    refreshRecords(true); // force=true，清除缓存
    
    // 📊 额外等待3秒后再次刷新，确保区块链状态已更新
    setTimeout(() => {
      console.log('延迟刷新：确保区块链状态完全同步');
      refreshRecords(true);
    }, 3000);
    
    // 💡 启用较长时间的事件监听，捕获可能的状态变化
    enableEventListening(45000); // 45秒监听
  };
  // 关闭弹窗
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedRecord(null); };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">请先连接钱包</h3>
            <p className="text-gray-500">连接钱包后查看您的NFT创建记录</p>
          </div>
        </div>
      </div>
    );
  }
  if (!isClient) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">我的NFT创建记录</h2>
              <p className="text-gray-600 mt-1">查看您的所有NFT创建申请和状态</p>
              {/* 事件监听状态指示器 */}
              {isEventListening && (
                <div className="mt-2 inline-flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  实时监听中...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 rounded-lg hover:disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? '刷新中...' : '刷新'}
              </button>
              <button
                onClick={() => refreshRecords(true)}
                disabled={loading}
                className="px-4 py-2 rounded-lg hover:disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-gray-600 text-white hover:bg-gray-700"
                title="强制刷新所有数据，清除缓存"
              >
                🔄 强制刷新
              </button>
            </div>
          </div>
          {/* 错误提示 */}
          {/* 记录列表 */}
          {!loading && (
            <div className="space-y-4">
              {records.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无创建记录</h3>
                  <p className="text-gray-500 mb-6">您还没有创建过NFT申请</p>
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors" onClick={() => router.push('/create')}>
                    创建第一个NFT
                  </button>
                </div>
              ) : (
                records.map((record, index) => (
                  <div key={record.transactionHash || `${record.tokenId}-${record.timestamp}-${index}`}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">#{record.tokenId} {record.title}</h3>
                          {/* 显示状态标签 */}
                          {record.status === 'minted' ? (
                            <div className="flex items-center gap-2">
                              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">
                                🎨 已铸造
                              </span>
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-200">
                                NFT #{(record as any).nftTokenId || '0'}
                              </span>
                            </div>
                          ) : record.status === 'approved' ? (
                            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-yellow-200">
                              ⏳ 等待铸造
                            </span>
                          ) : record.status === 'pending' ? (
                            <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-gray-200">
                              ⏱️ 待审核
                            </span>
                          ) : record.status === 'rejected' ? (
                            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-200">
                              ❌ 已拒绝
                            </span>
                          ) : null}
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">{record.details}</p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div>{formatTimestamp(record.timestamp)}</div>
                        <div className="mt-1">费用: {formatFeeAmount(record.totalFee)} CARB</div>
                      </div>
                    </div>
                    {/* 详细信息 */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div><span className="text-gray-500">碳减排量:</span><span className="ml-2 font-medium">{record.carbonReduction} CARB</span></div>
                      {record.carbonValue && (<div><span className="text-gray-500">审计确认价值:</span><span className="ml-2 font-medium">{record.carbonValue} CARB</span></div>)}
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex gap-3">
                      <button onClick={() => handleViewDetails(record)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">查看详情</button>
                      {record.status === 'approved' && (
                        <button onClick={() => handleContinueMint(convertToRequestRecord(record))} className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition-colors">继续铸造</button>
                      )}
                      {record.status === 'minted' && (
                        <NFTViewButton 
                          nftTokenId={(record as any).nftTokenId || '0'}
                          buttonText="查看NFT"
                          buttonStyle="primary"
                          size="sm"
                        />
                      )}
                      {record.status === 'rejected' && (
                        <button className="bg-gray-600 text-white px-4 py-1 rounded text-sm hover:bg-gray-700 transition-colors">重新申请</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {/* 详情弹窗 */}
      <RequestDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onContinueMint={handleContinueMint}
      />

      {/* 铸造状态弹窗 - 优化版 */}
      {showMintModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4 relative">
            {/* 关闭按钮 */}
            <button
              onClick={handleCancelMint}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100/80 hover:bg-gray-200/80 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 backdrop-blur-sm"
              disabled={isConfirming} // 确认阶段不允许关闭
            >
              <span className="text-xl">×</span>
            </button>

            <div className="text-center">
              {/* 准备阶段 */}
              {isPending && !isConfirming && !isConfirmed && !mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">⏳</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">准备铸造NFT</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">正在准备铸造交易，请在钱包中确认...</p>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-blue-600">审计确认价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-3">
                    <button 
                      onClick={handleCancelMint}
                      className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                    >
                      取消
                    </button>
                  </div>
                </>
              )}
              
              {/* 确认阶段 */}
              {isConfirming && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造进行中</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">正在等待区块链确认，请耐心等待...</p>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 mb-6 border border-amber-200/30">
                    <div className="text-sm text-amber-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-amber-600">⚠️ 请勿关闭此窗口或刷新页面</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <div className="animate-pulse">🔗</div>
                    <span>区块链确认中...</span>
                  </div>
                </>
              )}
              
              {/* 成功状态 */}
              {isConfirmed && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">✅</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造成功！</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">恭喜！您的NFT已经成功铸造到区块链上</p>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 mb-6 border border-green-200/30">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-800 mb-2">
                        🎨 #{selectedRecord.tokenId} {selectedRecord.title}
                      </div>
                      <div className="text-green-600 font-medium">
                        价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB
                      </div>
                      <div className="mt-3 flex items-center justify-center space-x-2 text-sm text-green-700">
                        <span>🌱</span>
                        <span>为环保事业贡献一份力量</span>
                        <span>🌱</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleMintComplete} 
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    完成
                  </button>
                </>
              )}
              
              {/* 错误状态 */}
              {mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">❌</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造失败</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">很抱歉，NFT铸造过程中遇到了问题</p>
                  
                  {/* 错误详情 */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 mb-6 border border-red-200/30">
                    <div className="text-sm text-red-800">
                      <div className="font-semibold mb-2">错误详情:</div>
                      <div className="bg-white/70 p-3 rounded-lg text-red-600 break-words text-left">
                        {mintError.message || '未知错误'}
                      </div>
                      
                    </div>
                  </div>

                  {/* NFT信息 */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200/30">
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold">申请信息:</div>
                      <div className="mt-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-gray-500">价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  {/* 常见解决方案提示 */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-2">💡 可能的解决方案:</div>
                      <ul className="text-left space-y-1 text-blue-600">
                        <li>• 检查钱包中是否有足够的CARB代币</li>
                        <li>• 确认申请状态是否为&ldquo;已批准&rdquo;</li>
                        <li>• 验证申请ID是否正确：#{selectedRecord.tokenId}</li>
                        <li>• 检查是否已经铸造过此NFT</li>
                        <li>• 确认网络连接是否正常</li>
                        <li>• 检查是否连接到正确的网络（Sepolia测试网）</li>
                        <li>• 稍后再次尝试铸造</li>
                      </ul>
                    </div>
                  </div>

                  {/* 具体错误分析 */}
                  {mintError.message && (
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 rounded-xl p-4 mb-6 border border-yellow-200/30">
                      <div className="text-sm text-yellow-800">
                        <div className="font-semibold mb-2">🔍 错误分析:</div>
                        <div className="text-yellow-700 text-left">
                          {mintError.message.includes('User rejected') && (
                            <div>用户在钱包中拒绝了交易。请重新尝试并在钱包弹窗中点击确认。</div>
                          )}
                          {(mintError.message.includes('insufficient allowance') || 
                            mintError.message.includes('ERC20') || 
                            JSON.stringify(mintError).toLowerCase().includes('insufficient allowance')) && (
                            <div>
                              <div className="font-bold text-red-600 mb-2">🎯 真正问题：CARB代币授权不足</div>
                              <div className="space-y-1">
                                <div>• 您的CARB代币余额可能充足，但没有授权GreenTrace合约使用</div>
                                <div>• 需要先调用CARB代币的approve函数授权合约</div>
                                <div>• 这就是为什么区块链浏览器显示&ldquo;ERC20: insufficient allowance&rdquo;的原因</div>
                                <div className="mt-2 p-2 bg-blue-50 rounded text-blue-700">
                                  💡 解决方案：点击&ldquo;继续铸造&rdquo;按钮，系统会自动引导您完成代币授权流程
                                </div>
                              </div>
                            </div>
                          )}
                          {mintError.message.includes('insufficient funds') && (
                            <div>账户余额不足。请确保钱包中有足够的ETH支付Gas费用和CARB代币支付铸造费用。</div>
                          )}
                          {mintError.message.includes('revert') && !mintError.message.includes('insufficient allowance') && (
                            <div>合约调用被拒绝。可能原因：申请状态不正确、权限不足、或申请已被处理。</div>
                          )}
                          {mintError.message.includes('timeout') && (
                            <div>交易超时。网络可能拥堵，请稍后重试。</div>
                          )}
                          {mintError.message.includes('nonce') && (
                            <div>交易序号冲突。请重置MetaMask账户或等待一段时间后重试。</div>
                          )}
                          {!mintError.message.includes('User rejected') && 
                           !mintError.message.includes('insufficient allowance') &&
                           !mintError.message.includes('ERC20') &&
                           !JSON.stringify(mintError).toLowerCase().includes('insufficient allowance') &&
                           !mintError.message.includes('insufficient funds') && 
                           !mintError.message.includes('revert') && 
                           !mintError.message.includes('timeout') && 
                           !mintError.message.includes('nonce') && (
                            <div>
                              <div>未知错误类型。建议检查网络连接和合约状态，或联系技术支持。</div>
                              <div className="mt-2 p-2 bg-gray-50 rounded text-gray-600 text-xs">
                                🔍 调试信息：请检查区块链浏览器获取真实错误原因
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button 
                      onClick={handleMintComplete} 
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors duration-200"
                    >
                      关闭
                    </button>
                    <button 
                      onClick={() => {
                        // 重新尝试铸造
                        if (selectedRecord) {
                          console.log('🔄 重新尝试铸造 - requestId:', selectedRecord.tokenId);
                          const requestId = typeof selectedRecord.tokenId === 'string' ? parseInt(selectedRecord.tokenId) : selectedRecord.tokenId;
                          payAndMint(BigInt(requestId));
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all duration-200"
                    >
                      重试
                    </button>
                  </div>
                </>
              )}

              {/* 初始状态（没有任何操作进行时） */}
              {!isPending && !isConfirming && !isConfirmed && !mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">🎨</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">准备就绪</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">点击开始铸造您的绿色NFT</p>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 mb-6 border border-green-200/30">
                    <div className="text-sm text-green-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-green-600">价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button 
                      onClick={handleCancelMint}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors duration-200"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedRecord) {
                          const requestId = typeof selectedRecord.tokenId === 'string' ? parseInt(selectedRecord.tokenId) : selectedRecord.tokenId;
                          payAndMint(BigInt(requestId));
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      开始铸造
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};