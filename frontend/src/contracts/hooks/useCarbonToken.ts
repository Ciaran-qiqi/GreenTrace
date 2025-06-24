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

// 定义ABI类型
type ContractABI = readonly unknown[];

// 获取正确的ABI
export const getCarbonTokenABI = (): ContractABI => {
  return (CarbonTokenABI.abi || CarbonTokenABI) as ContractABI;
};

// 根据链ID获取CarbonToken合约地址
const getContractAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.CarbonToken as Address;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
    case 31337: // 本地Foundry测试网
      return CONTRACT_ADDRESSES.foundry.CarbonToken as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
  }
};

// 获取GreenTrace合约地址
const getGreenTraceAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.GreenTrace as Address;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
    case 31337: // 本地Foundry测试网
      return CONTRACT_ADDRESSES.foundry.GreenTrace as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.GreenTrace as Address;
  }
};

// 查询用户CARB代币余额
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

// 查询用户对GreenTrace合约的授权额度
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

// 获取碳代币基本信息
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

// 授权碳代币
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

// 授权GreenTrace合约使用碳代币
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

// 转账碳代币
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

// GreenTrace授权管理钩子
export const useGreenTraceAllowance = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const greenTraceAddress = getGreenTraceAddress(chainId);

  // 查询授权额度
  const allowanceQuery = useCarbonTokenAllowance(address);
  
  // 查询用户余额
  const balanceQuery = useCarbonTokenBalance(address);
  
  // 授权操作
  const { 
    approveGreenTrace, 
    isPending: approvePending, 
    isConfirming: approveConfirming, 
    isConfirmed: approveConfirmed, 
    error: approveError, 
    hash: approveHash 
  } = useApproveGreenTrace();

  // 检查是否有足够授权
  const hasEnoughAllowance = (requiredAmount: bigint) => {
    const allowance = allowanceQuery.data as bigint | undefined;
    if (!allowance) return false;
    return allowance >= requiredAmount;
  };

  // 检查是否有足够余额
  const hasEnoughBalance = (requiredAmount: bigint) => {
    const balance = balanceQuery.data as bigint | undefined;
    if (!balance) return false;
    return balance >= requiredAmount;
  };

  // 授权最大额度
  const approveMax = () => {
    approveGreenTrace(BigInt(2) ** BigInt(256) - BigInt(1));
  };

  // 授权指定额度
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

// 检查铸造前置条件的综合hook
export const useMintPrerequisites = (userAddress: Address | undefined, requiredAmount: bigint | undefined) => {
  const { data: balance, isLoading: balanceLoading } = useCarbonTokenBalance(userAddress);
  const { data: allowance, isLoading: allowanceLoading } = useCarbonTokenAllowance(userAddress);

  const hasBalance = balance && requiredAmount ? balance >= requiredAmount : false;
  const hasAllowance = allowance && requiredAmount ? allowance >= requiredAmount : false;
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