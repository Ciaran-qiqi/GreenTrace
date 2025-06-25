'use client';

import React from 'react';
import { useReadContract, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';

/**
 * 系统设置组件
 * @description 显示系统配置信息、费率设置、合约状态等
 */
export const SystemSettings: React.FC = () => {
  const chainId = useChainId();

  // 获取合约地址
  const getContractAddresses = (chainId: number) => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet;
      case 11155111: return CONTRACT_ADDRESSES.sepolia;
      case 31337: return CONTRACT_ADDRESSES.foundry;
      default: return CONTRACT_ADDRESSES.sepolia;
    }
  };

  const contracts = getContractAddresses(chainId);

  // 网络信息
  const getNetworkInfo = (chainId: number) => {
    switch (chainId) {
      case 1: return { name: 'Ethereum Mainnet', color: 'bg-blue-100 text-blue-800' };
      case 11155111: return { name: 'Sepolia Testnet', color: 'bg-yellow-100 text-yellow-800' };
      case 31337: return { name: 'Foundry Local', color: 'bg-green-100 text-green-800' };
      default: return { name: 'Unknown Network', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const networkInfo = getNetworkInfo(chainId);

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">系统设置</h2>
        <p className="text-gray-600">查看系统配置信息、费率设置和合约状态</p>
      </div>

      {/* 网络和环境信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">🌐</span>
            网络信息
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">网络:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${networkInfo.color}`}>
                {networkInfo.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">链ID:</span>
              <span className="font-semibold">{chainId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">环境:</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                生产环境
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            系统状态
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">初始化:</span>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✅ 已初始化
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">铸造申请ID:</span>
              <span className="font-semibold">#1</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">兑换申请ID:</span>
              <span className="font-semibold">#1</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-xl">💰</span>
            费率设置
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">系统手续费:</span>
              <span className="font-semibold text-blue-600">1%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">审计费用:</span>
              <span className="font-semibold text-green-600">4%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">总费率:</span>
              <span className="font-semibold text-purple-600">5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 合约地址信息 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <span className="text-xl">📋</span>
          合约地址信息
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="font-medium text-gray-800">GreenTrace 主合约</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.GreenTrace}
            </div>
            <div className="text-xs text-gray-500">
              主要业务逻辑合约
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-800">CarbonToken 代币合约</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.CarbonToken}
            </div>
            <div className="text-xs text-gray-500">
              碳币代币合约
            </div>
          </div>
          <div className="space-y-3">
            <div className="font-medium text-gray-800">GreenTalesNFT 合约</div>
            <div className="font-mono text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {contracts.GreenTalesNFT}
            </div>
            <div className="text-xs text-gray-500">
              环保故事NFT合约
            </div>
          </div>
        </div>
      </div>

      {/* 代币和NFT信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">🪙</span>
            碳币代币信息
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">代币名称:</span>
              <span className="font-semibold">Carbon Token</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">代币符号:</span>
              <span className="font-semibold">CARB</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">小数位数:</span>
              <span className="font-semibold">18</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">总供应量:</span>
              <span className="font-semibold text-green-600">1,000,000 CARB</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <span className="text-xl">🎨</span>
            NFT合约信息
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">NFT名称:</span>
              <span className="font-semibold">GreenTales NFT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">NFT符号:</span>
              <span className="font-semibold">GTNFT</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">合约标准:</span>
              <span className="font-semibold">ERC-721</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">功能特性:</span>
              <div className="text-right">
                <div className="text-xs text-gray-500">可铸造、可销毁</div>
                <div className="text-xs text-gray-500">故事元数据</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 费用计算说明 */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <span className="text-xl">🧮</span>
          费用计算说明
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-800 mb-3">铸造申请费用</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div>• 申请手续费: max(碳减排量 × 1%, 1 CARB)</div>
              <div>• 系统手续费: 碳价值 × 1%</div>
              <div>• 审计费用: 碳价值 × 4%</div>
              <div className="text-orange-600 font-medium">
                总费用 = 申请费 + 系统费 + 审计费
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-3">兑换申请费用</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div>• 申请手续费: max(NFT价格 × 1%, 1 CARB)</div>
              <div>• 系统手续费: 碳价值 × 1%</div>
              <div>• 审计费用: 碳价值 × 4%</div>
              <div className="text-green-600 font-medium">
                实际获得 = 碳价值 - 系统费 - 审计费
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 系统限制和规则 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <span className="text-xl">📜</span>
          系统限制和规则
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm text-gray-700">
          <div>
            <h4 className="font-medium text-gray-800 mb-3">业务规则</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>每个申请都需要经过审计流程</li>
              <li>只有审计通过才能进入下一步</li>
              <li>审计拒绝时必须提供原因</li>
              <li>费用在各阶段收取，不可退还</li>
              <li>NFT兑换后将被永久销毁</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-800 mb-3">权限控制</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>只有合约所有者可以管理审计员</li>
              <li>只有审计员可以处理申请</li>
              <li>业务合约需要授权才能调用</li>
              <li>测试环境有特殊权限规则</li>
              <li>所有操作都有事件记录</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 