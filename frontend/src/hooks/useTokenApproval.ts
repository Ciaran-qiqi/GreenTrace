import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import toast from 'react-hot-toast'

// 标准ERC20 ABI用于授权操作
const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
  }
]

interface UseTokenApprovalProps {
  tokenAddress?: string
  spenderAddress?: string
}

export const useTokenApproval = ({ tokenAddress, spenderAddress }: UseTokenApprovalProps) => {
  const { address } = useAccount()
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  const [isApproving, setIsApproving] = useState(false)

  // 读取当前授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: {
      enabled: !!address && !!tokenAddress && !!spenderAddress,
    },
  })

  // 检查是否需要授权
  const checkApprovalNeeded = useCallback((amount: string, decimals: number = 18): boolean => {
    if (!allowance) return true
    
    try {
      const requiredAmount = parseUnits(amount, decimals)
      const currentAllowance = allowance as bigint
      return currentAllowance < requiredAmount
    } catch {
      return true
    }
  }, [allowance])

  // 执行授权
  const approve = useCallback(async (amount: string, decimals: number = 18): Promise<boolean> => {
    if (!address || !tokenAddress || !spenderAddress) {
      toast.error('缺少必要的地址信息')
      return false
    }

    try {
      setIsApproving(true)
      const approveAmount = parseUnits(amount, decimals)
      
      toast.loading('正在请求代币授权...')
      
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, approveAmount],
      })

      return true
    } catch (error) {
      console.error('授权失败:', error)
      toast.error('授权失败')
      setIsApproving(false)
      return false
    }
  }, [address, tokenAddress, spenderAddress, writeContract])

  // 授权最大额度（避免重复授权）
  const approveMax = useCallback(async (): Promise<boolean> => {
    if (!address || !tokenAddress || !spenderAddress) {
      toast.error('缺少必要的地址信息')
      return false
    }

    try {
      setIsApproving(true)
      // 使用最大uint256值进行授权
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      
      toast.loading('正在授权最大额度...')
      
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, maxAmount],
      })

      return true
    } catch (error) {
      console.error('最大授权失败:', error)
      toast.error('授权失败')
      setIsApproving(false)
      return false
    }
  }, [address, tokenAddress, spenderAddress, writeContract])

  // 监听授权完成
  useEffect(() => {
    if (isConfirmed && isApproving) {
      setIsApproving(false)
      toast.success('代币授权成功！')
      refetchAllowance()
    }
  }, [isConfirmed, isApproving, refetchAllowance])

  // 获取授权详情（用于调试）
  const getApprovalDetails = useCallback((amount: string, decimals: number = 18) => {
    const requiredAmount = parseUnits(amount, decimals)
    const currentAllowance = allowance as bigint || BigInt(0)
    
    return {
      required: requiredAmount.toString(),
      current: currentAllowance.toString(),
      isEnough: currentAllowance >= requiredAmount,
      requiredFormatted: amount,
      currentFormatted: formatUnits(currentAllowance, decimals),
    }
  }, [allowance])

  return {
    // 数据
    allowance,
    currentAllowance: allowance ? formatUnits(allowance as bigint, 18) : '0',
    
    // 状态
    isApproving: isPending || isConfirming || isApproving,
    isApprovalConfirmed: isConfirmed,
    
    // 函数
    checkApprovalNeeded,
    approve,
    approveMax,
    refetchAllowance,
    getApprovalDetails,
  }
} 