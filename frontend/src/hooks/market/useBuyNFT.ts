'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '@/contracts/addresses';
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
import { toast } from 'react-hot-toast';

interface UseBuyNFTParams {
  tokenId: string;
  price: string;
  onSuccess?: () => void;
}

type BuyStep = 'check' | 'approve' | 'buy' | 'success' | 'error';

interface UseBuyNFTReturn {
  // state

  currentStep: BuyStep;
  setCurrentStep: (step: BuyStep) => void;
  isLoading: boolean;
  errorMessage: string;
  setErrorMessage: (message: string) => void;
  
  // Balance and authorization information

  carbBalance: bigint | undefined;
  allowance: bigint | undefined;
  hasEnoughBalance: boolean;
  needsApproval: boolean;
  
  // Operation functions

  handleApprove: () => Promise<void>;
  handleBuy: () => Promise<void>;
  reset: () => void;
}

/**
 * Buy NFT Hook
 * @description Provides a complete NFT purchase process, including balance checks, token authorization and purchase operations
 * @param tokenId NFT Token ID
 * @param price NFT price (wei format)
 * @param onSuccess Successful purchase callback
 * @returns Purchase related state and operation functions
 */
export const useBuyNFT = ({ tokenId, price, onSuccess }: UseBuyNFTParams): UseBuyNFTReturn => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [currentStep, setCurrentStep] = useState<BuyStep>('check');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Get the contract address

  const getMarketAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.Market;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.Market;
      case 31337: return CONTRACT_ADDRESSES.foundry.Market;
      default: return CONTRACT_ADDRESSES.sepolia.Market;
    }
  };

  const getCarbonTokenAddress = (chainId: number): string => {
    switch (chainId) {
      case 1: return CONTRACT_ADDRESSES.mainnet.CarbonToken;
      case 11155111: return CONTRACT_ADDRESSES.sepolia.CarbonToken;
      case 31337: return CONTRACT_ADDRESSES.foundry.CarbonToken;
      default: return CONTRACT_ADDRESSES.sepolia.CarbonToken;
    }
  };

  const marketAddress = getMarketAddress(chainId);
  const carbonTokenAddress = getCarbonTokenAddress(chainId);

  // Check the carb balance

  const { data: carbBalance, refetch: refetchBalance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Check the carb authorization amount

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'allowance',
    args: address ? [address, marketAddress] : undefined,
    query: { enabled: !!address && !!marketAddress }
  });

  // Authorize carb contract calls

  const { writeContract: approveCarb, data: approveHash } = useWriteContract();
  
  // Purchase nft contract call

  const { writeContract: buyNFT, data: buyHash } = useWriteContract();

  // Listen to authorized transaction status

  const { isSuccess: approveSuccess, isError: approveError, error: approveErrorDetails, isLoading: approveLoading } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Listen to the purchase transaction status

  const { isSuccess: buySuccess, isError: buyError, error: buyErrorDetails, isLoading: buyLoading } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  // Calculate the status

  const needsApproval = !allowance || BigInt(price) > BigInt(allowance.toString());
  const hasEnoughBalance = Boolean(carbBalance && BigInt(price) <= BigInt(carbBalance.toString()));
  const isLoading = approveLoading || buyLoading || currentStep === 'approve' || currentStep === 'buy';

  // Processing Authorization

  const handleApprove = async (): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }
    
    try {
      setCurrentStep('approve');
      setErrorMessage('');
      
      // Authorize slightly more tokens to prevent price fluctuations

      const approveAmount = BigInt(price) * BigInt(110) / BigInt(100); // More authorization 10%

      
      await approveCarb({
        address: carbonTokenAddress as `0x${string}`,
        abi: CarbonTokenABI.abi,
        functionName: 'approve',
        args: [marketAddress, approveAmount],
      });
    } catch (error) {
      console.error('授权失败:', error);
      const errorMsg = '授权失败，请重试';
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  };

  // Process the purchase

  const handleBuy = async (): Promise<void> => {
    if (!address) {
      toast.error('请先连接钱包');
      return;
    }
    
    try {
      setCurrentStep('buy');
      setErrorMessage('');
      
      await buyNFT({
        address: marketAddress as `0x${string}`,
        abi: GreenTalesMarketABI.abi,
        functionName: 'buyNFT',
        args: [BigInt(tokenId)],
      });
    } catch (error) {
      console.error('购买失败:', error);
      const errorMsg = '购买失败，请重试';
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  };

  // Reset status

  const reset = (): void => {
    setCurrentStep('check');
    setErrorMessage('');
  };

  // Listen to authorized transactions completed

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      refetchBalance();
      setCurrentStep('check');
      toast.success('授权成功！现在可以购买NFT');
    }
  }, [approveSuccess, refetchAllowance, refetchBalance]);

  // Listen to purchase transactions completed

  useEffect(() => {
    if (buySuccess) {
      setCurrentStep('success');
      toast.success('🎉 NFT购买成功！');
      onSuccess?.();
    }
  }, [buySuccess, onSuccess]);

  // Listening authorization error

  useEffect(() => {
    if (approveError && approveErrorDetails) {
      console.error('授权交易失败:', approveErrorDetails);
      let errorMsg = '授权失败';
      
      if (approveErrorDetails.message?.includes('insufficient allowance')) {
        errorMsg = '授权额度不足，请重新授权';
      } else if (approveErrorDetails.message?.includes('user rejected')) {
        errorMsg = '用户取消了授权';
      } else if (approveErrorDetails.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      }
      
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  }, [approveError, approveErrorDetails]);

  // Listen to purchase errors

  useEffect(() => {
    if (buyError && buyErrorDetails) {
      console.error('购买交易失败:', buyErrorDetails);
      let errorMsg = '购买失败';
      
      if (buyErrorDetails.message?.includes('insufficient allowance')) {
        errorMsg = 'CARB授权不足，请先授权足够的代币';
      } else if (buyErrorDetails.message?.includes('user rejected')) {
        errorMsg = '用户取消了购买';
      } else if (buyErrorDetails.message?.includes('insufficient funds')) {
        errorMsg = 'ETH余额不足，无法支付Gas费';
      } else if (buyErrorDetails.message?.includes('not listed')) {
        errorMsg = '该NFT已下架或不存在';
      }
      
      setErrorMessage(errorMsg);
      setCurrentStep('error');
      toast.error(errorMsg);
    }
  }, [buyError, buyErrorDetails]);

  return {
    // state

    currentStep,
    setCurrentStep,
    isLoading,
    errorMessage,
    setErrorMessage,
    
    // Balance and authorization information

    carbBalance: carbBalance as bigint | undefined,
    allowance: allowance as bigint | undefined,
    hasEnoughBalance,
    needsApproval,
    
    // Operation functions

    handleApprove,
    handleBuy,
    reset,
  };
}; 