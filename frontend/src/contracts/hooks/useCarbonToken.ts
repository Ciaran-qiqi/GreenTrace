import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
  useChainId
} from 'wagmi';
import { Address, parseEther } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import CarbonTokenABI from '../abi/CarbonToken.json';

const getCarbonTokenAddress = (chainId: number): Address => {
  switch (chainId) {
    case 1:
      return CONTRACT_ADDRESSES.mainnet.CarbonToken as Address;
    case 11155111:
      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
    case 31337:
      return CONTRACT_ADDRESSES.foundry.CarbonToken as Address;
    default:
      return CONTRACT_ADDRESSES.sepolia.CarbonToken as Address;
  }
};

const getGreenTraceAddress = (chainId: number): Address => {
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

export const useCarbonTokenBalance = (address?: Address) => {
  const chainId = useChainId();
  const tokenAddress = getCarbonTokenAddress(chainId);

  return useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    }
  });
};

export const useCarbonTokenAllowance = (owner?: Address, spender?: Address) => {
  const chainId = useChainId();
  const tokenAddress = getCarbonTokenAddress(chainId);
  return useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!owner && !!spender,
    }
  });
};

export const useCarbonTokenInfo = () => {
  const chainId = useChainId();
  const tokenAddress = getCarbonTokenAddress(chainId);

  const { data: name } = useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'name',
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'symbol',
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'decimals',
  });

  const { data: totalSupply } = useReadContract({
    address: tokenAddress,
    abi: CarbonTokenABI,
    functionName: 'totalSupply',
  });

  return {
    name,
    symbol,
    decimals,
    totalSupply,
  };
};


export const useApproveCarbonToken = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const tokenAddress = getCarbonTokenAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const approve = (spender: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: CarbonTokenABI,
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

export const useTransferCarbonToken = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const tokenAddress = getCarbonTokenAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const transfer = (to: Address, amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: CarbonTokenABI,
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

export const useGreenTraceAllowance = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const greenTraceAddress = getGreenTraceAddress(chainId);

  console.log('🔍 useGreenTraceAllowance Debug Info:');
  console.log('  - User address:', address);
  console.log('  - Chain ID:', chainId);
  console.log('  - GreenTrace address:', greenTraceAddress);
  console.log('  - Has both addresses:', !!address && !!greenTraceAddress);

  const allowanceQuery = useCarbonTokenAllowance(address, greenTraceAddress);
  console.log('allowanceQuery', allowanceQuery);
  
  if (allowanceQuery.isError) {
    console.error('❌ Allowance Query Error:', allowanceQuery.error);
  }
  
  const balanceQuery = useCarbonTokenBalance(address);
  console.log('balanceQuery', balanceQuery);
  
  if (balanceQuery.isError) {
    console.error('❌ Balance Query Error:', balanceQuery.error);
  }
  const { approveGreenTrace, isPending: approvePending, isConfirming: approveConfirming, isConfirmed: approveConfirmed, error: approveError, hash: approveHash } = useApproveGreenTrace();

  const hasEnoughAllowance = (requiredAmount: bigint) => {
    if (!allowanceQuery.data || typeof allowanceQuery.data !== 'bigint') return false;
    return allowanceQuery.data >= requiredAmount;
  };

  const hasEnoughBalance = (requiredAmount: bigint) => {
    if (!balanceQuery.data || typeof balanceQuery.data !== 'bigint') return false;
    return balanceQuery.data >= requiredAmount;
  };

  const approveMax = () => {
    const maxAmount = parseEther('1000000');
    approveGreenTrace(maxAmount);
  };

  const approveAmount = (amount: bigint) => {
    approveGreenTrace(amount);
  };

  return {
    allowance: allowanceQuery.data,
    balance: balanceQuery.data,
    isLoadingAllowance: allowanceQuery.isLoading,
    isLoadingBalance: balanceQuery.isLoading,

    hasEnoughAllowance,
    hasEnoughBalance,

    approveMax,
    approveAmount,

    approvePending,
    approveConfirming,
    approveConfirmed,
    approveError,
    approveHash,

    greenTraceAddress,
  };
}; 