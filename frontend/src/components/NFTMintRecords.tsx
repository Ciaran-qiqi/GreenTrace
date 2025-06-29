'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { useNFTMintRecords, type MintRecord } from '@/contracts/hooks/useNFTMintRecords';
import { RequestDetailModal, type RequestRecord } from './RequestDetailModal';
import { usePayAndMintNFT } from '@/contracts/hooks/useGreenTrace';
import { useRouter } from 'next/navigation';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';
import { NFTViewButton } from './NFTViewButton';
import { getGreenTalesNFTAddress } from '@/contracts/addresses';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { useTranslation } from '@/hooks/useI18n';
import { getAuditTranslation, hasAuditTranslation } from '@/utils/auditTranslations';

// Nft create record list component props interface
interface NFTMintRecordsProps {
  autoRefresh?: boolean; // Whether to refresh the data automatically
}

// Check whether nft exists hook (used to determine whether it has been redeemed and destroyed)
const useCheckNFTExists = (tokenId: string | undefined) => {
  const chainId = useChainId();
  const nftContractAddress = getGreenTalesNFTAddress(chainId);
  
  return useReadContract({
    address: nftContractAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'ownerOf',
    args: tokenId ? [BigInt(tokenId)] : undefined,
    query: {
      enabled: !!tokenId,
      retry: false, // Don't try again, because nft does not exist will throw an error
    }
  });
};

