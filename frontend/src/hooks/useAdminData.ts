'use client';

import { useReadContract, useAccount, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';

// 系统统计数据接口
export interface SystemStats {
  totalMintRequests: number;
  totalCashRequests: number;
  pendingMintRequests: number;
  pendingCashRequests: number;
  approvedMintRequests: number;
  approvedCashRequests: number;
}

// 审计记录接口
export interface AuditRecord {
  requester: string;
  auditor: string;
  requestId: string;
  nftTokenId: string;
  carbonValue: string;
  status: number; // 0: Pending, 1: Approved, 2: Rejected
  auditType: number; // 0: Mint, 1: Exchange
  requestTimestamp: string;
  auditTimestamp: string;
  auditComment: string;
  requestData: {
    title: string;
    storyDetails: string;
    carbonReduction: string;
    tokenURI: string;
    requestFee: string;
  };
}

/**
 * 管理中心数据Hook
 * @description 获取管理中心所需的所有数据，包括系统统计、审计记录等
 */
export const useAdminData = () => {
  const { address } = useAccount();
  const chainId = useChainId();

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

  // 获取系统统计信息
  const { 
    data: systemStats, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats
  } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'getSystemStats',
    query: {
      enabled: !!greenTraceAddress,
      refetchInterval: 30000, // 每30秒刷新
    }
  });

  // 获取待审核的铸造申请
  const { 
    data: pendingMintAudits, 
    isLoading: pendingMintLoading,
    refetch: refetchPendingMint
  } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'getPendingMintAudits',
    query: {
      enabled: !!greenTraceAddress,
      refetchInterval: 10000, // 每10秒刷新
    }
  });

  // 获取待审核的兑换申请
  const { 
    data: pendingCashAudits, 
    isLoading: pendingCashLoading,
    refetch: refetchPendingCash
  } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'getPendingCashAudits',
    query: {
      enabled: !!greenTraceAddress,
      refetchInterval: 10000, // 每10秒刷新
    }
  });

  // 获取所有已审计的铸造申请
  const { 
    data: allAuditedMintRequests,
    isLoading: auditedMintLoading,
    refetch: refetchAuditedMint
  } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'getAllAuditedMintRequests',
    query: {
      enabled: !!greenTraceAddress,
    }
  });

  // 获取所有已审计的兑换申请
  const { 
    data: allAuditedCashRequests,
    isLoading: auditedCashLoading,
    refetch: refetchAuditedCash
  } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'getAllAuditedCashRequests',
    query: {
      enabled: !!greenTraceAddress,
    }
  });

  // 检查当前用户是否为审计员
  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: [address],
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // 检查当前用户是否为合约所有者
  const { data: contractOwner } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'owner',
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // 判断用户权限
  const isOwner = Boolean(address && contractOwner && 
    address.toLowerCase() === (contractOwner as string).toLowerCase());

  // 处理系统统计数据
  const processedStats: SystemStats | null = systemStats ? {
    totalMintRequests: Number((systemStats as any)[0]),
    totalCashRequests: Number((systemStats as any)[1]),
    pendingMintRequests: Number((systemStats as any)[2]),
    pendingCashRequests: Number((systemStats as any)[3]),
    approvedMintRequests: Number((systemStats as any)[4]),
    approvedCashRequests: Number((systemStats as any)[5]),
  } : null;

  // 刷新所有数据
  const refetchAll = () => {
    refetchStats();
    refetchPendingMint();
    refetchPendingCash();
    refetchAuditedMint();
    refetchAuditedCash();
  };

  return {
    // 系统统计
    systemStats: processedStats,
    statsLoading,
    statsError,

    // 待审核申请
    pendingMintAudits: (pendingMintAudits as bigint[]) || [],
    pendingCashAudits: (pendingCashAudits as bigint[]) || [],
    pendingMintLoading,
    pendingCashLoading,

    // 已审计申请
    allAuditedMintRequests: (allAuditedMintRequests as bigint[]) || [],
    allAuditedCashRequests: (allAuditedCashRequests as bigint[]) || [],
    auditedMintLoading,
    auditedCashLoading,

    // 用户权限
    isAuditor: !!isAuditor,
    isOwner,

    // 刷新方法
    refetchAll,
    refetchStats,
    refetchPendingMint,
    refetchPendingCash,
  };
}; 