'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { getCarbonTokenAddress, getGreenTalesNFTAddress } from '@/contracts/addresses';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { NFTViewButton } from './NFTViewButton';
import { NFTExchangeButton } from './NFTExchangeButton';
import { ListNFTModal } from './market/ListNFTModal';

// NFT信息接口
interface NFTInfo {
  tokenId: string;
  title: string;
  storyDetails: string;
  carbonReduction: string;
  initialPrice: string;
  lastPrice: string;
  createTime: string;
  owner: string;
}

// 我的资产组件
export const MyAssets: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isClient, setIsClient] = useState(false);
  const [userNFTs, setUserNFTs] = useState<NFTInfo[]>([]);
  const [loadingNFTs, setLoadingNFTs] = useState(false);
  
  // 挂单模态框状态
  const [showListModal, setShowListModal] = useState(false);
  const [selectedNFTForList, setSelectedNFTForList] = useState<NFTInfo | null>(null);

  // 获取合约地址
  const carbonTokenAddress = getCarbonTokenAddress(chainId);
  const nftContractAddress = getGreenTalesNFTAddress(chainId);

  // 获取CARB代币余额 - 使用wagmi直接调用（实时更新，自动缓存）
  const { data: carbBalance, refetch: refetchCarbBalance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isClient,
    }
  });

  // 获取NFT余额 - 使用wagmi直接调用（简单查询，实时更新）
  const { data: nftBalance, refetch: refetchNftBalance } = useReadContract({
    address: nftContractAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isClient,
    }
  });

  // 只在客户端渲染
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 处理挂单
  const handleListNFT = (nft: NFTInfo) => {
    setSelectedNFTForList(nft);
    setShowListModal(true);
  };

  // 挂单成功回调
  const handleListSuccess = () => {
    setShowListModal(false);
    setSelectedNFTForList(null);
    refreshAssets(); // 刷新资产数据
  };

  // 使用改进的NFT查询逻辑
  const fetchUserNFTs = async () => {
    if (!address || !nftBalance || Number(nftBalance) === 0) {
      console.log('🔍 NFT获取条件不满足:', { address, nftBalance: nftBalance?.toString() });
      setUserNFTs([]);
      return;
    }

    setLoadingNFTs(true);
    console.log('🚀 开始获取NFT信息...');
    
    try {
      const balance = Number(nftBalance);
      console.log(`📊 用户${address}拥有${balance}个NFT，开始查询详情...`);

      // 使用wagmi的readContracts进行批量查询
      const { readContracts } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      
      // 1. 批量获取用户拥有的所有NFT Token ID
      const tokenIdContracts = Array.from({ length: balance }, (_, i) => ({
        address: nftContractAddress as `0x${string}`,
        abi: GreenTalesNFTABI.abi as any,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, i],
      }));

      console.log('🔍 批量查询Token ID，合约配置:', {
        contractAddress: nftContractAddress,
        queries: tokenIdContracts.length
      });
      
      const tokenIdResults = await readContracts(config, { contracts: tokenIdContracts });
      console.log('📋 Token ID查询结果:', tokenIdResults);
      
      // 提取成功的Token ID
      const validTokenIds: bigint[] = [];
      tokenIdResults.forEach((result, index) => {
        console.log(`🔢 Token ID ${index} 查询结果:`, result);
        if (result.status === 'success' && result.result !== undefined && result.result !== null) {
          validTokenIds.push(result.result as bigint);
          console.log(`✅ 找到Token ID: ${(result.result as bigint).toString()}`);
        } else {
          console.warn(`❌ 获取Token ID ${index}失败:`, result);
        }
      });

      if (validTokenIds.length === 0) {
        console.log('⚠️ tokenOfOwnerByIndex查询失败，尝试备用查询方式...');
        
        // 备用方案：尝试从最大可能的Token ID范围内查找用户拥有的NFT
        // 先查询NFT合约的nextTokenId，确定Token ID范围
        const nextTokenIdResult = await readContracts(config, {
          contracts: [{
            address: nftContractAddress as `0x${string}`,
            abi: GreenTalesNFTABI.abi as any,
            functionName: 'nextTokenId',
            args: [],
          }]
        });
        
        if (nextTokenIdResult[0].status === 'success') {
          const nextTokenId = Number(nextTokenIdResult[0].result);
          console.log(`🔍 NFT合约nextTokenId: ${nextTokenId}，开始逐个检查Token ID 0-${nextTokenId-1}`);
          
          // 逐个检查每个Token ID的拥有者
          const ownerCheckContracts = Array.from({ length: nextTokenId }, (_, tokenId) => ({
            address: nftContractAddress as `0x${string}`,
            abi: GreenTalesNFTABI.abi as any,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          }));
          
          const ownerResults = await readContracts(config, { contracts: ownerCheckContracts });
          console.log('👤 所有Token ID拥有者查询结果:', ownerResults);
          
          // 找到用户拥有的Token ID
          ownerResults.forEach((result, tokenId) => {
            if (result.status === 'success' && result.result === address) {
              validTokenIds.push(BigInt(tokenId));
              console.log(`✅ 通过ownerOf找到用户拥有的Token ID: ${tokenId}`);
            }
          });
        }
        
        if (validTokenIds.length === 0) {
          console.log('⚠️ 备用查询也未找到NFT，但余额显示有NFT');
          // 创建占位符数据，显示查询问题
          const placeholderNFTs: NFTInfo[] = Array.from({ length: balance }, (_, i) => ({
            tokenId: `unknown_${i}`,
            title: `未知NFT #${i}`,
            storyDetails: `检测到您拥有${balance}个NFT，但无法查询到具体Token ID。这可能是合约接口问题或网络延迟导致的。请尝试刷新或联系技术支持。`,
            carbonReduction: '0',
            initialPrice: '0',
            lastPrice: '0',
            createTime: Date.now().toString(),
            owner: address
          }));
          setUserNFTs(placeholderNFTs);
          setLoadingNFTs(false);
          return;
        }
      }

      console.log(`✅ 找到${validTokenIds.length}个有效Token ID:`, validTokenIds.map(id => id.toString()));

      // 2. 批量获取NFT元数据
      const metaContracts = validTokenIds.map(tokenId => ({
        address: nftContractAddress as `0x${string}`,
        abi: GreenTalesNFTABI.abi as any,
        functionName: 'getStoryMeta',
        args: [tokenId],
      }));

      console.log('🎨 批量查询NFT元数据...');
      const metaResults = await readContracts(config, { contracts: metaContracts });
      console.log('📋 元数据查询结果:', metaResults);
      
      // 3. 组装NFT信息
      const nfts: NFTInfo[] = [];
      metaResults.forEach((result, index) => {
        const tokenId = validTokenIds[index];
        console.log(`🎨 处理NFT #${tokenId} 元数据:`, result);
        
        if (result.status === 'success' && result.result) {
          const meta = result.result as any;
          console.log(`📝 NFT #${tokenId} 元数据内容:`, meta);
          
          nfts.push({
            tokenId: tokenId.toString(),
            title: meta.storyTitle || `绿色NFT #${tokenId}`,
            storyDetails: meta.storyDetail || '',
            carbonReduction: meta.carbonReduction?.toString() || '0',
            initialPrice: meta.initialPrice?.toString() || '0',
            lastPrice: meta.lastPrice?.toString() || '0',
            createTime: meta.createTime?.toString() || '0',
            owner: address
          });
          console.log(`✅ NFT #${tokenId} 处理完成`);
        } else {
          console.warn(`❌ 获取NFT #${tokenId}元数据失败:`, result);
          // 即使元数据获取失败，也创建基本信息
          nfts.push({
            tokenId: tokenId.toString(),
            title: `绿色NFT #${tokenId}`,
            storyDetails: '元数据暂时无法获取，但NFT确实存在',
            carbonReduction: '0',
            initialPrice: '0',
            lastPrice: '0',
            createTime: '0',
            owner: address
          });
          console.log(`⚠️ NFT #${tokenId} 使用基本信息`);
        }
      });

      console.log(`🎉 成功获取${nfts.length}个NFT信息:`, nfts);
      setUserNFTs(nfts);

    } catch (error) {
      console.error('💥 获取用户NFT列表失败:', error);
      
      // 如果所有查询都失败，但确实有NFT余额，创建错误信息
      if (nftBalance && Number(nftBalance) > 0) {
        console.log('🔧 所有查询方式都失败，显示错误信息');
        const errorNFTs: NFTInfo[] = Array.from({ length: Number(nftBalance) }, (_, i) => ({
          tokenId: `error_${i}`,
          title: `NFT查询错误 #${i}`,
          storyDetails: `您确实拥有${Number(nftBalance)}个NFT，但查询时出现错误: ${error instanceof Error ? error.message : '未知错误'}。请尝试刷新页面或检查网络连接。`,
          carbonReduction: '0',
          initialPrice: '0',
          lastPrice: '0',
          createTime: Date.now().toString(),
          owner: address || ''
        }));
        setUserNFTs(errorNFTs);
        console.log('🔧 设置了错误提示NFT数据:', errorNFTs);
      } else {
        setUserNFTs([]);
      }
    } finally {
      setLoadingNFTs(false);
      console.log('🏁 NFT获取流程结束');
    }
  };

  // 当NFT余额变化时，重新获取NFT列表
  useEffect(() => {
    if (isClient && address && nftBalance !== undefined) {
      fetchUserNFTs();
    }
  }, [isClient, address, nftBalance]);

  // 刷新所有资产数据
  const refreshAssets = () => {
    refetchCarbBalance();
    refetchNftBalance();
    fetchUserNFTs();
  };

  // 等待客户端渲染
  if (!isClient) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">请先连接钱包</h3>
            <p className="text-gray-500">连接钱包后查看您的资产</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 资产概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARB代币余额 */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">CARB代币</h2>
            <div className="text-3xl">🌱</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {carbBalance ? formatFeeAmount(carbBalance.toString()) : '0.00'}
            </div>
            <div className="text-gray-600">CARB</div>
            <div className="text-sm text-gray-500 mt-1">
              碳积分余额
            </div>
          </div>
        </div>

        {/* NFT资产统计 */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">NFT收藏</h2>
            <div className="text-3xl">🎨</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {nftBalance ? Number(nftBalance) : 0}
            </div>
            <div className="text-gray-600">枚</div>
            <div className="text-sm text-gray-500 mt-1">
              绿色NFT收藏
            </div>
          </div>
        </div>
      </div>

      {/* NFT资产列表 */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">我的NFT收藏</h2>
          <div className="flex gap-2">
            <button
              onClick={refreshAssets}
              disabled={loadingNFTs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loadingNFTs ? '刷新中...' : '刷新'}
            </button>
            <button
              onClick={() => {
                console.log('🔧 手动调试NFT获取...');
                console.log('当前状态:', {
                  address,
                  nftBalance: nftBalance?.toString(),
                  nftContractAddress,
                  userNFTs: userNFTs.length,
                  loadingNFTs
                });
                fetchUserNFTs();
              }}
              disabled={loadingNFTs}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
            >
              🔍 调试
            </button>
          </div>
        </div>

        {loadingNFTs ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在加载您的NFT收藏...</p>
          </div>
        ) : userNFTs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎨</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无NFT收藏</h3>
            <p className="text-gray-500 mb-6">您还没有拥有任何绿色NFT</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/create'}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                创建第一个NFT
              </button>
              <button
                onClick={() => window.location.href = '/created'}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                查看创建记录
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* NFT网格展示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userNFTs.map((nft) => (
                <div
                  key={nft.tokenId}
                  className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">
                      #{nft.tokenId} {nft.title}
                    </h3>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                      NFT
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {nft.storyDetails || '暂无详情'}
                  </p>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">碳减排量:</span>
                      <span className="font-medium text-green-600">
                        {formatFeeAmount(nft.carbonReduction)} CARB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">当前价格:</span>
                      <span className="font-medium">
                        {formatFeeAmount(nft.lastPrice !== '0' ? nft.lastPrice : nft.initialPrice)} CARB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">创建时间:</span>
                      <span className="font-medium text-gray-600">
                        {new Date(parseInt(nft.createTime) * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <NFTViewButton
                      nftTokenId={nft.tokenId}
                      buttonText="查看详情"
                      buttonStyle="primary"
                      size="sm"
                    />
                    <button
                      onClick={() => handleListNFT(nft)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🏪 挂单
                    </button>
                    <NFTExchangeButton
                      nft={nft}
                      onExchangeSuccess={() => {
                        refreshAssets();
                        alert('兑换申请提交成功！请等待审计员审核。');
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 底部操作区 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  共 {userNFTs.length} 个NFT，总价值约 {' '}
                  <span className="font-semibold text-green-600">
                    {formatFeeAmount(
                      userNFTs.reduce((total, nft) => 
                        total + BigInt(nft.lastPrice !== '0' ? nft.lastPrice : nft.initialPrice), 
                        BigInt(0)
                      ).toString()
                    )} CARB
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.href = '/create'}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    创建新NFT
                  </button>
                  <button
                    onClick={() => window.location.href = '/exchange'}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  >
                    NFT兑换中心
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 挂单模态框 */}
      {showListModal && selectedNFTForList && (
        <ListNFTModal
          nft={selectedNFTForList}
          isOpen={showListModal}
          onClose={() => setShowListModal(false)}
          onSuccess={handleListSuccess}
        />
      )}
    </div>
  );
}; 