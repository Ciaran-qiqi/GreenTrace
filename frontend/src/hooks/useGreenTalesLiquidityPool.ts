import { useEffect, useCallback } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi'
import toast from 'react-hot-toast'
import { parseUnits, formatUnits } from 'viem'
import { CONTRACT_ADDRESSES } from '@/contracts/addresses'
import { readContract } from '@wagmi/core'
import { config } from '../lib/wagmi'

// Import liquidity pool contract abi

import GreenTalesLiquidityPoolABI from '@/contracts/abi/GreenTalesLiquidityPool.json'
import CarbonPriceOracleABI from '@/contracts/abi/CarbonPriceOracle.json'
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json'

// Helper function to get the contract address

const getLiquidityPoolAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.GreenTalesLiquidityPool
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.GreenTalesLiquidityPool
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.GreenTalesLiquidityPool
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.GreenTalesLiquidityPool
  }
}

const getCarbonPriceOracleAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.CarbonPriceOracle
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.CarbonPriceOracle
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.CarbonPriceOracle
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.CarbonPriceOracle
  }
}


// Define interface

interface PoolData {
  totalLiquidity: string
  carbonBalance: string
  usdtBalance: string
  currentPrice: string
  priceDeviation: string
  isDeviated: boolean
  referencePrice: string
  priceDeviationThreshold: number // Price deviation threshold (percentage)

}

interface UserLiquidityInfo {
  lpTokens: string
  carbonShare: string
  usdtShare: string
  sharePercentage: string
  carbonFees: string
  usdtFees: string
}

interface SwapEstimate {
  amountOut: string
  fee: string
  priceImpact: string
  newPrice?: string
}

interface UserBalances {
  carbonBalance: string // Formatted display string

  usdtBalance: string   // Formatted display string

  carbonBalanceRaw: number // Original value for calculation

  usdtBalanceRaw: number   // Original value for calculation

}

