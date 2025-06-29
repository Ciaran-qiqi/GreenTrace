'use client';

import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId
} from 'wagmi';
import { Address } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import CarbonTokenABI from '../abi/CarbonToken.json';

// Define abi type

type ContractABI = readonly unknown[];

// Get the correct abi

export const getCarbonTokenABI = (): ContractABI => {
  return (CarbonTokenABI.abi || CarbonTokenABI) as ContractABI;
};

// Obtain the carbon token contract address according to the chain id

const getContractAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.CarbonToken as Address;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
    case 31337: // Local foundry test network

      return CONTRACT_ADDRESSES.foundry.CarbonToken as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
  }
};

// Get the green trace contract address

const getGreenTraceAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.GreenTrace as Address;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
    case 31337: // Local foundry test network

      return CONTRACT_ADDRESSES.foundry.GreenTrace as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
  }
};

// Query the user's carb token balance

export const useCarbonTokenBalance = (userAddress: Address | undefined) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getCarbonTokenABI(),
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });
};

// Query the user's authorization amount to the green trace contract

export const useCarbonTokenAllowance = (userAddress: Address | undefined) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const greenTraceAddress = getGreenTraceAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getCarbonTokenABI(),
    functionName: 'allowance',
    args: userAddress ? [userAddress, greenTraceAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });
};

// Get basic information about carbon tokens

export const useCarbonTokenInfo = () => {
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId);

  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: getCarbonTokenABI(),
    functionName: 'name',
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: getCarbonTokenABI(),
    functionName: 'symbol',
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: getCarbonTokenABI(),
    functionName: 'decimals',
  });

  const { data: totalSupply } = useReadContract({
    address: tokenAddress,
    abi: getCarbonTokenABI(),
    functionName: 'totalSupply',
  });

  return {
    name: name as string,
    symbol: symbol as string,
    decimals: decimals as number,
    totalSupply: totalSupply as bigint,
  };
};

// Authorized carbon tokens

export const useApproveCarbonToken = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const approve = (spender: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: getCarbonTokenABI(),
      functionName: 'approve',
      args: [spender, amount],
    });
  };

  return {
    approve,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

// Authorize green trace contracts to use carbon tokens

export const useApproveGreenTrace = () => {
  const chainId = useChainId();
  const greenTraceAddress = getGreenTraceAddress(chainId);
  const { approve, ...rest } = useApproveCarbonToken();

  const approveGreenTrace = (amount: bigint) => {
    approve(greenTraceAddress, amount);
  };

  return {
    approveGreenTrace,
    greenTraceAddress,
    ...rest,
  };
};

// Transfer of carbon tokens

export const useTransferCarbonToken = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const transfer = (to: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: getCarbonTokenABI(),
      functionName: 'transfer',
      args: [to, amount],
    });
  };

  return {
    transfer,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

// Green trace authorization management hook

export const useGreenTraceAllowance = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const greenTraceAddress = getGreenTraceAddress(chainId);

  // Query the authorization amount

  const allowanceQuery = useCarbonTokenAllowance(address);
  
  // Query user balance

  const balanceQuery = useCarbonTokenBalance(address);
  
  // Authorize operations

  const { 
    approveGreenTrace, 
    isPending: approvePending, 
    isConfirming: approveConfirming, 
    isConfirmed: approveConfirmed, 
    error: approveError, 
    hash: approveHash 
  } = useApproveGreenTrace();

  // Check if there is sufficient authorization

  const hasEnoughAllowance = (requiredAmount: bigint) => {
    const allowance = allowanceQuery.data as bigint | undefined;
    if (!allowance) return false;
    return allowance >= requiredAmount;
  };

  // Check if there is sufficient balance

  const hasEnoughBalance = (requiredAmount: bigint) => {
    const balance = balanceQuery.data as bigint | undefined;
    if (!balance) return false;
    return balance >= requiredAmount;
  };

  // Maximum authorization amount

  const approveMax = () => {
    approveGreenTrace(BigInt(2) ** BigInt(256) - BigInt(1));
  };

  // Authorization specified amount

  const approveAmount = (amount: bigint) => {
    approveGreenTrace(amount);
  };

  return {
    allowance: allowanceQuery.data as bigint | undefined,
    balance: balanceQuery.data as bigint | undefined,
    isLoadingAllowance: allowanceQuery.isLoading,
    isLoadingBalance: balanceQuery.isLoading,
    hasEnoughAllowance,
    hasEnoughBalance,
    approveMax,
    approveAmount,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isConfirmed: approveConfirmed,
    error: approveError,
    hash: approveHash,
    greenTraceAddress,
  };
};

// Comprehensive hooks to check casting preconditions

export const useMintPrerequisites = (userAddress: Address | undefined, requiredAmount: bigint | undefined) => {
  const { data: balance, isLoading: balanceLoading } = useCarbonTokenBalance(userAddress);
  const { data: allowance, isLoading: allowanceLoading } = useCarbonTokenAllowance(userAddress);

  const hasBalance = balance && requiredAmount ? BigInt(balance.toString()) >= BigInt(requiredAmount.toString()) : false;
  const hasAllowance = allowance && requiredAmount ? BigInt(allowance.toString()) >= BigInt(requiredAmount.toString()) : false;
  const isReady = hasBalance && hasAllowance;

  return {
    balance,
    allowance,
    hasBalance,
    hasAllowance,
    isReady,
    isLoading: balanceLoading || allowanceLoading,
    requiredAmount,
  };
}; 