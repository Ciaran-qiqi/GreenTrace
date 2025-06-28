'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import { Address, formatGwei, parseGwei } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import GreenTraceABI from '../abi/GreenTrace.json';

// Gas估算配置类型
interface GasEstimationConfig {
  method: 'requestMintNFT' | 'payAndMintNFT' | 'requestExchangeNFT' | 'exchangeNFT';
  args: unknown[];
  value?: bigint;
}

// Gas估算结果类型
interface GasEstimationResult {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCost: bigint;
  gasPriceLevel: 'slow' | 'standard' | 'fast';
  isLoading: boolean;
  error: string | null;
}

// Gas价格档位
interface GasPriceTiers {
  slow: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
  standard: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
  fast: {
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  };
}

// 获取合约地址
const getContractAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1:
      return CONTRACT_ADDRESSES.mainnet.GreenTrace as Address;
    case 11155111:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
    case 31337:
      return CONTRACT_ADDRESSES.foundry.GreenTrace as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
  }
};

// 获取正确的ABI
const getGreenTraceABI = () => {
  return (GreenTraceABI.abi || GreenTraceABI) as readonly unknown[];
};

// 主要的Gas估算钩子
export const useGasEstimation = (config?: GasEstimationConfig): GasEstimationResult => {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const contractAddress = getContractAddress(chainId);

  const [gasLimit, setGasLimit] = useState<bigint>(BigInt(0));
  const [gasPrices, setGasPrices] = useState<GasPriceTiers>({
    slow: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    standard: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    fast: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
  });
  const [gasPriceLevel] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [estimatedCost, setEstimatedCost] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 估算Gas使用量
  const estimateGas = useCallback(async () => {
    if (!config || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. 估算Gas限制
      const gasLimitEstimate = await publicClient.estimateContractGas({
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: config.method,
        args: config.args,
      });

      // 添加20%的安全边际
      const safeGasLimit = (gasLimitEstimate * BigInt(120)) / BigInt(100);
      setGasLimit(safeGasLimit);

      console.log(`Gas估算 [${config.method}]:`, {
        estimated: gasLimitEstimate.toString(),
        safeLimit: safeGasLimit.toString(),
        args: config.args,
      });

    } catch (err: any) {
      console.error('Gas估算失败:', err);
      setError(`Gas估算失败: ${err.message}`);
      
      // 设置默认Gas限制
      const defaultGasLimits = {
        requestMintNFT: BigInt(180000),
        payAndMintNFT: BigInt(200000),
        requestExchangeNFT: BigInt(120000),
        exchangeNFT: BigInt(150000),
      };
      setGasLimit(defaultGasLimits[config.method]);
    }
  }, [config, publicClient, contractAddress]);

  // 获取Gas价格
  const fetchGasPrices = useCallback(async () => {
    if (!publicClient) return;

    try {
      // 获取当前Gas价格
      const gasPrice = await publicClient.getGasPrice();
      
      // 尝试获取EIP-1559费用数据

      try {
        const feeData = await publicClient.estimateFeesPerGas();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // 使用EIP-1559费用
          const currentMaxFee = feeData.maxFeePerGas;
          const currentPriorityFee = feeData.maxPriorityFeePerGas;
          
          // 计算不同速度的Gas价格
          setGasPrices({
            slow: {
              maxFeePerGas: (currentMaxFee * BigInt(80)) / BigInt(100), // 80%
              maxPriorityFeePerGas: (currentPriorityFee * BigInt(80)) / BigInt(100),
            },
            standard: {
              maxFeePerGas: currentMaxFee,
              maxPriorityFeePerGas: currentPriorityFee,
            },
            fast: {
              maxFeePerGas: (currentMaxFee * BigInt(130)) / BigInt(100), // 130%
              maxPriorityFeePerGas: (currentPriorityFee * BigInt(150)) / BigInt(100),
            },
          });
        } else {
          throw new Error('EIP-1559 not supported');
        }
      } catch {
        // 回退到传统Gas价格
        setGasPrices({
          slow: {
            maxFeePerGas: (gasPrice * BigInt(80)) / BigInt(100),
            maxPriorityFeePerGas: parseGwei('1'),
          },
          standard: {
            maxFeePerGas: gasPrice,
            maxPriorityFeePerGas: parseGwei('2'),
          },
          fast: {
            maxFeePerGas: (gasPrice * BigInt(130)) / BigInt(100),
            maxPriorityFeePerGas: parseGwei('3'),
          },
        });
      }

      console.log('Gas价格更新:', {
        slow: formatGwei(gasPrices.slow.maxFeePerGas),
        standard: formatGwei(gasPrices.standard.maxFeePerGas),
        fast: formatGwei(gasPrices.fast.maxFeePerGas),
      });

    } catch (err: any) {
      console.error('获取Gas价格失败:', err);
      setError(`获取Gas价格失败: ${err.message}`);
      
      // 设置默认Gas价格（适合测试网）
      const defaultGasPrice = parseGwei('10'); // 10 Gwei
      setGasPrices({
        slow: {
          maxFeePerGas: parseGwei('8'),
          maxPriorityFeePerGas: parseGwei('1'),
        },
        standard: {
          maxFeePerGas: defaultGasPrice,
          maxPriorityFeePerGas: parseGwei('2'),
        },
        fast: {
          maxFeePerGas: parseGwei('15'),
          maxPriorityFeePerGas: parseGwei('3'),
        },
      });
    }
  }, [publicClient]);

  // 计算预估费用
  useEffect(() => {
    if (gasLimit > BigInt(0) && gasPrices.standard.maxFeePerGas > BigInt(0)) {
      const currentGasPrice = gasPrices[gasPriceLevel];
      const cost = gasLimit * currentGasPrice.maxFeePerGas;
      setEstimatedCost(cost);
    }
  }, [gasLimit, gasPrices, gasPriceLevel]);

  // 执行估算
  useEffect(() => {
    if (config) {
      estimateGas();
    }
  }, [estimateGas]);

  // 定期更新Gas价格
  useEffect(() => {
    fetchGasPrices();
    
    // 每30秒更新一次Gas价格
    const interval = setInterval(fetchGasPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchGasPrices]);

  // 完成加载状态
  useEffect(() => {
    if (gasLimit > BigInt(0) && gasPrices.standard.maxFeePerGas > BigInt(0)) {
      setIsLoading(false);
    }
  }, [gasLimit, gasPrices]);

  return {
    gasLimit,
    maxFeePerGas: gasPrices[gasPriceLevel].maxFeePerGas,
    maxPriorityFeePerGas: gasPrices[gasPriceLevel].maxPriorityFeePerGas,
    estimatedCost,
    gasPriceLevel,
    isLoading,
    error,
  };
};

