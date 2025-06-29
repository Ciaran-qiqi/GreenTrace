import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, formatUnits, Address } from 'viem'
import toast from 'react-hot-toast'
import USDTABI from '@/contracts/abi/USDT.json'


/**
 * Token Authorization Hook
 * Handle authorization operations of ERC20 tokens, support CarbonToken and USDT
 * @param tokenAddress Token contract address
 * @param spenderAddress Authorized address (usually a market contract)
 */
export const useTokenApproval = (tokenAddress: string, spenderAddress: string) => {
  const { address: userAddress } = useAccount()
  const { writeContract, data: hash, isPending: isWritePending, error: writeError } = useWriteContract()
  
  // Wait for transaction confirmation

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // Select abi according to the token address

  const getTokenABI = useCallback(() => {
    // Here you can determine which ABI to use based on the token address
    // USDT ABI is used for the time being, because they are all ERC20 standards

    return USDTABI.abi
  }, [])

  // Read user token balance

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: tokenAddress as Address,
    abi: getTokenABI(),
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress }
  })

  // Read authorization amount

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as Address,
    abi: getTokenABI(),
    functionName: 'allowance',
    args: userAddress && spenderAddress ? [userAddress, spenderAddress as Address] : undefined,
    query: { enabled: !!userAddress && !!spenderAddress }
  })

  /**
   * Check if authorization is required
   * @param amount Number of authorizations required (string format)
   * @param decimals Token accuracy
   * @returns Is authorization required
   */
  const checkApprovalNeeded = useCallback((amount: string, decimals = 18): boolean => {
    if (!amount) return false
    
    // If allowance is undefined or null, it means that there is no authorization yet and authorization is required

    if (!allowance) return true
    
    const amountWei = parseUnits(amount, decimals)
    const currentAllowance = allowance as bigint
    
    // Check if it is unlimited authorization

    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    if (currentAllowance >= maxUint256) {
      return false // Unlimited authorization, no further authorization is required

    }
    
    return amountWei > currentAllowance
  }, [allowance])

  /**
   * Get authorization details
   * @param amount Number of authorizations required (string format)
   * @param decimals Token accuracy
   * @returns Authorization details object
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
    
    // Check if it is unlimited authorization

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
   * Authorized specified quantity
   * @param amount Number of authorizations (string format)
   * @param decimals Token accuracy
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
   * Maximum number of authorizations (usually used to simplify user operations)
   */
  const approveMax = useCallback(async () => {
    if (!userAddress || !tokenAddress || !spenderAddress) {
      toast.error('请先连接钱包')
      return
    }

    try {
      // Use the maximum uint256 value as the authorization amount

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

  // Listen to transaction confirmation

  const [isApprovalConfirmed, setIsApprovalConfirmed] = useState(false)
  
  useEffect(() => {
    if (isConfirmed) {
      setIsApprovalConfirmed(true)
      toast.success('授权成功！')
      
      // Refresh balance and authorization amount

      setTimeout(() => {
        refetchBalance()
        refetchAllowance()
        setIsApprovalConfirmed(false)
      }, 2000)
    }
  }, [isConfirmed, refetchBalance, refetchAllowance])

  // Listening to transaction errors

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
    // state

    isWritePending,
    isConfirming,
    isConfirmed: isApprovalConfirmed,
    writeError,
    
    // data

    balance: balance ? formatUnits(balance as bigint, 18) : '0',
    balanceRaw: (balance as bigint) || BigInt(0),
    allowance: allowance ? (() => {
      const allowanceBigInt = allowance as bigint;
      // Check if it is the maximum uint256 value (unlimited authorization)

      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      if (allowanceBigInt >= maxUint256) {
        return '充足';
      }
      return formatUnits(allowanceBigInt, 18);
    })() : '0',
    allowanceRaw: (allowance as bigint) || BigInt(0),
    
    // method

    checkApprovalNeeded,
    getApprovalDetails,
    approve,
    approveMax,
    refetchBalance,
    refetchAllowance,
  }
} 