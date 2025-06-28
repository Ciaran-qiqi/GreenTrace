'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useChainId, useAccount } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';

// 审计员统计接口
export interface AuditorStats {
  totalMintAudits: number;
  totalCashAudits: number;
  approvedMintAudits: number;
  approvedCashAudits: number;
  rejectedMintAudits: number;
  rejectedCashAudits: number;
}

/**
 * 审计员操作Hook
 * @description 获取审计员列表和工作统计，管理审计员相关数据
 */
export const useAuditorOperations = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [auditorList, setAuditorList] = useState<string[]>([]);
  const [auditorStats, setAuditorStats] = useState<Record<string, AuditorStats>>({});
  const [loadingAuditors, setLoadingAuditors] = useState(false);

  // 获取合约地址
  const getGreenTraceAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.GreenTrace;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
      case 31337: return CONTRACT_ADDRESSES.foundry.GreenTrace;
      default: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    }
  };

  const greenTraceAddress = getGreenTraceAddress(chainId);

  // 检查当前用户是否为审计员
  const { data: isCurrentUserAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // 初始化审计员列表
  const initializeAuditorList = async () => {
    setLoadingAuditors(true);
    
    try {
      // 创建一个实用的审计员列表
      const knownAuditors: string[] = [];
      
      // 如果当前用户是审计员，添加到列表中
      if (address && isCurrentUserAuditor) {
        knownAuditors.push(address);
      }
      
      // 您可以在这里添加其他已知的审计员地址
      // 例如：从本地存储、配置文件或其他来源获取
      
      // 创建模拟统计数据
      const stats: Record<string, AuditorStats> = {};
      knownAuditors.forEach((auditor, index) => {
        stats[auditor] = {
          totalMintAudits: Math.floor(Math.random() * 10) + 1,
          totalCashAudits: Math.floor(Math.random() * 8) + 1,
          approvedMintAudits: Math.floor(Math.random() * 8) + 1,
          approvedCashAudits: Math.floor(Math.random() * 6) + 1,
          rejectedMintAudits: Math.floor(Math.random() * 3),
          rejectedCashAudits: Math.floor(Math.random() * 2),
        };
      });
      
      setAuditorList(knownAuditors);
      setAuditorStats(stats);
      
    } catch (error) {
      console.error('初始化审计员列表失败:', error);
    } finally {
      setLoadingAuditors(false);
    }
  };

  // 添加审计员到本地列表（当成功添加时调用）
  const addAuditorToList = (auditorAddress: string) => {
    if (!auditorList.includes(auditorAddress)) {
      setAuditorList(prev => [...prev, auditorAddress]);
      
      // 为新审计员创建初始统计数据
      setAuditorStats(prev => ({
        ...prev,
        [auditorAddress]: {
          totalMintAudits: 0,
          totalCashAudits: 0,
          approvedMintAudits: 0,
          approvedCashAudits: 0,
          rejectedMintAudits: 0,
          rejectedCashAudits: 0,
        }
      }));
    }
  };

  // 从本地列表移除审计员（当成功移除时调用）
  const removeAuditorFromList = (auditorAddress: string) => {
    setAuditorList(prev => prev.filter(addr => addr !== auditorAddress));
    setAuditorStats(prev => {
      const newStats = { ...prev };
      delete newStats[auditorAddress];
      return newStats;
    });
  };

  // 刷新审计员数据
  const refetchAuditors = async () => {
    await initializeAuditorList();
  };

  // 检查指定地址是否为审计员（实际的合约调用）
  const checkIsAuditor = async (targetAddress: string): Promise<boolean> => {
    try {
      // 这里应该直接调用合约检查
      // 暂时使用本地列表检查
      return auditorList.includes(targetAddress);
    } catch (error) {
      console.error('检查审计员状态失败:', error);
      return false;
    }
  };

  // 获取审计员工作历史（简化版本）
  const getAuditorHistory = async (auditorAddress: string) => {
    const stats = auditorStats[auditorAddress];
    return {
      mintAudits: [],
      cashAudits: [],
      totalProcessed: stats ? stats.totalMintAudits + stats.totalCashAudits : 0,
      approvalRate: stats ? 
        ((stats.approvedMintAudits + stats.approvedCashAudits) / 
         Math.max(1, stats.totalMintAudits + stats.totalCashAudits)) * 100 : 0,
    };
  };

  // 当用户地址或审计员状态变化时重新初始化
  useEffect(() => {
    if (address) {
      initializeAuditorList();
    }
  }, [address, isCurrentUserAuditor]);

  return {
    auditorList,
    auditorStats,
    loadingAuditors,
    refetchAuditors,
    getAuditorHistory,
    checkIsAuditor,
    addAuditorToList,
    removeAuditorFromList,
    isCurrentUserAuditor: !!isCurrentUserAuditor,
  };
}; 