// Gas价格选择器钩子
export const useGasPriceSelector = () => {
  const publicClient = usePublicClient();
  
  const [gasPrices, setGasPrices] = useState<GasPriceTiers>({
    slow: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    standard: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    fast: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
  });
  
  const [selectedLevel, setSelectedLevel] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [isLoading, setIsLoading] = useState(true);

  // 获取Gas价格
  const fetchGasPrices = useCallback(async () => {
    if (!publicClient) return;

    setIsLoading(true);
    
    try {
      const feeData = await publicClient.estimateFeesPerGas();
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        const currentMaxFee = feeData.maxFeePerGas;
        const currentPriorityFee = feeData.maxPriorityFeePerGas;
        
        setGasPrices({
          slow: {
            maxFeePerGas: (currentMaxFee * BigInt(80)) / BigInt(100),
            maxPriorityFeePerGas: (currentPriorityFee * BigInt(80)) / BigInt(100),
          },
          standard: {
            maxFeePerGas: currentMaxFee,
            maxPriorityFeePerGas: currentPriorityFee,
          },
          fast: {
            maxFeePerGas: (currentMaxFee * BigInt(130)) / BigInt(100),
            maxPriorityFeePerGas: (currentPriorityFee * BigInt(150)) / BigInt(100),
          },
        });
      }
    } catch (error) {
      console.error('获取Gas价格失败:', error);
      
      // 设置默认值
      const defaultGasPrice = parseGwei('10');
      setGasPrices({
        slow: {
          maxFeePerGas: parseGwei('8'),
          maxPriorityFeePerGas: parseGwei('1'),
        },
        standard: {
          maxFeePerGas: defaultGasPrice,
          maxPriorityFeePerGas: parseGwei('2'),
        },
        fast: {
          maxFeePerGas: parseGwei('15'),
          maxPriorityFeePerGas: parseGwei('3'),
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    fetchGasPrices();
    
    // 每30秒更新一次
    const interval = setInterval(fetchGasPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchGasPrices]);

  return {
    gasPrices,
    selectedLevel,
    setSelectedLevel,
    isLoading,
    currentGasPrice: gasPrices[selectedLevel],
  };
};

// 智能Gas调整钩子
export const useSmartGasAdjustment = (baseGasLimit: bigint, txType: string) => {
  const [adjustedGasLimit, setAdjustedGasLimit] = useState(baseGasLimit);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  useEffect(() => {
    let multiplier = BigInt(120); // 默认20%安全边际
    let reason = '标准安全边际(+20%)';

    // 根据交易类型智能调整
    switch (txType) {
      case 'requestMintNFT':
        multiplier = BigInt(115); // 15%边际，相对简单的操作
        reason = 'NFT申请操作(+15%安全边际)';
        break;
      case 'payAndMintNFT':
        multiplier = BigInt(125); // 25%边际，复杂操作包含多个步骤
        reason = 'NFT支付铸造操作(+25%安全边际)';
        break;
      case 'requestExchangeNFT':
        multiplier = BigInt(115); // 15%边际
        reason = 'NFT兑换申请(+15%安全边际)';
        break;
      case 'exchangeNFT':
        multiplier = BigInt(130); // 30%边际，包含NFT销毁和代币铸造
        reason = 'NFT兑换执行(+30%安全边际)';
        break;
      default:
        break;
    }

    const adjusted = (baseGasLimit * multiplier) / BigInt(100);
    setAdjustedGasLimit(adjusted);
    setAdjustmentReason(reason);

    console.log(`智能Gas调整 [${txType}]:`, {
      base: baseGasLimit.toString(),
      adjusted: adjusted.toString(),
      multiplier: multiplier.toString(),
      reason,
    });

  }, [baseGasLimit, txType]);

  return {
    adjustedGasLimit,
    adjustmentReason,
  };
}; 