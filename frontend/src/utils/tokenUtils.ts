import { formatEther, parseEther } from 'viem';

/**
 * Token precision conversion utilities
 * Handle conversion between frontend display format (with decimals) and blockchain storage format (Wei, 18 decimals)
 */

/**
 * Convert Wei format token amount to user-friendly display format
 * @param weiAmount - Amount in Wei (bigint or string)
 * @param decimals - Number of decimals, default is 2
 * @returns Formatted string, e.g. "1.50"
 */
export function formatTokenAmount(weiAmount: bigint | string | undefined, decimals: number = 2): string {
  if (!weiAmount) return '0.00';
  
  try {
    const value = BigInt(weiAmount);
    const etherValue = formatEther(value);
    const numValue = parseFloat(etherValue);
    return numValue.toFixed(decimals);
  } catch (error) {
    console.warn('Failed to format token amount:', error);
    return '0.00';
  }
}

/**
 * Convert user input token amount to Wei format
 * @param userAmount - User input amount (string or number), e.g. "1.50" or 1.5
 * @returns Amount in Wei as bigint
 */
export function parseTokenAmount(userAmount: string | number): bigint {
  try {
    const stringAmount = typeof userAmount === 'number' ? userAmount.toString() : userAmount;
    return parseEther(stringAmount);
  } catch (error) {
    console.warn('Failed to parse token amount:', error);
    return BigInt(0);
  }
}

/**
 * Validate if user input token amount format is correct
 * @param amount - User input amount string
 * @returns Whether the format is valid
 */
export function isValidTokenAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') return false;
  
  // Check if it is a valid number format
  const regex = /^\d+(\.\d{1,18})?$/;
  if (!regex.test(amount.trim())) return false;
  
  try {
    const numValue = parseFloat(amount);
    return numValue >= 0 && numValue < Number.MAX_SAFE_INTEGER;
  } catch {
    return false;
  }
}

/**
 * Safely convert a string that may contain decimals to BigInt
 * @param amount - String that may contain decimals
 * @returns Amount in Wei as bigint
 */
export function safeParseToBigInt(amount: string | undefined): bigint {
  if (!amount) return BigInt(0);
  
  try {
    // If the string contains a decimal point, use parseEther
    if (amount.includes('.')) {
      return parseEther(amount);
    }
    // If it is an integer string, convert directly
    return BigInt(amount);
  } catch (error) {
    console.warn('Safe BigInt conversion failed:', error);
    return BigInt(0);
  }
}

/**
 * Format fee display (specifically for fee fields)
 * @param feeAmount - Fee amount (may be a Wei string or already formatted string)
 * @returns Formatted fee string
 */
export function formatFeeAmount(feeAmount: string | undefined): string {
  if (!feeAmount) return '0.00';
  
  // If already a formatted string (contains decimal and is short), return directly
  if (feeAmount.includes('.') && feeAmount.length < 10) {
    return feeAmount;
  }
  
  // Otherwise treat as Wei format
  try {
    return formatTokenAmount(feeAmount, 2);
  } catch {
    return feeAmount; // If conversion fails, return original value
  }
} 