'use client';

import { useReadContract, useAccount, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTraceABI from '@/contracts/abi/GreenTrace.json';

// System statistics interface

export interface SystemStats {
  totalMintRequests: number;
  totalCashRequests: number;
  pendingMintRequests: number;
  pendingCashRequests: number;
  approvedMintRequests: number;
  approvedCashRequests: number;
}

// Audit record interface

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
 * Management Center Data Hook
 * @description Obtain all data required by the management center, including system statistics, audit records, etc.
 */
export const useAdminData = () => {
  const { address } = useAccount();
  const chainId = useChainId();

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

  // Obtain system statistics information

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
      refetchInterval: 30000, // Refresh every 30 seconds

    }
  });

  // Obtain a casting application to be reviewed

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
      refetchInterval: 10000, // Refresh every 10 seconds

    }
  });

  // Obtain redemption application to be reviewed

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
      refetchInterval: 10000, // Refresh every 10 seconds

    }
  });

  // Obtain all audited casting applications

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

  // Obtain all audited redemption applications

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

  // Check whether the current user is an auditor

  const { data: isAuditor } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'auditors',
    args: [address],
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // Check whether the current user is the contract owner

  const { data: contractOwner } = useReadContract({
    address: greenTraceAddress as `0x${string}`,
    abi: GreenTraceABI.abi,
    functionName: 'owner',
    query: {
      enabled: !!greenTraceAddress && !!address,
    }
  });

  // Determine user permissions

  const isOwner = Boolean(address && contractOwner && 
    address.toLowerCase() === (contractOwner as string).toLowerCase());

  // Processing system statistics

  const processedStats: SystemStats | null = systemStats ? {
    totalMintRequests: Number((systemStats as any)[0]),
    totalCashRequests: Number((systemStats as any)[1]),
    pendingMintRequests: Number((systemStats as any)[2]),
    pendingCashRequests: Number((systemStats as any)[3]),
    approvedMintRequests: Number((systemStats as any)[4]),
    approvedCashRequests: Number((systemStats as any)[5]),
  } : null;

  // Refresh all data

  const refetchAll = () => {
    refetchStats();
    refetchPendingMint();
    refetchPendingCash();
    refetchAuditedMint();
    refetchAuditedCash();
  };

  return {
    // System statistics

    systemStats: processedStats,
    statsLoading,
    statsError,

    // Application to be reviewed

    pendingMintAudits: (pendingMintAudits as bigint[]) || [],
    pendingCashAudits: (pendingCashAudits as bigint[]) || [],
    pendingMintLoading,
    pendingCashLoading,

    // Audited application

    allAuditedMintRequests: (allAuditedMintRequests as bigint[]) || [],
    allAuditedCashRequests: (allAuditedCashRequests as bigint[]) || [],
    auditedMintLoading,
    auditedCashLoading,

    // User permissions

    isAuditor: !!isAuditor,
    isOwner,

    // Refresh method

    refetchAll,
    refetchStats,
    refetchPendingMint,
    refetchPendingCash,
  };
}; 