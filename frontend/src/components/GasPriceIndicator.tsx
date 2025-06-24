'use client';

import { useEffect, useState } from 'react';
import { formatGwei } from 'viem';
import { usePublicClient } from 'wagmi';

// Gas价格指示器组件
export const GasPriceIndicator = () => {
  const publicClient = usePublicClient();
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [gasPriceLevel, setGasPriceLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(true);

  // 获取Gas价格
  const fetchGasPrice = async () => {
    if (!publicClient) return;

    try {
      setIsLoading(true);
      
      // 尝试获取EIP-1559费用数据
      try {
        const feeData = await publicClient.estimateFeesPerGas();
        if (feeData.maxFeePerGas) {
          setGasPrice(feeData.maxFeePerGas);
        } else {
          throw new Error('EIP-1559 not supported');
        }
      } catch {
        // 回退到传统Gas价格
        const price = await publicClient.getGasPrice();
        setGasPrice(price);
      }

      // 根据Gas价格确定等级（以Gwei为单位）
      if (gasPrice) {
        const priceInGwei = Number(formatGwei(gasPrice));
        if (priceInGwei < 5) {
          setGasPriceLevel('low');
        } else if (priceInGwei < 15) {
          setGasPriceLevel('medium');
        } else {
          setGasPriceLevel('high');
        }
      }
    } catch (error) {
      console.error('获取Gas价格失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGasPrice();
    
    // 每30秒更新一次
    const interval = setInterval(fetchGasPrice, 30000);
    return () => clearInterval(interval);
  }, [publicClient]);

  if (isLoading || !gasPrice) {
    return (
      <div className="inline-flex items-center text-sm text-gray-500">
        <div className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-pulse"></div>
        获取Gas价格中...
      </div>
    );
  }

  const getLevelInfo = () => {
    switch (gasPriceLevel) {
      case 'low':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          icon: '🟢',
          text: '低费用'
        };
      case 'medium':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          icon: '🟡',
          text: '中等费用'
        };
      case 'high':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          icon: '🔴',
          text: '高费用'
        };
    }
  };

  const levelInfo = getLevelInfo();

  return (
    <div className={`inline-flex items-center text-sm px-2 py-1 rounded-full ${levelInfo.bgColor} ${levelInfo.color}`}>
      <span className="mr-1">{levelInfo.icon}</span>
      <span className="font-medium mr-1">{levelInfo.text}</span>
      <span className="font-mono text-xs">
        {formatGwei(gasPrice)} Gwei
      </span>
    </div>
  );
}; 