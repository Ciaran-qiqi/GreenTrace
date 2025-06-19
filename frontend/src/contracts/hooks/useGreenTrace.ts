import { 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt,
  useAccount,
  useChainId 
} from 'wagmi';
import { Address, parseEther } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import GreenTraceABI from '../abi/GreenTrace.json';

export enum AuditStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2
}

export enum AuditType {
  MINT = 0,
  EXCHANGE = 1
}

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

export const useGreenTraceConstants = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { data: baseRate } = useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'BASE_RATE',
  });

  const { data: systemFeeRate } = useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'SYSTEM_FEE_RATE',
  });

  const { data: auditFeeRate } = useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'AUDIT_FEE_RATE',
  });

  const { data: initialized } = useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'initialized',
  });

  const { data: isTestEnvironment } = useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'isTestEnvironment',
  });

  return {
    baseRate,
    systemFeeRate,
    auditFeeRate,
    initialized,
    isTestEnvironment,
  };
};

export const useCalculateRequestFee = (carbonReduction: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'calculateRequestFee',
    args: carbonReduction ? [carbonReduction] : undefined,
    query: {
      enabled: !!carbonReduction && carbonReduction > BigInt(0),
    }
  });
};

export const useCalculateSystemFee = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'calculateSystemFee',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

export const useCalculateAuditFee = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'calculateAuditFee',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

export const useCalculateReturnAmount = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'calculateReturnAmount',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

export const useRequestMintNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const requestMint = (
    title: string,
    storyDetails: string,
    carbonReduction: bigint,
    tokenURI: string
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'requestMintNFT',
      args: [title, storyDetails, carbonReduction, tokenURI],
    });
  };

  return {
    requestMint,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useMintNFTByBusiness = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const mintByBusiness = (
    recipient: Address,
    title: string,
    storyDetails: string,
    carbonReduction: bigint,
    initialPrice: bigint,
    tokenURI: string
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'mintNFTByBusiness',
      args: [recipient, title, storyDetails, carbonReduction, initialPrice, tokenURI],
    });
  };

  return {
    mintByBusiness,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const usePayAndMintNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const payAndMint = (
    tokenId: bigint,
    to: Address,
    title: string,
    details: string,
    carbonReduction: bigint,
    tokenURI: string
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'payAndMintNFT',
      args: [tokenId, to, title, details, carbonReduction, tokenURI],
    });
  };

  return {
    payAndMint,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useRequestExchangeNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const requestExchange = (tokenId: bigint) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'requestExchangeNFT',
      args: [tokenId],
    });
  };

  return {
    requestExchange,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useExchangeNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const exchangeNFT = (tokenId: bigint) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'exchangeNFT',
      args: [tokenId],
    });
  };

  return {
    exchangeNFT,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useSubmitMintAudit = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const submitMintAudit = (
    tokenId: bigint,
    carbonValue: bigint,
    reason: string
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'submitMintAudit',
      args: [tokenId, carbonValue, reason],
    });
  };

  return {
    submitMintAudit,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useSubmitExchangeAudit = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const submitExchangeAudit = (
    tokenId: bigint,
    carbonValue: bigint
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'submitExchangeAudit',
      args: [tokenId, carbonValue],
    });
  };

  return {
    submitExchangeAudit,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useCompleteExchangeAudit = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const completeExchangeAudit = (
    tokenId: bigint,
    status: AuditStatus
  ) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'completeExchangeAudit',
      args: [tokenId, status],
    });
  };

  return {
    completeExchangeAudit,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useAddAuditor = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const addAuditor = (auditorAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'addAuditor',
      args: [auditorAddress],
    });
  };

  return {
    addAuditor,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useRemoveAuditor = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const removeAuditor = (auditorAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'removeAuditor',
      args: [auditorAddress],
    });
  };

  return {
    removeAuditor,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useAddBusinessContract = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const addBusinessContract = (contractAddress: Address) => {
    writeContract({
      address: getContractAddress(chainId),
      abi: GreenTraceABI,
      functionName: 'addBusinessContract',
      args: [contractAddress],
    });
  };

  return {
    addBusinessContract,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useRemoveBusinessContract = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const removeBusinessContract = (contractAddress: Address) => {
    writeContract({
      address: getContractAddress(chainId),
      abi: GreenTraceABI,
      functionName: 'removeBusinessContract',
      args: [contractAddress],
    });
  };

  return {
    removeBusinessContract,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useUpdateNFTPriceByBusiness = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const updateNFTPrice = (tokenId: bigint, newPrice: bigint) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'updateNFTPriceByBusiness',
      args: [tokenId, newPrice],
    });
  };

  return {
    updateNFTPrice,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useIsAuditor = (address: Address) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'auditors',
    args: [address],
  });
};

export const useIsBusinessContract = (address: Address) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'businessContracts',
    args: [address],
  });
};

export const useGetAudit = (tokenId: bigint) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'audits',
    args: [tokenId],
  });
};

export const useGetOwner = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'owner',
  });
};

export const useGetCarbonToken = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'carbonToken',
  });
};

export const useGetGreenTalesNFT = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: GreenTraceABI,
    functionName: 'greenTalesNFT',
  });
};

export const useInitialize = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const initialize = () => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'initialize',
    });
  };

  return {
    initialize,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useSetNFTContract = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const setNFTContract = (greenTalesNFTAddress: Address) => {
    writeContract({
      address: contractAddress,
      abi: GreenTraceABI,
      functionName: 'setNFTContract',
      args: [greenTalesNFTAddress],
    });
  };

  return {
    setNFTContract,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  };
};

export const useGreenTrace = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const constants = useGreenTraceConstants();
  const isAuditor = useIsAuditor(address as Address);
  const isBusinessContract = useIsBusinessContract(address as Address);

  return {
    contractAddress,
    constants,
    isAuditor: isAuditor.data,
    isBusinessContract: isBusinessContract.data,
    ...useRequestMintNFT(),
    ...useRequestExchangeNFT(),
    ...useSubmitMintAudit(),
    ...useSubmitExchangeAudit(),
  };
}; 