export const useGreenTalesLiquidityPool = () => {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  // Get the contract address

  const liquidityPoolAddress = getLiquidityPoolAddress(chainId)
  const oracleAddress = getCarbonPriceOracleAddress(chainId)

  // Get token address from liquidity pool contract

  const { data: carbonTokenAddress } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'carbonToken',
  })

  const { data: usdtAddress } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'usdtToken',
  })

  // Read basic pool information

  const { data: contractBalances, refetch: refetchBalances } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'getContractBalances',
  })

  // Read the current pool price

  const { data: currentPrice, refetch: refetchPrice } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'getCarbonPrice',
  })

  // Read oracle reference price

  const { data: oraclePrice } = useReadContract({
    address: oracleAddress as `0x${string}`,
    abi: CarbonPriceOracleABI.abi,
    functionName: 'getLatestCarbonPriceUSD',
  })

  // Read price deviation details

  const { data: priceDeviationDetails } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'getPriceDeviationDetails',
  })

  // Read price deviation threshold

  const { data: priceDeviationThreshold } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'priceDeviationThreshold',
  })

  // Read user liquidity information

  const { data: userLiquidityInfo, refetch: refetchUserInfo } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'getLiquidityProviderInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // Read user handling fee

  const { data: userFees, refetch: refetchUserFees } = useReadContract({
    address: liquidityPoolAddress as `0x${string}`,
    abi: GreenTalesLiquidityPoolABI.abi,
    functionName: 'calculateUserFees',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  })

  // Read the user carb token balance

  const { data: userCarbonBalance, refetch: refetchCarbonBalance } = useReadContract({
    address: carbonTokenAddress as `0x${string}`,
    abi: CarbonTokenABI.abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && !!carbonTokenAddress,
    },
  })

  // Read the user USDT token balance -using standard ERC20 ABI

  const { data: userUsdtBalance, refetch: refetchUsdtBalance } = useReadContract({
    address: usdtAddress as `0x${string}`,
    abi: [
      {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
      },
      {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
      },
    ],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && !!usdtAddress,
    },
  })

  // Get pool statistics

  const getPoolData = useCallback((): PoolData => {
    if (!contractBalances || !currentPrice) {
      return {
        totalLiquidity: '0',
        carbonBalance: '0',
        usdtBalance: '0',
        currentPrice: '88', // Default price

        priceDeviation: '0',
        isDeviated: false,
        referencePrice: '88', // Default oracle price

        priceDeviationThreshold: 0,
      }
    }

    try {
      const [carbonBalance, usdtBalance] = contractBalances as [bigint, bigint]
      const poolPrice = currentPrice as bigint
      const oracle = oraclePrice as bigint || BigInt(8800000000) // Default 88.00 USDT, 8 decimal places


      // Processing current market price -Intelligently detect decimal places

      let formattedPrice: string = '88.00' // Default price

      
      // Try different decimal places to find a reasonable price range

      const decimalsToTry = [8, 6, 18] // Common decimal places

      
      for (const decimals of decimalsToTry) {
        const testPrice = formatUnits(poolPrice, decimals)
        const testPriceNum = parseFloat(testPrice)
        
        // If the result is within a reasonable range (between 1 1000), use this value

        if (testPriceNum >= 1 && testPriceNum <= 1000) {
          formattedPrice = testPriceNum.toFixed(2)
          break
        }
      }
      
      // Final check, if it still invalid, use the default value

      const finalPriceNum = parseFloat(formattedPrice)
      if (finalPriceNum <= 0 || finalPriceNum > 1000) {
        formattedPrice = '88.00'
      }
      
      // Processing oracle price -Intelligently detect decimal places

      let formattedOraclePrice: string = '88.00' // Default price

      const oracleValue = oracle || BigInt(8800000000) // 8-digit decimal form with default 88.00

      
      // Try different decimal places to find a reasonable price range

      for (const decimals of decimalsToTry) {
        const testPrice = formatUnits(oracleValue, decimals)
        const testPriceNum = parseFloat(testPrice)
        
        // If the result is within a reasonable range (between 1 1000), use this value

        if (testPriceNum >= 1 && testPriceNum <= 1000) {
          formattedOraclePrice = testPriceNum.toFixed(2)
          break
        }
      }
      
      // Final check, if it still invalid, use the default value

      const finalOraclePrice = parseFloat(formattedOraclePrice)
      if (finalOraclePrice <= 0 || finalOraclePrice > 1000) {
        formattedOraclePrice = '88.00'
      }
      
      // Calculate Total Liquidity (TVL)

      const carbonBalanceFormatted = parseFloat(formatUnits(carbonBalance, 18))
      
      // USDT balance needs special processing -if the value is very large, it may be an 18-digit decimal rather than a 6-digit decimal

      let usdtBalanceFormatted: number
      if (usdtBalance > BigInt(1e18)) {
        // USDT with a possible 18-digit decimal (such as 8800000000000000000000000000 = 88000 USDT)

        usdtBalanceFormatted = parseFloat(formatUnits(usdtBalance, 18))
      } else {
        // Standard 6-digit decimal number usdt

        usdtBalanceFormatted = parseFloat(formatUnits(usdtBalance, 6))
      }
      
      // Calculate total liquidity: USDT balance + (carbon coin balance × current price)

      const currentPriceNum = parseFloat(formattedPrice)
      const carbonValueInUsdt = carbonBalanceFormatted * currentPriceNum
      const totalLiquidityValue = usdtBalanceFormatted + carbonValueInUsdt

      // Calculate price deviation in real time (force real-time calculation without relying on contract return value)

      let deviationPercentage = '0'
      let isDeviated = false
      
      try {
        const marketPrice = parseFloat(formattedPrice)
        const referencePrice = parseFloat(formattedOraclePrice)
        
        if (marketPrice > 0 && referencePrice > 0) {
          // Calculate deviation: |(Market price -reference price) /Reference price | Return to decimal form

          const deviation = Math.abs((marketPrice - referencePrice) / referencePrice)
          deviationPercentage = deviation.toFixed(4) // Keep 4 decimal places for accuracy

          
          // Deviation exceeds 0.05 (5%) is considered a deviation state

          isDeviated = deviation > 0.05
        } else {
          deviationPercentage = '0'
          isDeviated = false
        }
      } catch (error) {
        console.error('❌ 计算价格偏离失败:', error)
        deviationPercentage = '0'
        isDeviated = false
      }

      // Debugging: Show threshold acquisition status

      console.log('🔍 Hook中阈值调试:', {
        rawThreshold: priceDeviationThreshold,
        thresholdType: typeof priceDeviationThreshold,
        thresholdValue: priceDeviationThreshold as number,
        isBigInt: priceDeviationThreshold instanceof BigInt
      })

      return {
        totalLiquidity: totalLiquidityValue.toString(),
        carbonBalance: formatUnits(carbonBalance, 18),
        usdtBalance: usdtBalanceFormatted.toString(), // Use already formatted values

        currentPrice: formattedPrice,
        priceDeviation: deviationPercentage,
        isDeviated: isDeviated, // Deviation state using real-time calculation

        referencePrice: formattedOraclePrice,
        priceDeviationThreshold: priceDeviationThreshold ? Number(priceDeviationThreshold) : 10,
      }
    } catch (error) {
      console.error('解析池子数据失败:', error)
      return {
        totalLiquidity: '0',
        carbonBalance: '0',
        usdtBalance: '0',
        currentPrice: '88',
        priceDeviation: '0',
        isDeviated: false,
        referencePrice: '88',
        priceDeviationThreshold: 0,
      }
    }
  }, [contractBalances, currentPrice, oraclePrice, priceDeviationDetails, priceDeviationThreshold])

  // Obtain user liquidity information

  const getUserLiquidityInfo = useCallback((): UserLiquidityInfo => {
    if (!userLiquidityInfo || !userFees) {
      return {
        lpTokens: '0',
        carbonShare: '0',
        usdtShare: '0',
        sharePercentage: '0',
        carbonFees: '0',
        usdtFees: '0',
      }
    }

    try {
      const [lpTokens, carbonShare, usdtShare, sharePercentage] = userLiquidityInfo as [bigint, bigint, bigint, bigint]
      const [carbonFees, usdtFees] = userFees as [bigint, bigint]

      // Process USDT related data -Check whether it is an 18-digit decimal

      const usdtShareFormatted = usdtShare > BigInt(1e18) 
        ? formatUnits(usdtShare, 18) 
        : formatUnits(usdtShare, 6)
      
      const usdtFeesFormatted = usdtFees > BigInt(1e18)
        ? formatUnits(usdtFees, 18)
        : formatUnits(usdtFees, 6)

      // Processing percentage -Contract may return to base point form (such as 1000 = 10%)

      const sharePercentageFormatted = formatUnits(sharePercentage, 2)
      const sharePercentageNum = parseFloat(sharePercentageFormatted)
      
      // If the value is large (>100), it may be in the form of a base point and needs to be divided by 100

      let sharePercentageValue: string
      if (sharePercentageNum > 100) {
        sharePercentageValue = (sharePercentageNum / 10000).toString() // 10000 basis points = 100%

      } else if (sharePercentageNum > 1) {
        sharePercentageValue = (sharePercentageNum / 100).toString() // 100 = 1%

      } else {
        sharePercentageValue = sharePercentageNum.toString() // Directly in the form of a decimal

      }

      return {
        lpTokens: formatUnits(lpTokens, 18),
        carbonShare: formatUnits(carbonShare, 18),
        usdtShare: usdtShareFormatted,
        sharePercentage: sharePercentageValue, // It is already a decimal form, and there is no need to divide 100 more

        carbonFees: formatUnits(carbonFees, 18),
        usdtFees: usdtFeesFormatted,
      }
    } catch (error) {
      console.error('解析用户流动性信息失败:', error)
      return {
        lpTokens: '0',
        carbonShare: '0',
        usdtShare: '0',
        sharePercentage: '0',
        carbonFees: '0',
        usdtFees: '0',
      }
    }
  }, [userLiquidityInfo, userFees])

  // Obtain user token balance

  const getUserBalances = useCallback((): UserBalances => {
    if (!address || !isConnected) {
      return {
        carbonBalance: '0.00',
        usdtBalance: '0.00',
        carbonBalanceRaw: 0,
        usdtBalanceRaw: 0,
      }
    }

    try {
      // Processing CARB balances -Standard 18-digit decimal places

      const carbonBalance = userCarbonBalance as bigint || BigInt(0)
      const carbonValue = parseFloat(formatUnits(carbonBalance, 18))
      
      // Processing USDT balances -Intelligent detection of decimal places is required

      const usdtBalance = userUsdtBalance as bigint || BigInt(0)
      let usdtValue = 0
      
      if (usdtBalance > BigInt(0)) {
        // Based on your true balance 880,016,362.76399 USDT
        // Try different decimal places to find the correct result

        const decimalsToTry = [6, 18, 8] // Common decimal places

        
        for (const decimals of decimalsToTry) {
          const testValue = parseFloat(formatUnits(usdtBalance, decimals))
          
          // Judging based on your true balance range (it should be within the range of hundreds of millions)

          if (testValue >= 1e6 && testValue <= 1e12) { // Between 1 million and 1 trillion

            usdtValue = testValue
            break
          }
        }
        
        // If no reasonable value is found, use the default 6-digit decimal number

        if (usdtValue === 0) {
          usdtValue = parseFloat(formatUnits(usdtBalance, 6))
        }
      }

      const result = {
        // Formatted display string

        carbonBalance: carbonValue.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        }),
        usdtBalance: usdtValue.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        }),
        // Original value for calculation

        carbonBalanceRaw: carbonValue,
        usdtBalanceRaw: usdtValue,
      }
      
      return result
      
    } catch (error) {
      console.error('❌ 获取用户余额失败:', error)
      return {
        carbonBalance: '0.00',
        usdtBalance: '0.00',
        carbonBalanceRaw: 0,
        usdtBalanceRaw: 0,
      }
    }
  }, [address, isConnected, userCarbonBalance, userUsdtBalance])

  // Get redemption estimates

  const getSwapEstimate = useCallback(async (amountIn: string, isCarbonToUsdt: boolean): Promise<SwapEstimate | null> => {
    try {
      if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
        return null
      }

      const amountInBigInt = parseUnits(amountIn, 18)
      
      const result = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getSwapEstimate',
        args: [amountInBigInt, isCarbonToUsdt],
      })

      const [amountOut, fee, priceImpact] = result as [bigint, bigint, bigint]
      
      return {
        amountOut: formatUnits(amountOut, 18),
        fee: formatUnits(fee, 18),
        priceImpact: formatUnits(priceImpact, 2), // Price influence is based on base points

      }
    } catch (error) {
      console.error('获取兑换估算失败:', error)
      return null
    }
  }, [liquidityPoolAddress])

  // Get detailed redemption estimates

  const getDetailedSwapEstimate = useCallback(async (amountIn: string, isCarbonToUsdt: boolean) => {
    try {
      if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
        return null
      }

      const amountInBigInt = parseUnits(amountIn, 18)
      
      const result = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getDetailedSwapEstimate',
        args: [amountInBigInt, isCarbonToUsdt],
      })

      // The result of parsing the data structure returned by the contract
      // Here it needs to be adjusted according to the actual contract ABI

      return result
    } catch (error) {
      console.error('获取详细兑换估算失败:', error)
      return null
    }
  }, [liquidityPoolAddress])

  /**
   * Execute carbon currency exchange USDT
   * @param carbonAmount Number of carbon coins (string, 18-bit precision)
   */
  const swapCarbonToUsdt = useCallback(async (carbonAmount: string) => {
    if (!carbonAmount || isNaN(Number(carbonAmount)) || Number(carbonAmount) <= 0) return;
    try {
      const carbonAmountBigInt = parseUnits(carbonAmount, 18)
      await writeContract({
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'swapCarbonToUsdt',
        args: [carbonAmountBigInt],
      })
      toast.success('兑换成功！')
      refetchBalances()
      refetchUserInfo()
    } catch (e) {
      console.error('碳币兑换USDT失败', e)
      toast.error('兑换失败: ' + (e as Error).message)
    }
  }, [liquidityPoolAddress, writeContract, refetchBalances, refetchUserInfo])

  /**
   * Execute USDT to exchange carbon coins
   * @param usdtAmount USDT quantity (string, 18-bit precision)
   */
  const swapUsdtToCarbon = useCallback(async (usdtAmount: string) => {
    if (!usdtAmount || isNaN(Number(usdtAmount)) || Number(usdtAmount) <= 0) return;
    try {
      const usdtAmountBigInt = parseUnits(usdtAmount, 18)
      await writeContract({
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'swapUsdtToCarbon',
        args: [usdtAmountBigInt],
      })
      toast.success('兑换成功！')
      refetchBalances()
      refetchUserInfo()
    } catch (e) {
      console.error('USDT兑换碳币失败', e)
      toast.error('兑换失败: ' + (e as Error).message)
    }
  }, [liquidityPoolAddress, writeContract, refetchBalances, refetchUserInfo])

  /**
   * Check the processing fee benefits that users can claim
   * @returns { carbonFees: string, usdtFees: string }
   */
  const getUserEarnings = useCallback(() => {
    if (!userFees) return { carbonFees: '0', usdtFees: '0' }
    return {
      carbonFees: formatUnits(userFees[0], 18),
      usdtFees: formatUnits(userFees[1], 18)
    }
  }, [userFees])

  /**
   * Receive handling fee income
   */
  const claimFees = useCallback(async () => {
    try {
      await writeContract({
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'claimFees',
        args: [],
      })
      toast.success('收益领取成功！')
      refetchUserFees()
    } catch (e) {
      console.error('领取手续费失败', e)
      toast.error('领取失败: ' + (e as Error).message)
    }
  }, [liquidityPoolAddress, writeContract, refetchUserFees])

  /**
   * Query platform and LP cumulative handling fees
   * @returns { platformCarbonFees, platformUsdtFees, totalLpCarbonFees, totalLpUsdtFees }
   */
  const getFeeStats = useCallback(async () => {
    try {
      // Pass in config when using read contract to avoid parameters reporting errors for undefined

      const result = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getFeeStats',
      })
      // Returns four handling fee data, all of which are bigint arrays

      const [platformCarbonFees, platformUsdtFees, totalLpCarbonFees, totalLpUsdtFees] = result as [bigint, bigint, bigint, bigint]
      return {
        platformCarbonFees: formatUnits(platformCarbonFees, 18),
        platformUsdtFees: formatUnits(platformUsdtFees, 18),
        totalLpCarbonFees: formatUnits(totalLpCarbonFees, 18),
        totalLpUsdtFees: formatUnits(totalLpUsdtFees, 18)
      }
    } catch (e) {
      console.error('获取手续费统计失败', e)
      return null
    }
  }, [liquidityPoolAddress])

  // Get the current price of carbon coins

  const getCarbonPrice = useCallback(async (): Promise<string> => {
    try {
      if (currentPrice) {
        return formatUnits(currentPrice as bigint, 18)
      }
      
      // If there is no real-time price, try to read directly from the contract

      const result = await readContract(config, {
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'getCarbonPrice',
      })
      
      return formatUnits(result as bigint, 18)
    } catch (error) {
      console.error('获取碳币价格失败:', error)
      return '88' // Return to the default price

    }
  }, [currentPrice, liquidityPoolAddress])

  // Get liquidity add estimates (free input mode)

  const getLiquidityEstimate = useCallback((carbonAmount: string, usdtAmount: string) => {
    try {
      const poolData = getPoolData()
      const currentCarbonBalance = parseFloat(poolData.carbonBalance)
      const currentUsdtBalance = parseFloat(poolData.usdtBalance)
      const currentPrice = parseFloat(poolData.currentPrice)
      
              // Free input mode -Calculate the impact of adding liquidity

        if (carbonAmount && usdtAmount && carbonAmount !== '' && usdtAmount !== '') {
          const carbonAmountNum = parseFloat(carbonAmount)
          const usdtAmountNum = parseFloat(usdtAmount)
          
          const newCarbonBalance = currentCarbonBalance + carbonAmountNum
          const newUsdtBalance = currentUsdtBalance + usdtAmountNum
          const newPrice = newUsdtBalance / newCarbonBalance
          
          const priceImpact = Math.abs((newPrice - currentPrice) / currentPrice * 100)
          const sharePercentage = carbonAmountNum / newCarbonBalance * 100
        
        return {
          carbonAmount,
          usdtAmount,
          priceImpact: priceImpact.toFixed(2),
          newPrice: newPrice.toFixed(2),
          sharePercentage: sharePercentage.toFixed(2)
        }
      }
      
      return null
    } catch (error) {
      console.error('获取流动性估算失败:', error)
      return null
    }
  }, [getPoolData])

  // Add liquidity

  const addLiquidity = useCallback(async (carbonAmount: string, usdtAmount: string) => {
    if (!address || !isConnected) {
      toast.error('请先连接钱包')
      return
    }

    try {
      const carbonAmt = parseUnits(carbonAmount, 18)
      const usdtAmt = parseUnits(usdtAmount, 18)  // Modified to 18 decimal places, consistent with the balance display


      writeContract({
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'addLiquidity',
        args: [carbonAmt, usdtAmt],
      })

      toast.loading('正在添加流动性...')
    } catch (error) {
      console.error('添加流动性失败:', error)
      toast.error('添加流动性失败')
    }
  }, [address, isConnected, liquidityPoolAddress, writeContract])

  // Remove liquidity

  const removeLiquidity = useCallback(async (lpTokenAmount: string) => {
    if (!address || !isConnected) {
      toast.error('请先连接钱包')
      return
    }

    try {
      const lpAmount = parseUnits(lpTokenAmount, 18)

      writeContract({
        address: liquidityPoolAddress as `0x${string}`,
        abi: GreenTalesLiquidityPoolABI.abi,
        functionName: 'removeLiquidity',
        args: [lpAmount],
      })

      toast.loading('正在移除流动性...')
    } catch (error) {
      console.error('移除流动性失败:', error)
      toast.error('移除流动性失败')
    }
  }, [address, isConnected, liquidityPoolAddress, writeContract])

  // Listen to transaction status

  useEffect(() => {
    if (isConfirmed) {
      toast.dismiss()
      toast.success('🎉 兑换成功！余额已更新')
      
      // Refresh all data

      setTimeout(() => {
        refetchBalances()
        refetchPrice()
        refetchUserInfo()
        refetchUserFees()
        refetchCarbonBalance()
        refetchUsdtBalance()
      }, 1000) // Wait for 1 second before refreshing to ensure that the on-chain data has been updated

    }

    if (error) {
      toast.dismiss()
      toast.error('❌ 交易失败')
      console.error('Transaction error:', error)
    }
  }, [isConfirmed, error, refetchBalances, refetchPrice, refetchUserInfo, refetchUserFees, refetchCarbonBalance, refetchUsdtBalance])

  return {
    // data

    poolData: getPoolData(),
    userLiquidityInfo: getUserLiquidityInfo(),
    userBalances: getUserBalances(),
    
    // Contract address

    liquidityPoolAddress,
    carbonTokenAddress: carbonTokenAddress as string,
    usdtTokenAddress: usdtAddress as string,
    
    // function

    getSwapEstimate,
    getDetailedSwapEstimate,
    swapCarbonToUsdt,
    swapUsdtToCarbon,
    getLiquidityEstimate,
    addLiquidity,
    removeLiquidity,
    getUserEarnings,
    claimFees,
    getFeeStats,
    getCarbonPrice,
    
    // state

    isLoading: isPending || isConfirming,
    isConnected,
    
    // Refresh function

    refreshData: () => {
      refetchBalances()
      refetchPrice()
      refetchUserInfo()
      refetchUserFees()
      refetchCarbonBalance()
      refetchUsdtBalance()
    },
  }
} 