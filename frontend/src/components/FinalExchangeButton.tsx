'use client';

import React, { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useChainId } from 'wagmi';
import { useExchangeNFT } from '@/contracts/hooks/useGreenTrace';
import { formatFeeAmount, safeParseToBigInt } from '@/utils/tokenUtils';
import { getGreenTalesNFTAddress, getContractAddress } from '@/contracts/addresses';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';

// Redemption application information interface

interface ExchangeRequest {
  cashId: string;
  nftTokenId: string;
  auditedCarbonValue: string;
  auditor?: string;
  auditComment?: string;
}

// Final redemption button component properties

interface FinalExchangeButtonProps {
  exchangeRequest: ExchangeRequest;
  onExchangeSuccess?: () => void;
  buttonText?: string;
  className?: string;
}

// Final redemption button component

export const FinalExchangeButton: React.FC<FinalExchangeButtonProps> = ({
  exchangeRequest,
  onExchangeSuccess,
  buttonText = '执行兑换',
  className = ''
}) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  
  // Get the contract address

  const nftContractAddress = getGreenTalesNFTAddress(chainId);
  const greenTraceAddress = getContractAddress(chainId);
  
  // Redeem nft hook

  const { exchangeNFT, isPending, isConfirming, isConfirmed, error } = useExchangeNFT();

  // Nft authorization related hooks

  const { writeContract: approveNFT, data: approvalHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApprovingConfirming, isSuccess: isApprovalConfirmed } = 
    useWaitForTransactionReceipt({ hash: approvalHash });

  // Check if nft is authorized

  const { data: approvedAddress, refetch: refetchApproval } = useReadContract({
    address: nftContractAddress as `0x${string}`,
    abi: GreenTalesNFTABI.abi,
    functionName: 'getApproved',
    args: [BigInt(exchangeRequest.nftTokenId)],
    query: {
      enabled: !!address && !!exchangeRequest.nftTokenId,
    }
  });

  // Calculate fee allocation

  const calculateFeeBreakdown = (carbonValue: string) => {
    const value = safeParseToBigInt(carbonValue);
    const systemFee = value / BigInt(100); // 1%

    const auditFee = value * BigInt(4) / BigInt(100); // 4%

    const totalFees = systemFee + auditFee;
    const finalAmount = value - totalFees;
    
    return {
      totalValue: value,
      systemFee,
      auditFee,
      totalFees,
      finalAmount
    };
  };

  // Check authorization status

  const checkApprovalStatus = React.useCallback(() => {
    if (!approvedAddress || !greenTraceAddress) return;
    
    const isApproved = (approvedAddress as string).toLowerCase() === greenTraceAddress.toLowerCase();
    setNeedsApproval(!isApproved);
    
    console.log('NFT授权检查:', {
      tokenId: exchangeRequest.nftTokenId,
      approvedAddress,
      greenTraceAddress,
      isApproved
    });
  }, [approvedAddress, greenTraceAddress, exchangeRequest.nftTokenId]);

  // Listen to authorization status changes

  React.useEffect(() => {
    checkApprovalStatus();
  }, [checkApprovalStatus]);

  // Processing authorization is completed

  React.useEffect(() => {
    if (isApprovalConfirmed) {
      console.log('NFT授权成功，重新检查授权状态');
      setTimeout(() => {
        refetchApproval();
      }, 1000);
    }
  }, [isApprovalConfirmed, refetchApproval]);

  // Handle nft authorization

  const handleApproveNFT = () => {
    try {
      approveNFT({
        address: nftContractAddress as `0x${string}`,
        abi: GreenTalesNFTABI.abi,
        functionName: 'approve',
        args: [greenTraceAddress, BigInt(exchangeRequest.nftTokenId)],
      });
    } catch (error) {
      console.error('授权NFT失败:', error);
      alert(`授权失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Processing and performing redemption

  const handleExecuteExchange = async () => {
    setCheckingApproval(true);
    
    // Recheck authorization status

    await refetchApproval();
    
    setTimeout(() => {
      checkApprovalStatus();
      setCheckingApproval(false);
      setShowConfirmModal(true);
    }, 500);
  };

  // Confirm the redemption execution

  const confirmExecuteExchange = () => {
    // Check the authorization status again

    if (needsApproval) {
      alert('请先授权NFT后再执行兑换！');
      closeConfirmModal();
      return;
    }

    try {
      exchangeNFT(BigInt(exchangeRequest.cashId));
    } catch (error) {
      console.error('执行兑换失败:', error);
      alert(`执行兑换失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Close the confirmation pop-up window

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
  };

  // Processing and redemption completed

  React.useEffect(() => {
    if (isConfirmed) {
      closeConfirmModal();
      if (onExchangeSuccess) {
        onExchangeSuccess();
      }
    }
  }, [isConfirmed, onExchangeSuccess]);

  // Handling errors

  React.useEffect(() => {
    if (error) {
      console.error('兑换执行错误:', error);
      alert(`兑换执行失败: ${error.message}`);
    }
  }, [error]);

  const feeBreakdown = calculateFeeBreakdown(exchangeRequest.auditedCarbonValue);

  // Button status logic

  const isLoading = isPending || isConfirming || isApproving || isApprovingConfirming || checkingApproval;
  const showApprovalButton = needsApproval && !isApprovalConfirmed;

  return (
    <>
      {/* Authorization or redemption button area */}
      <div className="flex flex-col items-center gap-3">
        {showApprovalButton ? (
          <>
            {/* Authorization prompts */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center max-w-md">
              <p className="text-yellow-800 font-medium mb-2">⚠️ 需要授权NFT</p>
              <p className="text-yellow-700 text-sm">
                在兑换之前，需要先授权GreenTrace合约可以操作您的NFT #{exchangeRequest.nftTokenId}
              </p>
            </div>
            
            {/* Authorization button */}
            <button
              onClick={handleApproveNFT}
              disabled={isApproving || isApprovingConfirming}
              className={`px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none ${className}`}
            >
              {isApproving || isApprovingConfirming ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isApproving ? '授权中...' : '确认授权...'}
                </div>
              ) : (
                '授权NFT'
              )}
            </button>
          </>
        ) : (
          /* Execute the redemption button */
          <button
            onClick={handleExecuteExchange}
            disabled={isLoading}
            className={`px-8 py-3 rounded-lg font-semibold text-white transition-all duration-200 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none ${className}`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {checkingApproval ? '检查授权...' : isPending ? '准备交易...' : '确认中...'}
              </div>
            ) : (
              buttonText
            )}
          </button>
        )}
      </div>

      {/* Final redemption confirmation pop-up window */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">确认执行兑换</h3>
            
            {/* Redemption information */}
            <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 mb-6 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3">兑换信息</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-600">兑换申请ID:</span>
                  <span className="font-medium">#{exchangeRequest.cashId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-600">NFT编号:</span>
                  <span className="font-medium">#{exchangeRequest.nftTokenId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-600">审计确认价值:</span>
                  <span className="font-medium">{formatFeeAmount(exchangeRequest.auditedCarbonValue)} CARB</span>
                </div>
                {exchangeRequest.auditor && (
                  <div className="flex justify-between">
                    <span className="text-green-600">审计员:</span>
                    <span className="font-mono text-xs">{exchangeRequest.auditor.slice(0, 6)}...{exchangeRequest.auditor.slice(-4)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fee details */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 mb-6 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-3">费用明细</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600">兑换价值:</span>
                  <span className="font-medium">{formatFeeAmount(feeBreakdown.totalValue.toString())} CARB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">系统手续费 (1%):</span>
                  <span className="font-medium text-red-600">-{formatFeeAmount(feeBreakdown.systemFee.toString())} CARB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">审计费用 (4%):</span>
                  <span className="font-medium text-red-600">-{formatFeeAmount(feeBreakdown.auditFee.toString())} CARB</span>
                </div>
                <hr className="border-blue-200" />
                <div className="flex justify-between font-semibold">
                  <span className="text-blue-800">实际到账:</span>
                  <span className="text-green-600">{formatFeeAmount(feeBreakdown.finalAmount.toString())} CARB</span>
                </div>
              </div>
            </div>

            {/* Audit opinion */}
            {exchangeRequest.auditComment && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-2">审计意见</h4>
                <p className="text-sm text-gray-700 italic">&ldquo;{exchangeRequest.auditComment}&rdquo;</p>
              </div>
            )}

            {/* Important reminder */}
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 mb-6 border border-red-200">
              <div className="text-sm text-red-700">
                <div className="font-semibold mb-2">⚠️ 重要提醒:</div>
                <ul className="space-y-1 text-xs">
                  <li>• 执行兑换后，NFT将被永久销毁，无法恢复</li>
                  <li>• 您将立即收到相应的CARB代币到您的钱包</li>
                  <li>• 此操作不可撤销，请确认您同意兑换</li>
                  {needsApproval ? (
                    <li className="text-red-800 font-semibold">• ⚠️ 您需要先授权NFT才能执行兑换</li>
                  ) : (
                    <li className="text-green-700 font-semibold">• ✅ NFT已授权，可以执行兑换</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                disabled={isPending || isConfirming}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={confirmExecuteExchange}
                disabled={isPending || isConfirming}
                className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50"
              >
                {isPending ? '准备中...' : isConfirming ? '执行中...' : '确认兑换'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 