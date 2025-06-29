/**
 * Formatting utility functions
 * Used for display formatting of numbers, prices, percentages, etc.
 */

// Format numbers, support K/M/B units
export const formatNumber = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K'
  
  return num.toFixed(decimals)
}

// Format price (USD)
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

// Format percentage
export const formatPercentage = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0%'
  
  return (num * 100).toFixed(decimals) + '%'
}

// Format token amount (general version, large values use K/M/B format)
export const formatTokenAmount = (value: string | number, decimals = 6): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  if (num >= 1e6) return formatNumber(num, 2)
  return num.toFixed(decimals)
}

// Format balance display (keep full value + thousands separator)
export const formatBalance = (value: string | number, decimals = 2): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0.00'
  
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })
}

// Shorten address display
export const shortenAddress = (address: string, startLength = 6, endLength = 4): string => {
  if (!address || address.length < startLength + endLength) return address
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
}

// Validate number input
export const validateNumberInput = (value: string): boolean => {
  if (!value || value.trim() === '') return false
  const num = parseFloat(value)
  return !isNaN(num) && num > 0
}

// Calculate slippage
export const calculateSlippage = (inputAmount: string, outputAmount: string, slippageTolerance = 0.005): string => {
  const input = parseFloat(inputAmount)
  const output = parseFloat(outputAmount)
  
  if (isNaN(input) || isNaN(output) || input === 0) return '0'
  
  const slippage = Math.abs((input - output) / input)
  return formatPercentage(slippage)
}

// Debounce function
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