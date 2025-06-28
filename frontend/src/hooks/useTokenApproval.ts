import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, Address } from 'viem'
import toast from 'react-hot-toast'
import USDTABI from '@/contracts/abi/USDT.json'


/**
 * 代币授权Hook
 * 处理ERC20代币的授权操作，支持CarbonToken和USDT
 * @param tokenAddress 代币合约地址
 * @param spenderAddress 被授权地址（通常是市场合约）
 */
export const useTokenApproval = (tokenAddress: string, spenderAddress: string) => {
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract()
  
  // 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // 根据代币地址选择ABI
  const getTokenABI = useCallback(() => {
    // 这里可以根据代币地址判断使用哪个ABI
    // 暂时都使用USDT ABI，因为都是ERC20标准
    return USDTABI.abi
  }, [])

  // 读取用户代币余额
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress as Address,
    abi: getTokenABI(),
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // 读取授权额度
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as Address,
    abi: getTokenABI(),
    functionName: 'allowance',
    args: userAddress && spenderAddress ? [userAddress, spenderAddress as Address] : undefined,
    query: { enabled: !!userAddress && !!spenderAddress }
  })

  /**
   * 检查是否需要授权
   * @param amount 需要授权的数量（字符串格式）
   * @param decimals 代币精度
   * @returns 是否需要授权
   */
  const checkApprovalNeeded = useCallback((amount: string, decimals = 18): boolean => {
    if (!amount) return false
    
    // 如果allowance为undefined或null，说明还没有授权，需要授权
    if (!allowance) return true
    
    const amountWei = parseUnits(amount, decimals)
    const currentAllowance = allowance as bigint
    
    // 检查是否为无限授权
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    if (currentAllowance >= maxUint256) {
      return false // 无限授权，不需要再授权
    }
    
    return amountWei > currentAllowance
  }, [allowance])

  /**
   * 获取授权详情
   * @param amount 需要授权的数量（字符串格式）
   * @param decimals 代币精度
   * @returns 授权详情对象
   */
  const getApprovalDetails = useCallback((amount: string, decimals = 18) => {
    if (!amount) {
      return {
        needsApproval: false,
        currentAllowance: '0',
        requiredAmount: '0',
        userBalance: '0',
        canApprove: false
      }
    }
    
    const amountWei = parseUnits(amount, decimals)
    const currentAllowance = (allowance as bigint) || BigInt(0)
    const userBalance = (balance as bigint) || BigInt(0)
    
    // 检查是否为无限授权
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const isInfiniteAllowance = currentAllowance >= maxUint256
    
    return {
      needsApproval: !isInfiniteAllowance && amountWei > currentAllowance,
      currentAllowance: isInfiniteAllowance ? '充足' : formatUnits(currentAllowance, decimals),
      requiredAmount: amount,
      userBalance: formatUnits(userBalance, decimals),
      canApprove: userBalance >= amountWei
    }
  }, [allowance, balance])

  /**
   * 授权指定数量
   * @param amount 授权数量（字符串格式）
   * @param decimals 代币精度
   */
  const approve = useCallback(async (amount: string, decimals = 18) => {
    if (!userAddress || !tokenAddress || !spenderAddress) {
      toast.error('请先连接钱包')
      return
    }

    try {
      const amountWei = parseUnits(amount, decimals)
      
      writeContract({
        address: tokenAddress as Address,
        abi: getTokenABI(),
        functionName: 'approve',
        args: [spenderAddress as Address, amountWei],
      })
      
      toast.success('授权交易已提交，等待确认...')
    } catch (error) {
      console.error('Approve failed:', error)
      toast.error('授权失败，请重试')
    }
  }, [userAddress, tokenAddress, spenderAddress, writeContract, getTokenABI])

  /**
   * 授权最大数量（通常用于简化用户操作）
   */
  const approveMax = useCallback(async () => {
    if (!userAddress || !tokenAddress || !spenderAddress) {
      toast.error('请先连接钱包')
      return
    }

    try {
      // 使用最大uint256值作为授权额度
      const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      
      writeContract({
        address: tokenAddress as Address,
        abi: getTokenABI(),
        functionName: 'approve',
        args: [spenderAddress as Address, maxAmount],
      })
      
      toast.success('最大授权已提交，等待确认...')
    } catch (error) {
      console.error('Approve max failed:', error)
      toast.error('授权失败，请重试')
    }
  }, [userAddress, tokenAddress, spenderAddress, writeContract, getTokenABI])

  // 监听交易确认
  const [isApprovalConfirmed, setIsApprovalConfirmed] = useState(false)
  
  useEffect(() => {
    if (isConfirmed) {
      setIsApprovalConfirmed(true)
      toast.success('授权成功！')
      
      // 刷新余额和授权额度
      setTimeout(() => {
        refetchBalance()
        refetchAllowance()
        setIsApprovalConfirmed(false)
      }, 2000)
    }
  }, [isConfirmed, refetchBalance, refetchAllowance])

  // 监听交易错误
  useEffect(() => {
    if (writeError) {
      console.error('Approval error:', writeError)
      
      let errorMessage = '授权失败'
      
      if (writeError.message.includes('User rejected')) {
        errorMessage = '用户取消了授权'
      } else if (writeError.message.includes('insufficient funds')) {
        errorMessage = 'Gas费用不足，请检查ETH余额'
      } else if (writeError.message.includes('replacement underpriced')) {
        errorMessage = '交易费用过低，请提高Gas费用后重试'
      } else {
        errorMessage = `授权失败: ${writeError.message}`
      }
      
      toast.error(errorMessage, { duration: 5000 })
    }
  }, [writeError])

  return {
    // 状态
    isWritePending,
    isConfirming,
    isConfirmed: isApprovalConfirmed,
    writeError,
    
    // 数据
    balance: balance ? formatUnits(balance as bigint, 18) : '0',
    balanceRaw: (balance as bigint) || BigInt(0),
    allowance: allowance ? (() => {
      const allowanceBigInt = allowance as bigint;
      // 检查是否为最大uint256值（无限授权）
      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      if (allowanceBigInt >= maxUint256) {
        return '充足';
      }
      return formatUnits(allowanceBigInt, 18);
    })() : '0',
    allowanceRaw: (allowance as bigint) || BigInt(0),
    
    // 方法
    checkApprovalNeeded,
    getApprovalDetails,
    approve,
    approveMax,
    refetchBalance,
    refetchAllowance,
  }
} 