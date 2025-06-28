/**
 * 格式化工具函数
 * 用于数字、价格、百分比等的显示格式化
 */

// 格式化数字，支持K/M/B单位
export const formatNumber = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K'
  
  return num.toFixed(decimals)
}

// 格式化价格（美元）
export const formatPrice = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$0.00'
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

// 格式化百分比
export const formatPercentage = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0%'
  
  return (num * 100).toFixed(decimals) + '%'
}

// 格式化代币数量（通用版本，大数值使用K/M/B格式）
export const formatTokenAmount = (value: string | number, decimals = 6): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  if (num >= 1e6) return formatNumber(num, 2)
  return num.toFixed(decimals)
}

// 格式化余额显示（保持完整数值+千分位分隔符）
export const formatBalance = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0.00'
  
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })
}

// 简化地址显示
export const shortenAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (!address || address.length < startLength + endLength) return address
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

// 验证数字输入
export const validateNumberInput = (value: string): boolean => {
  if (!value || value.trim() === '') return false
  const num = parseFloat(value)
  return !isNaN(num) && num > 0
}

// 计算滑点
export const calculateSlippage = (inputAmount: string, outputAmount: string, slippageTolerance = 0.005): string => {
  const input = parseFloat(inputAmount)
  const output = parseFloat(outputAmount)
  
  if (isNaN(input) || isNaN(output) || input === 0) return '0'
  
  const slippage = Math.abs((input - output) / input)
  return formatPercentage(slippage)
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
} 