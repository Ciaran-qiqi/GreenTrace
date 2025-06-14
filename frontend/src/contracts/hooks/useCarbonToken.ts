import { useContractRead, useContractWrite, useWaitForTransaction } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../addresses';
import CarbonTokenABI from '../abis/CarbonToken.json';

export const useCarbonToken = () => {
  // 读取余额
  const { data: balance, isError: isBalanceError, isLoading: isBalanceLoading } = useContractRead({
    address: CONTRACT_ADDRESSES.foundry.CarbonToken as `0x${string}`,
    abi: CarbonTokenABI,
    functionName: 'balanceOf',
  });

  // 转账
  const { data: transferData, write: transfer } = useContractWrite({
    address: CONTRACT_ADDRESSES.foundry.CarbonToken as `0x${string}`,
    abi: CarbonTokenABI,
    functionName: 'transfer',
  });

  // 等待交易确认
  const { isLoading: isTransferLoading, isSuccess: isTransferSuccess } = useWaitForTransaction({
    hash: transferData?.hash,
  });

  return {
    balance,
    isBalanceError,
    isBalanceLoading,
    transfer,
    isTransferLoading,
    isTransferSuccess,
  };
}; 