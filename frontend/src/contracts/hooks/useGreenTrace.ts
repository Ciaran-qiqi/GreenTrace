'use client';

import { useEffect } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId
} from 'wagmi';
import { Address } from 'viem';
import { CONTRACT_ADDRESSES } from '../addresses';
import GreenTraceABI from '../abi/GreenTrace.json';
import { AuditStatus } from '../types/greenTrace';

// Define abi type

type ContractABI = readonly unknown[];

// Get the correct abi

export const getGreenTraceABI = (): ContractABI => {
  return (GreenTraceABI.abi || GreenTraceABI) as ContractABI;
};

// Get the contract address according to the link id

const getContractAddress = (chainId: number): Address => {
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

// Get green trace contract constant

export const useGreenTraceConstants = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { data: baseRate } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'BASE_RATE',
  });

  const { data: systemFeeRate } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'SYSTEM_FEE_RATE',
  });

  const { data: auditFeeRate } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'AUDIT_FEE_RATE',
  });

  const { data: initialized } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'initialized',
  });

  const { data: isTestEnvironment } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
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

// Calculate the request fee

export const useCalculateRequestFee = (carbonReduction: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'calculateRequestFee',
    args: carbonReduction ? [carbonReduction] : undefined,
    query: {
      enabled: !!carbonReduction && carbonReduction > BigInt(0),
    }
  });
};

// Calculate system costs

export const useCalculateSystemFee = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'calculateSystemFee',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

// Calculate audit fees

export const useCalculateAuditFee = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'calculateAuditFee',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

// Calculate the amount of return

export const useCalculateReturnAmount = (amount: bigint | null) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'calculateReturnAmount',
    args: amount ? [amount] : undefined,
    query: {
      enabled: !!amount && amount > BigInt(0),
    }
  });
};

// Check the contract initialization status

export const useIsContractInitialized = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'initialized',
  });
};

// Request to cast nft

export const useRequestMintNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ 
      hash,
      timeout: 120_000, // Time out of 2 minutes, give enough time to confirm the transaction

      confirmations: 1,  // Just wait for 1 confirmation

    });

  // Monitor status changes

  useEffect(() => {
    console.log('useRequestMintNFT状态监控:', {
      chainId,
      contractAddress,
      hash,
      error: error?.message,
      errorCause: error?.cause,
      errorDetails: error,
      isPending,
      isConfirming,
      isConfirmed
    });
  }, [chainId, contractAddress, hash, error, isPending, isConfirming, isConfirmed]);

  const requestMint = (
    title: string,
    storyDetails: string,
    carbonReduction: bigint,
    tokenURI: string
  ) => {
    writeContract({
      address: contractAddress,
      abi: getGreenTraceABI(),
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

// Commercial contract minting nft

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
      abi: getGreenTraceABI(),
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

// Pay and Cast NFTs -Simplified Version

export const usePayAndMintNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = 
    useWaitForTransactionReceipt({ 
      hash,
      // Don't set custom configurations, use default values

    });

  // Monitor status changes -add detailed debugging information

  useEffect(() => {
    console.log('📊 usePayAndMintNFT状态更新:', {
      网络链ID: chainId,
      合约地址: contractAddress,
      交易哈希: hash,
      错误信息: error?.message,
      错误名称: error?.name,
      错误原因: error?.cause,
      等待中: isPending,
      确认中: isConfirming,
      已确认: isConfirmed,
      收据错误: receiptError?.message
    });
    
    if (error) {
      console.error('💥 铸造过程详细错误信息:', {
        完整错误对象: error,
        错误消息: error.message,
        错误名称: error.name,
        错误原因: error.cause,
        错误堆栈: error.stack,
        错误代码: (error as any).code,
        错误数据: (error as any).data,
        // 🔍 New: In-depth analysis error message

        原始错误字符串: JSON.stringify(error),
        是否包含ERC20错误: error.message.includes('ERC20') || JSON.stringify(error).includes('ERC20'),
        是否为授权问题: error.message.includes('allowance') || error.message.includes('insufficient allowance') || JSON.stringify(error).includes('allowance'),
        是否为余额问题: error.message.includes('insufficient balance') || error.message.includes('Insufficient balance'),
        是否为权限问题: error.message.includes('Not the requester') || error.message.includes('requester'),
      });
      
      // 🎯 Intelligent Error Analysis -Prioritize the identification of real blockchain errors

      const errorString = JSON.stringify(error).toLowerCase();
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
        console.warn('🔴 用户在钱包中拒绝了交易');
      } else if (errorMessage.includes('insufficient allowance') || errorString.includes('insufficient allowance') || 
                 errorMessage.includes('erc20') && errorMessage.includes('allowance')) {
        console.warn('🔴 🎯 CARB代币授权不足！这是真正的失败原因');
        console.warn('💡 解决方案：需要先授权GreenTrace合约使用用户的CARB代币');
      } else if (errorMessage.includes('insufficient balance') || errorMessage.includes('balance')) {
        console.warn('🔴 余额不足（ETH Gas费用或CARB代币余额）');
      } else if (errorMessage.includes('revert')) {
        console.warn('🔴 合约调用被拒绝 - 分析具体revert原因');
        // Further analyze the reason for revert

        if (errorMessage.includes('mint audit not approved')) {
          console.warn('🔴 申请未通过审核');
        } else if (errorMessage.includes('not the requester')) {
          console.warn('🔴 身份验证失败 - 不是申请人');
        } else if (errorMessage.includes('carbon value not set')) {
          console.warn('🔴 碳价值未设置');
        } else {
          console.warn('🔴 其他合约逻辑错误');
        }
      } else if (errorMessage.includes('timeout')) {
        console.warn('🔴 交易超时 - 网络拥堵');
      } else if (errorMessage.includes('nonce')) {
        console.warn('🔴 交易序号(nonce)问题');
      } else {
        console.warn('🔴 未知错误类型:', errorMessage);
      }
    }
    
    if (receiptError) {
      console.error('💥 交易收据错误:', receiptError);
      // 🔍 Analysis of whether the receipt error contains more accurate information

      const receiptErrorString = JSON.stringify(receiptError).toLowerCase();
      if (receiptErrorString.includes('insufficient allowance') || receiptErrorString.includes('erc20')) {
        console.warn('🔴 交易收据确认：CARB代币授权不足');
      }
    }
    
    if (hash) {
      console.log('✅ 交易已提交:', {
        交易哈希: hash,
        区块链浏览器: `https://sepolia.etherscan.io/tx/${hash}`,
        建议: '如果交易失败，请在区块链浏览器中查看真实的失败原因'
      });
    }
  }, [chainId, contractAddress, hash, error, isPending, isConfirming, isConfirmed, receiptError]);

  /**
   * Call the payAndMintNFT of the contract, just pass in the application ID
   * @param requestId Casting application ID
   */
  const payAndMint = (requestId: bigint) => {
    console.log('🎯 usePayAndMintNFT: 准备调用合约', {
      合约地址: contractAddress,
      申请ID: requestId.toString(),
      网络链ID: chainId,
      Sepolia测试网: chainId === 11155111 ? '✅' : '❌',
      时间戳: new Date().toISOString()
    });
    
    // Basic Verification

    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      const error = new Error('合约地址无效');
      console.error('❌ 合约地址验证失败:', contractAddress);
      throw error;
    }
    
    if (requestId <= BigInt(0)) {
      const error = new Error('申请ID无效');
      console.error('❌ 申请ID验证失败:', requestId.toString());
      throw error;
    }
    
    try {
      console.log('🚀 正在调用writeContract...');
      writeContract({
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: 'payAndMintNFT',
        args: [requestId],
        // Remove all custom gas configurations and let the wallet handle it automatically

      });
      console.log('✅ writeContract调用成功，等待钱包确认...');
    } catch (err) {
      console.error('❌ writeContract调用失败:', err);
      throw err;
    }
  };

  return {
    payAndMint,
    hash,
    error: error || receiptError, // Merge two errors

    isPending,
    isConfirming,
    isConfirmed,
  };
};

