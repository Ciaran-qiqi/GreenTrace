'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useChainId, useAccount } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';

// Auditor statistics interface

export interface AuditorStats {
  totalMintAudits: number;
  totalCashAudits: number;
  approvedMintAudits: number;
  approvedCashAudits: number;
  rejectedMintAudits: number;
  rejectedCashAudits: number;
}

/**
 * Auditor operation Hook
 * @description Obtain auditor list and work statistics, and manage auditor-related data
 */
export const useAuditorOperations = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [auditorList, setAuditorList] = useState<string[]>([]);
  const [auditorStats, setAuditorStats] = useState<Record<string, AuditorStats>>({});
  const [loadingAuditors, setLoadingAuditors] = useState(false);

  // Get the contract address

  const getGreenTraceAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.GreenTrace;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
      case 31337: return CONTRACT_ADDRESSES.foundry.GreenTrace;
      default: return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    }
  };

  const greenTraceAddress = getGreenTraceAddress(chainId);

  // Check whether the current user is an auditor

  const { data: isCurrentUserAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: address ? [address] : undefined,
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // Initialize the auditor list

  const initializeAuditorList = async () => {
    setLoadingAuditors(true);
    
    try {
      // Create a practical auditor list

      const knownAuditors: string[] = [];
      
      // If the current user is an auditor, add to the list

      if (address && isCurrentUserAuditor) {
        knownAuditors.push(address);
      }
      
      // You can add other known auditor addresses here
      // For example: Get from local storage, configuration files, or other sources

      
      // Create simulation statistics

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

  // Add auditor to local list (called when successfully added)

  const addAuditorToList = (auditorAddress: string) => {
    if (!auditorList.includes(auditorAddress)) {
      setAuditorList(prev => [...prev, auditorAddress]);
      
      // Create initial statistics for new auditors

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

  // Remove the auditor from the local list (called when successfully removed)

  const removeAuditorFromList = (auditorAddress: string) => {
    setAuditorList(prev => prev.filter(addr => addr !== auditorAddress));
    setAuditorStats(prev => {
      const newStats = { ...prev };
      delete newStats[auditorAddress];
      return newStats;
    });
  };

  // Refresh auditor data

  const refetchAuditors = async () => {
    await initializeAuditorList();
  };

  // Check whether the specified address is an auditor (actual contract call)

  const checkIsAuditor = async (targetAddress: string): Promise<boolean> => {
    try {
      // Contract checking should be called directly here
      // Temporarily use local list check

      return auditorList.includes(targetAddress);
    } catch (error) {
      console.error('检查审计员状态失败:', error);
      return false;
    }
  };

  // Get the auditor's job history (simplified version)

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

  // Reinitialize when the user address or auditor status changes

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