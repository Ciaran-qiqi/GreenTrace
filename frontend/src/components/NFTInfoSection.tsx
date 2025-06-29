'use client';

import React, { useState, useEffect } from 'react';
import { formatTokenAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';

// Nft information display component

export const NFTInfoSection: React.FC<{ 
  nftTokenId: string; 
  auditedValue?: string; 
  tokenURI?: string;
  className?: string;
  theme?: 'blue' | 'purple';
  nftExists?: boolean; // Optional: Pre-check results of whether nft exists

}> = ({ nftTokenId, tokenURI, className = '', theme = 'purple', nftExists }) => {
  const [nftInfo, setNftInfo] = useState<{
    storyTitle: string;
    storyDetail: string;
    carbonReduction: string;
    createTime: string;
    initialPrice: string;
    lastPrice: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the theme style class name

  const getThemeClasses = () => {
    if (theme === 'blue') {
      return {
        background: 'bg-gradient-to-br from-blue-50 to-blue-50',
        border: 'border-blue-200/30',
        title: 'text-blue-800',
        label: 'text-blue-700',
        tokenId: 'text-blue-600',
        spinner: 'border-blue-600',
        loading: 'text-blue-600',
        inputBorder: 'border-blue-100',
        congratsBg: 'bg-gradient-to-r from-blue-100 to-blue-100',
        congratsBorder: 'border-blue-200/50',
        congratsTitle: 'text-blue-700',
        congratsText: 'text-blue-600'
      };
    } else {
      return {
        background: 'bg-gradient-to-br from-purple-50 to-pink-50',
        border: 'border-purple-200/30',
        title: 'text-purple-800',
        label: 'text-purple-700',
        tokenId: 'text-purple-600',
        spinner: 'border-purple-600',
        loading: 'text-purple-600',
        inputBorder: 'border-purple-100',
        congratsBg: 'bg-gradient-to-r from-purple-100 to-pink-100',
        congratsBorder: 'border-purple-200/50',
        congratsTitle: 'text-purple-700',
        congratsText: 'text-purple-600'
      };
    }
  };

  const themeClasses = getThemeClasses();

  useEffect(() => {
    const fetchNFTInfo = async () => {
      try {
        setLoading(true);
        setError(null);

        // If the pre-check shows that nft does not exist, set the error status directly

        if (nftExists === false) {
          setError('NFT_NOT_EXISTS');
          return;
        }

        const { readContract } = await import('wagmi/actions');
        const { config } = await import('@/lib/wagmi');
        const { CONTRACT_ADDRESSES } = await import('@/contracts/addresses');

        // Get the nft contract address

        const nftAddress = CONTRACT_ADDRESSES.sepolia.NFT as `0x${string}`;

        // get story meta function in Nft contract abi

        const nftABI = [
          {
            name: 'getStoryMeta',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [
              {
                type: 'tuple',
                components: [
                  { name: 'storyTitle', type: 'string' },
                  { name: 'storyDetail', type: 'string' },
                  { name: 'carbonReduction', type: 'uint256' },
                  { name: 'createTime', type: 'uint256' },
                  { name: 'initialPrice', type: 'uint256' },
                  { name: 'lastPrice', type: 'uint256' }
                ]
              }
            ]
          }
        ];

        const storyMeta = await readContract(config, {
          address: nftAddress,
          abi: nftABI,
          functionName: 'getStoryMeta',
          args: [BigInt(nftTokenId)]
        });

        const meta = storyMeta as any;
        setNftInfo({
          storyTitle: meta.storyTitle || '未知标题',
          storyDetail: meta.storyDetail || '无详情',
          carbonReduction: formatTokenAmount(meta.carbonReduction),
          createTime: formatTimestamp((Number(meta.createTime) * 1000).toString()),
          initialPrice: formatTokenAmount(meta.initialPrice),
          lastPrice: formatTokenAmount(meta.lastPrice)
        });

        console.log('🎨 NFT完整信息 (NFTInfoSection):', {
          tokenId: nftTokenId,
          storyMeta: meta,
          formatted: {
            storyTitle: meta.storyTitle,
            storyDetail: meta.storyDetail,
            carbonReduction: formatTokenAmount(meta.carbonReduction),
            createTime: formatTimestamp((Number(meta.createTime) * 1000).toString()),
            initialPrice: formatTokenAmount(meta.initialPrice),
            lastPrice: formatTokenAmount(meta.lastPrice)
          }
        });

      } catch (err) {
        console.error('获取NFT信息失败:', err);
        const errorMsg = err instanceof Error ? err.message : '获取NFT信息失败';
        
        // Special handling of the situation where nft does not exist

        if (errorMsg.includes('Token does not exist') || errorMsg.includes('reverted')) {
          setError('NFT_NOT_EXISTS');
        } else {
          setError(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    if (nftTokenId) {
      fetchNFTInfo();
    }
  }, [nftTokenId, nftExists]);

  if (loading) {
    return (
      <div className={`${themeClasses.background} rounded-xl p-6 ${themeClasses.border} shadow-sm ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-lg">🎨</span>
          <h3 className={`text-xl font-bold ${themeClasses.title}`}>NFT信息</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 ${themeClasses.spinner} border-t-transparent"></div>
          <span className={`ml-3 ${themeClasses.loading}`}>正在加载NFT信息...</span>
        </div>
      </div>
    );
  }

  if (error) {
    // If nft does not exist, it will be redeemed and destroyed.

    if (error === 'NFT_NOT_EXISTS') {
      return (
        <div className={`bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200/30 shadow-sm ${className}`}>
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-lg">🔥</span>
            <h3 className="text-xl font-bold text-orange-800">NFT已兑换销毁</h3>
          </div>
          
          <div className="space-y-4">
            {/* Status Indications */}
            <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-lg p-4 border border-orange-200/50">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">💰</span>
                </div>
                <div>
                  <div className="font-bold text-orange-800">兑换完成</div>
                  <div className="text-orange-600 text-sm">此NFT已被成功兑换为CARB代币</div>
                </div>
              </div>
              
              <div className="text-sm text-orange-700 space-y-1">
                <div className="flex items-center space-x-2">
                  <span>🎨</span>
                  <span>原NFT Token ID: #{nftTokenId}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>🔥</span>
                  <span>状态: 已永久销毁</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>💸</span>
                  <span>CARB代币已发放到用户钱包</span>
                </div>
              </div>
            </div>

            {/* Description Information */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-700">
                <div className="font-medium mb-2">ℹ️ 关于NFT兑换销毁</div>
                <ul className="space-y-1 text-xs ml-4">
                  <li>• NFT兑换后会被永久销毁，无法恢复</li>
                  <li>• 用户已获得相应的CARB代币作为兑换回报</li>
                  <li>• 这是区块链上的不可逆操作</li>
                  <li>• 销毁确保了碳信用的唯一性和可追溯性</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Other error situations

    return (
      <div className={`${themeClasses.background} rounded-xl p-6 ${themeClasses.border} shadow-sm ${className}`}>
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-lg">🎨</span>
          <h3 className={`text-xl font-bold ${themeClasses.title}`}>NFT信息</h3>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className={`${themeClasses.congratsText} text-sm`}>⚠️ {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${themeClasses.background} rounded-xl p-6 ${themeClasses.border} shadow-sm ${className}`}>
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-lg">🎨</span>
        <h3 className={`text-xl font-bold ${themeClasses.title}`}>NFT详细信息</h3>
      </div>
      
      <div className="space-y-6">
        {/* Basic information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className={`${themeClasses.label} font-medium text-sm`}>NFT Token ID</span>
            <div className={`${themeClasses.tokenId} font-bold text-2xl`}>#{nftTokenId}</div>
          </div>
          <div className="space-y-1">
            <span className={`${themeClasses.label} font-medium text-sm`}>铸造状态</span>
            <div className="flex items-center space-x-2">
              <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full border border-green-200">
                ✅ 已成功铸造
              </span>
            </div>
          </div>
        </div>

        {/* Nft Story Information */}
        {nftInfo && (
          <>
            <div className="space-y-1">
              <span className={`${themeClasses.label} font-medium text-sm`}>NFT标题</span>
              <div className="text-gray-800 font-bold text-lg">{nftInfo.storyTitle}</div>
            </div>
            
            <div className="space-y-1">
              <span className={`${themeClasses.label} font-medium text-sm`}>故事详情</span>
              <div className="bg-white/80 p-4 rounded-xl border border-${themeClasses.inputBorder} text-gray-700 leading-relaxed max-h-32 overflow-y-auto">
                {nftInfo.storyDetail}
              </div>
            </div>

            {/* Value information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className={`${themeClasses.label} font-medium text-sm`}>碳减排量</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-emerald-600">{nftInfo.carbonReduction}</span>
                  <span className="text-emerald-700 font-semibold text-sm">tCO₂e</span>
                  <span className="text-emerald-500">🌿</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className={`${themeClasses.label} font-medium text-sm`}>初次成交价格</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-blue-600">{nftInfo.initialPrice}</span>
                  <span className="text-blue-700 font-semibold text-sm">CARB</span>
                  <span className="text-blue-500">💰</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className={`${themeClasses.label} font-medium text-sm`}>当前价格</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-green-600">{nftInfo.lastPrice}</span>
                  <span className="text-green-700 font-semibold text-sm">CARB</span>
                  <span className="text-green-500">📈</span>
                </div>
              </div>
            </div>

            {/* Time information */}
            <div className="space-y-1">
              <span className={`${themeClasses.label} font-medium text-sm`}>铸造时间</span>
              <div className="text-gray-800 font-semibold">{nftInfo.createTime}</div>
            </div>
          </>
        )}

        {/* Metadata uri */}
        {tokenURI && (
          <div className="space-y-1">
            <span className={`${themeClasses.label} font-medium text-sm`}>元数据URI</span>
            <div className="font-mono text-sm bg-white/70 px-3 py-2 rounded-lg border border-${themeClasses.inputBorder} text-gray-800 break-all">
              {tokenURI}
            </div>
          </div>
        )}

        {/* External link button */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href={`https://sepolia.etherscan.io/token/0x3456a42043955B1626F6353936c0FEfCd1cB5f1c?a=${nftTokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <span className="text-lg">🔍</span>
            <span>在 Etherscan 上查看</span>
            <span className="text-sm opacity-80">↗</span>
          </a>
          
          <a
            href={`https://testnets.opensea.io/assets/sepolia/0x3456a42043955B1626F6353936c0FEfCd1cB5f1c/${nftTokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <span className="text-lg">🌊</span>
            <span>在 OpenSea 上查看</span>
            <span className="text-sm opacity-80">↗</span>
          </a>
        </div>

        {/* Congratulations message */}
        <div className={`${themeClasses.congratsBg} rounded-lg p-4 border ${themeClasses.congratsBorder}`}>
          <div className={`flex items-center space-x-2 ${themeClasses.congratsTitle} mb-2`}>
            <span className="text-lg">🌟</span>
            <span className="font-semibold">恭喜！您的环保行为已永久记录在区块链上</span>
          </div>
          <p className={`${themeClasses.congratsText} text-sm`}>
            这个NFT代表了您为地球环保事业做出的真实贡献，具有独特的收藏价值和环保意义。
            {nftInfo && (
              <>
                <br />
                <strong>初次成交价格</strong>为 <strong>{nftInfo.initialPrice} CARB</strong>，
                <strong>当前价值</strong>为 <strong>{nftInfo.lastPrice} CARB</strong>。
              </>
            )}
          </p>
          <div className="mt-3 flex items-center justify-center space-x-4 text-sm text-${themeClasses.congratsText}">
            <span>🔗 在区块链浏览器中查看详细信息</span>
            <span>🌊 在NFT市场中查看交易历史</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 