// Request redemption nft

export const useRequestExchangeNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const requestExchange = (tokenId: bigint) => {
    writeContract({
      address: contractAddress,
      abi: getGreenTraceABI(),
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

// Redeem nft

export const useExchangeNFT = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const exchangeNFT = (cashId: bigint) => {
    writeContract({
      address: contractAddress,
      abi: getGreenTraceABI(),
      functionName: 'exchangeNFT',
      args: [cashId],
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

// Submit redemption audit

export const useSubmitExchangeAudit = () => {
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const submitExchangeAudit = (cashId: bigint, carbonValue: bigint, comment: string) => {
    writeContract({
      address: contractAddress,
      abi: getGreenTraceABI(),
      functionName: 'submitExchangeAudit',
      args: [cashId, carbonValue, comment],
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

// Submit a foundry audit

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
      abi: getGreenTraceABI(),
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



// Complete redemption audit

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
      abi: getGreenTraceABI(),
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

// Check whether you are an auditor

export const useIsAuditor = (address: Address) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'auditors',
    args: [address],
    query: {
      enabled: !!address,
    }
  });
};

// Check if it is a commercial contract

export const useIsBusinessContract = (address: Address) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'isBusinessContract',
    args: [address],
    query: {
      enabled: !!address,
    }
  });
};

// Obtain audit information

export const useGetAudit = (tokenId: bigint) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'getAudit',
    args: [tokenId],
    query: {
      enabled: !!tokenId,
    }
  });
};

// Get the contract owner

export const useGetOwner = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'owner',
  });
};

// Get the carbon token contract address

export const useGetCarbonToken = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'carbonToken',
  });
};

// Get the nft contract address

export const useGetGreenTalesNFT = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'greenTalesNFT',
  });
};

// Obtain all user minting application IDs (contract query)
// Pass in the user address and return the array of all minting application IDs for this user

export const useGetUserMintRequests = (userAddress: Address | undefined) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'getUserMintRequests',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });
};

// Inquiry on application details

export const useGetRequestById = (requestId: bigint | undefined) => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  const { data, isError, isLoading, error, refetch } = useReadContract({
    address: contractAddress,
    abi: getGreenTraceABI(),
    functionName: 'getRequestById',
    args: requestId !== undefined ? [requestId] : undefined,
    query: {
      enabled: requestId !== undefined && requestId > BigInt(0),
    },
  });

  return {
    data,
    isError,
    isLoading,
    error,
    refetch,
  };
};

// Universal green trace contract hook

export const useGreenTrace = () => {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  return {
    contract: {
      address: contractAddress,
      abi: getGreenTraceABI(),
    },
    address: contractAddress,
    abi: getGreenTraceABI(),
  };
}; 