// Nft creates record list component (only keeps on the chain data source)
export const NFTMintRecords: React.FC<NFTMintRecordsProps> = ({ autoRefresh = false }) => {
  const { t, language } = useTranslation();
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RequestRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  // Pagination related status
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 3; // 3 records are displayed per page
  
  // Delete the status of nft popup windows, which is now managed by the nft view button component itself.

  // On-chain data hook
  const { 
    records, 
    loading, 
    refreshRecords, 
    enableEventListening, 
    isEventListening 
  } = useNFTMintRecords();
  const { payAndMint, isPending, isConfirming, isConfirmed, error: mintError } = usePayAndMintNFT();

  const router = useRouter();

  // Render only on the client side
  useEffect(() => { setIsClient(true); }, []);

  // Listen to global nft redemption events and update status in real time
  useEffect(() => {
    const handleNFTExchanged = (event: CustomEvent) => {
      console.log('创建中心检测到NFT兑换事件:', event.detail);
      // Force refresh the data immediately to reflect the redemption status
      refreshRecords(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      
      return () => {
        window.removeEventListener('nft-exchanged', handleNFTExchanged as EventListener);
      };
    }
  }, [refreshRecords]);

  // Sort and pagination processing
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      // Sort from new to old (sequence timestamp)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [records]);

  // Calculate paging data
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    return sortedRecords.slice(startIndex, endIndex);
  }, [sortedRecords, currentPage, recordsPerPage]);

  // Calculate the total number of pages
  const totalPages = Math.ceil(sortedRecords.length / recordsPerPage);

  // When the number of records changes, reset to the first page
  useEffect(() => {
    setCurrentPage(1);
  }, [records.length]);

  // Convert mint record to request record format
  const convertToRequestRecord = (record: MintRecord): RequestRecord => {
    // 🔥 Fix: Priority to using real on-chain data, only example translation is used if the data is empty or unreasonable
    const translatedContent = getAuditTranslation(
      record.tokenId.toString(), 
      language, 
      record.title, 
      record.details,
      true // preferOriginal = true, preferentially use original on-chain data
    );
    
    return {
      tokenId: record.tokenId,
      title: translatedContent.title,
      details: translatedContent.details,
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

  // Automatic refresh processing
  useEffect(() => {
    if (autoRefresh && isConnected && address) {
      console.log('触发自动刷新NFT记录');
      refreshRecords();
    }
  }, [autoRefresh, isConnected, address, refreshRecords]);

  // Remove canCancel status listening -now directly control through disabled attribute

  // View details -Convert MintRecord to RequestRecord format
  const handleViewDetails = (record: MintRecord) => {
    setSelectedRecord(convertToRequestRecord(record));
    setIsModalOpen(true);
  };

    // Continue to cast
  const handleContinueMint = async (record: RequestRecord) => {
    if (!address) {
      alert(t('auth.pleaseConnectWallet'));
      return;
    }
    
    if (record.status !== 'approved') {
      alert(`${t('nftRecords.statusError')} ${record.status}，${t('nftRecords.onlyApprovedCanMint')}`);
      return;
    }

    console.log('🎨 准备铸造NFT:', {
      申请ID: record.tokenId,
      申请标题: record.title,
      用户地址: address
    });

    // Enable event monitoring before casting
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
      alert(`${t('nftRecords.errors.mintFailed')} ${error instanceof Error ? error.message : t('common.unknownError')}`);
    }
  };

  // Refresh -Enable short-term event listening when refreshing manually
  const handleRefresh = () => { 
    // Enable event listening for 15 seconds on refresh to capture possible new events
    enableEventListening(15000);
    refreshRecords(); 
  };
  // Cancel casting
  const handleCancelMint = () => {
    console.log('用户取消铸造');
    setShowMintModal(false);
    setSelectedRecord(null);
  };

  // Casting completed
  const handleMintComplete = () => { 
    console.log('🎉 NFT铸造完成，开始强制刷新数据...');
    setShowMintModal(false); 
    setSelectedRecord(null);
    
    // 🔧 Force refresh data -Clear cache and re-get latest status
    console.log('强制刷新：清除缓存并重新查询合约数据');
    refreshRecords(true); // Force=true, clear cache
    
    // 📊 Wait for an extra 3 seconds before refreshing again to ensure that the blockchain status has been updated
    setTimeout(() => {
      console.log('延迟刷新：确保区块链状态完全同步');
      refreshRecords(true);
    }, 3000);
    
    // 💡 Enable long-term event listening to capture possible state changes
    enableEventListening(45000); // 45 seconds monitoring
  };
  // Close pop-up window
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedRecord(null); };

  // Pagination processing function
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('nftRecords.connectWallet')}</h3>
            <p className="text-gray-500">{t('nftRecords.connectWalletDesc')}</p>
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
            <p className="text-gray-600">{t('common.loading')}</p>
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
              <h2 className="text-2xl font-bold text-gray-800">{t('created.title')}</h2>
              <p className="text-gray-600 mt-1">{t('created.subtitle')}</p>
              {/* Event listening status indicator */}
              {isEventListening && (
                <div className="mt-2 inline-flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  {t('nftRecords.listening')}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 rounded-lg hover:disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? t('nftRecords.refreshing', '刷新中...') : t('nftRecords.refresh', '刷新')}
              </button>
              <button
                onClick={() => refreshRecords(true)}
                disabled={loading}
                className="px-4 py-2 rounded-lg hover:disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-gray-600 text-white hover:bg-gray-700"
                title={t('nftRecords.forceRefreshTitle', '强制刷新所有数据，清除缓存')}
              >
                {t('nftRecords.forceRefresh', '🔄 强制刷新')}
              </button>
            </div>
          </div>
          {/* Error message */}
          {/* Record list */}
          {!loading && (
            <div className="space-y-4">
              {records.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">{t('nftRecords.noRecords')}</h3>
                  <p className="text-gray-500 mb-6">{t('nftRecords.noRecordsDesc')}</p>
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors" onClick={() => router.push(`/create/${language}`)}>
                    {t('nftRecords.createFirst')}
                  </button>
                </div>
              ) : (
                paginatedRecords.map((record) => {
                  // Record card component with nft existence check
                  const RecordCard = () => {
                    const { error: nftError } = useCheckNFTExists(
                      record.status === 'minted' ? (record as any).nftTokenId || '0' : undefined
                    );
                    const nftExists = !nftError;

                    return (
                                             <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-800">#{record.tokenId} {getAuditTranslation(record.tokenId.toString(), language, record.title, record.details).title}</h3>
                              {/* Translation indicator */}
                              {hasAuditTranslation(record.tokenId.toString(), language) && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                  <span>🌐</span>
                                  <span>{t('nftRecords.contentTranslated')}</span>
                                </div>
                              )}
                              {/* Status Badge */}
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                record.status === 'approved' ? 'bg-green-100 text-green-800' :
                                record.status === 'minted' ? 'bg-purple-100 text-purple-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {record.status === 'pending' ? `⏳ ${t('nftRecords.status.pending')}` :
                                 record.status === 'approved' ? `✅ ${t('nftRecords.status.approved')}` :
                                 record.status === 'minted' ? `🎨 ${t('nftRecords.status.minted')}` :
                                 `❌ ${t('nftRecords.status.rejected')}`}
                              </span>
                              {/* Redeemed tags */}
                              {record.status === 'minted' && !nftExists && (
                                <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-orange-200">
                                  🔥 {t('nftRecords.status.exchanged')}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm line-clamp-2">{getAuditTranslation(record.tokenId.toString(), language, record.title, record.details).details}</p>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>{formatTimestamp(record.timestamp)}</div>
                            <div className="mt-1">{t('nftRecords.fee')}: {formatFeeAmount(record.totalFee)} CARB</div>
                          </div>
                        </div>

                        {/* Application details */}
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <span className="text-gray-500">{t('nftRecords.carbonReduction')}:</span>
                            <span className="ml-2 font-medium text-green-600">{record.carbonReduction} tCO₂e</span>
                          </div>
                          {record.carbonValue && (
                            <div>
                              <span className="text-gray-500">{t('nftRecords.auditValue')}:</span>
                              <span className="ml-2 font-medium text-green-600">{record.carbonValue} tCO₂e</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-500">{t('nftRecords.applyTime')}:</span>
                            <span className="ml-2 font-medium">{formatTimestamp(record.timestamp)}</span>
                          </div>
                          {record.auditor && (
                            <div>
                              <span className="text-gray-500">{t('nftRecords.auditor')}:</span>
                              <span className="ml-2 font-medium">{record.auditor.slice(0, 6)}...{record.auditor.slice(-4)}</span>
                            </div>
                          )}
                        </div>

                        {/* Operation button */}
                        <div className="flex gap-3">
                          <button onClick={() => handleViewDetails(record)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">{t('nftRecords.viewDetails')}</button>
                          {record.status === 'approved' && (
                            <button onClick={() => handleContinueMint(convertToRequestRecord(record))} className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition-colors">{t('nftRecords.continueMint')}</button>
                          )}
                          {record.status === 'minted' && (
                            <NFTViewButton 
                              nftTokenId={(record as any).nftTokenId || '0'}
                              buttonText={t('nftRecords.viewNFT')}
                              buttonStyle="primary"
                              size="sm"
                              nftExists={nftExists}
                            />
                          )}
                          {record.status === 'rejected' && (
                            <button className="bg-gray-600 text-white px-4 py-1 rounded text-sm hover:bg-gray-700 transition-colors">{t('nftRecords.reapply')}</button>
                          )}
                        </div>
                      </div>
                    );
                  };

                                     return <RecordCard key={record.transactionHash || `${record.tokenId}-${record.timestamp}`} />;
                })
              )}
            </div>
          )}
          
          {/* Pagination controls */}
          {!loading && records.length > 0 && totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center space-x-2">
              {/* Previous page button */}
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('pagination.previous', '上一页')}
              </button>
              
              {/* Page number button */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              {/* Next page button */}
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('pagination.next', '下一页')}
              </button>
            </div>
          )}
          
          {/* Pagination information */}
          {!loading && records.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              {t('pagination.info', '显示第 {start} - {end} 条，共 {total} 条记录').replace('{start}', String((currentPage - 1) * recordsPerPage + 1)).replace('{end}', String(Math.min(currentPage * recordsPerPage, records.length))).replace('{total}', String(records.length))}
            </div>
          )}
        </div>
      </div>
      {/* Details pop-up window */}
      <RequestDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onContinueMint={handleContinueMint}
      />

      {/* Casting status pop-up window -Optimized version */}
      {showMintModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4 relative">
            {/* Close button */}
            <button
              onClick={handleCancelMint}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100/80 hover:bg-gray-200/80 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 backdrop-blur-sm"
              disabled={isConfirming} // Confirmation phase does not allow closing
            >
              <span className="text-xl">×</span>
            </button>

            <div className="text-center">
              {/* Preparation phase */}
              {isPending && !isConfirming && !isConfirmed && !mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">⏳</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">{t('nftRecords.minting.preparingTitle', '准备铸造NFT')}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{t('nftRecords.minting.preparingDesc', '正在准备铸造交易，请在钱包中确认...')}</p>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-blue-600">{t('nftRecords.minting.auditValue', '审计确认价值')}: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-3">
                    <button 
                      onClick={handleCancelMint}
                      className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                    >
                      {t('nftRecords.minting.cancel', '取消')}
                    </button>
                  </div>
                </>
              )}
              
              {/* Confirmation phase */}
              {isConfirming && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">{t('nftRecords.minting.mintingTitle', '铸造进行中')}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{t('nftRecords.minting.mintingDesc', '正在等待区块链确认，请耐心等待...')}</p>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 mb-6 border border-amber-200/30">
                    <div className="text-sm text-amber-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-amber-600">{t('nftRecords.minting.doNotClose', '⚠️ 请勿关闭此窗口或刷新页面')}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <div className="animate-pulse">🔗</div>
                    <span>{t('nftRecords.minting.blockchainConfirming', '区块链确认中...')}</span>
                  </div>
                </>
              )}
              
              {/* Successful status */}
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
              
              {/* Error status */}
              {mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">❌</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造失败</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">很抱歉，NFT铸造过程中遇到了问题</p>
                  
                  {/* Error details */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 mb-6 border border-red-200/30">
                    <div className="text-sm text-red-800">
                      <div className="font-semibold mb-2">错误详情:</div>
                      <div className="bg-white/70 p-3 rounded-lg text-red-600 break-words text-left">
                        {mintError.message || '未知错误'}
                      </div>
                      
                    </div>
                  </div>

                  {/* Nft information */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200/30">
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold">申请信息:</div>
                      <div className="mt-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-gray-500">价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  {/* Common Solution Tips */}
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

                  {/* Specific error analysis */}
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
                        // Try casting again
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

              {/* Initial state (no operation is in progress) */}
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