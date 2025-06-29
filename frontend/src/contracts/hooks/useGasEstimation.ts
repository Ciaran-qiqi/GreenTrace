'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChainId, usePublicClient } from 'wagmi';
import { Address, formatGwei, parseGwei } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import GreenTraceABI from '../abi/GreenTrace.json';

// Gas estimation configuration type

interface GasEstimationConfig {
  method: 'requestMintNFT' | 'payAndMintNFT' | 'requestExchangeNFT' | 'exchangeNFT';
  args: unknown[];
  value?: bigint;
}

// Gas estimation result type

interface GasEstimationResult {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCost: bigint;
  gasPriceLevel: 'slow' | 'standard' | 'fast';
  isLoading: boolean;
  error: string | null;
}

// Gas price range

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

// Get the contract address

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

// Get the correct abi

const getGreenTraceABI = () => {
  return (GreenTraceABI.abi || GreenTraceABI) as readonly unknown[];
};

// Main gas estimation hook

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

  // Estimate gas usage

  const estimateGas = useCallback(async () => {
    if (!config || !publicClient) return;

    setIsLoading(true);
    setError(null);

    try {
      // 1. Estimate Gas Limits

      const gasLimitEstimate = await publicClient.estimateContractGas({
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: config.method,
        args: config.args,
      });

      // Add 20% safety margin

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
      
      // Set default gas limits

      const defaultGasLimits = {
        requestMintNFT: BigInt(180000),
        payAndMintNFT: BigInt(200000),
        requestExchangeNFT: BigInt(120000),
        exchangeNFT: BigInt(150000),
      };
      setGasLimit(defaultGasLimits[config.method]);
    }
  }, [config, publicClient, contractAddress]);

  // Get gas price

  const fetchGasPrices = useCallback(async () => {
    if (!publicClient) return;

    try {
      // Get the current gas price

      const gasPrice = await publicClient.getGasPrice();
      
      // Try to get eip 1559 fee data


      try {
        const feeData = await publicClient.estimateFeesPerGas();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          // Use EIP 1559 fee

          const currentMaxFee = feeData.maxFeePerGas;
          const currentPriorityFee = feeData.maxPriorityFeePerGas;
          
          // Calculate gas prices at different speeds

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
        // Reverse to traditional gas prices

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
      
      // Set the default gas price (suitable for test network)

      const defaultGasPrice = parseGwei('10'); // 10 G for

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

  // Calculate estimated costs

  useEffect(() => {
    if (gasLimit > BigInt(0) && gasPrices.standard.maxFeePerGas > BigInt(0)) {
      const currentGasPrice = gasPrices[gasPriceLevel];
      const cost = gasLimit * currentGasPrice.maxFeePerGas;
      setEstimatedCost(cost);
    }
  }, [gasLimit, gasPrices, gasPriceLevel]);

  // Perform estimation

  useEffect(() => {
    if (config) {
      estimateGas();
    }
  }, [estimateGas]);

  // Regularly update gas prices

  useEffect(() => {
    fetchGasPrices();
    
    // Update gas price every 30 seconds

    const interval = setInterval(fetchGasPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchGasPrices]);

  // Complete loading status

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

// Gas price selector hook

export const useGasPriceSelector = () => {
  const publicClient = usePublicClient();
  
  const [gasPrices, setGasPrices] = useState<GasPriceTiers>({
    slow: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    standard: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
    fast: { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) },
  });
  
  const [selectedLevel, setSelectedLevel] = useState<'slow' | 'standard' | 'fast'>('standard');
  const [isLoading, setIsLoading] = useState(true);

  // Get gas price

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
      
      // Set default values

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
    
    // Updated every 30 seconds

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

// Smart gas adjustment hook

export const useSmartGasAdjustment = (baseGasLimit: bigint, txType: string) => {
  const [adjustedGasLimit, setAdjustedGasLimit] = useState(baseGasLimit);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  useEffect(() => {
    let multiplier = BigInt(120); // Default 20% safety margin

    let reason = '标准安全边际(+20%)';

    // Intelligent adjustment according to transaction type

    switch (txType) {
      case 'requestMintNFT':
        multiplier = BigInt(115); // 15% margin, relatively simple operation

        reason = 'NFT申请操作(+15%安全边际)';
        break;
      case 'payAndMintNFT':
        multiplier = BigInt(125); // 25% margin, complex operations include multiple steps

        reason = 'NFT支付铸造操作(+25%安全边际)';
        break;
      case 'requestExchangeNFT':
        multiplier = BigInt(115); // 15% margin

        reason = 'NFT兑换申请(+15%安全边际)';
        break;
      case 'exchangeNFT':
        multiplier = BigInt(130); // 30% margin, including nft destruction and token minting

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