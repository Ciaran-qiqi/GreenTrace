'use client';

import { useEffect } from 'react';
import { formatEther, formatGwei } from 'viem';
import { useGasPriceSelector, useGasEstimation } from '../contracts/hooks/useGasEstimation';

// Gas fee selector component properties

interface GasFeeSelectorProps {
  // Gas estimation configuration

  method: 'requestMintNFT' | 'payAndMintNFT' | 'requestExchangeNFT' | 'exchangeNFT';
  args: unknown[];
  value?: bigint;
  // Callback function

  onGasConfigChange: (config: {
    gasLimit: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    estimatedCost: bigint;
  }) => void;
  // Whether to display detailed information

  showDetails?: boolean;
  // Custom style class name

  className?: string;
}

// Gas level description information

const GAS_LEVEL_INFO = {
  slow: {
    name: '经济模式',
    description: '较低费用，约2-5分钟确认',
    color: 'text-green-600 bg-green-50 border-green-200',
    icon: '🐌',
  },
  standard: {
    name: '标准模式',
    description: '平衡费用，约1-2分钟确认',
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    icon: '⚡',
  },
  fast: {
    name: '快速模式',
    description: '较高费用，约30秒-1分钟确认',
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    icon: '🚀',
  },
};

export default function GasFeeSelector({
  method,
  args,
  value,
  onGasConfigChange,
  showDetails = true,
  className = '',
}: GasFeeSelectorProps) {
  // Gas price selector hook

  const {
    gasPrices,
    selectedLevel,
    setSelectedLevel,
    isLoading: pricesLoading,
    currentGasPrice,
  } = useGasPriceSelector();

  // Gas estimation hook

  const {
    gasLimit,
    estimatedCost,
    isLoading: estimationLoading,
    error,
  } = useGasEstimation({
    method,
    args,
    value,
  });

  // Notify the parent component when the gas configuration changes

  useEffect(() => {
    if (gasLimit > BigInt(0) && currentGasPrice.maxFeePerGas > BigInt(0)) {
      onGasConfigChange({
        gasLimit,
        maxFeePerGas: currentGasPrice.maxFeePerGas,
        maxPriorityFeePerGas: currentGasPrice.maxPriorityFeePerGas,
        estimatedCost,
      });
    }
  }, [gasLimit, currentGasPrice, estimatedCost, onGasConfigChange]);

  // Calculate cost savings

  const calculateSavings = (level: 'slow' | 'standard' | 'fast') => {
    if (gasLimit === BigInt(0)) return null;
    
    const levelCost = gasLimit * gasPrices[level].maxFeePerGas;
    const fastCost = gasLimit * gasPrices.fast.maxFeePerGas;
    const savings = fastCost - levelCost;
    
    return {
      cost: levelCost,
      savings: savings > BigInt(0) ? savings : BigInt(0),
      percentage: savings > BigInt(0) ? 
        Number((savings * BigInt(100)) / fastCost) : 0,
    };
  };

  // Loading status

  if (pricesLoading || estimationLoading) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">正在估算Gas费用...</span>
        </div>
      </div>
    );
  }

  // Error status

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-red-600">
          <span>⚠️</span>
          <span className="text-sm">Gas估算失败: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border p-4 space-y-4 ${className}`}>
      {/* title */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Gas费用选择</h3>
        <div className="text-sm text-gray-500">
          预估Gas: {gasLimit.toLocaleString()}
        </div>
      </div>

      {/* Gas level selection */}
      <div className="space-y-2">
        {(Object.keys(GAS_LEVEL_INFO) as Array<keyof typeof GAS_LEVEL_INFO>).map((level) => {
          const info = GAS_LEVEL_INFO[level];
          const savings = calculateSavings(level);
          const isSelected = selectedLevel === level;

          return (
            <div
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`
                p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isSelected 
                  ? info.color 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{info.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      {info.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {info.description}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {savings ? formatEther(savings.cost) : '0'} ETH
                  </div>
                  {showDetails && (
                    <div className="text-sm text-gray-600">
                      {formatGwei(gasPrices[level].maxFeePerGas)} Gwei
                    </div>
                  )}
                  {level !== 'fast' && savings && savings.savings > BigInt(0) && (
                    <div className="text-sm text-green-600">
                      节省 {savings.percentage.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details */}
      {showDetails && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <h4 className="font-medium text-gray-900">详细信息</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Gas限制:</span>
              <span className="ml-2 font-mono">{gasLimit.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">最大费用:</span>
              <span className="ml-2 font-mono">
                {formatGwei(currentGasPrice.maxFeePerGas)} Gwei
              </span>
            </div>
            <div>
              <span className="text-gray-600">优先费用:</span>
              <span className="ml-2 font-mono">
                {formatGwei(currentGasPrice.maxPriorityFeePerGas)} Gwei
              </span>
            </div>
            <div>
              <span className="text-gray-600">预估总费用:</span>
              <span className="ml-2 font-mono font-semibold">
                {formatEther(estimatedCost)} ETH
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Kind tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <span className="text-blue-600 text-sm">💡</span>
          <div className="text-sm text-blue-700">
            <p className="font-medium">智能Gas优化提示:</p>
            <p className="text-xs mt-1">
              系统会根据交易类型自动调整Gas限制，确保交易成功的同时最小化费用。
              选择不同的速度等级来平衡费用和确认时间。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 