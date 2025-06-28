import { formatEther, parseEther } from 'viem';

/**
 * 代币精度转换工具
 * 处理前端显示格式（带小数点）和区块链存储格式（Wei，18位精度）之间的转换
 */

/**
 * 将Wei格式的代币数量转换为用户友好的显示格式
 * @param weiAmount - Wei格式的数量（bigint或字符串）
 * @param decimals - 小数位数，默认2位
 * @returns 格式化的字符串，如 "1.50"
 */
export function formatTokenAmount(weiAmount: bigint | string | undefined, decimals: number = 2): string {
  if (!weiAmount) return '0.00';
  
  try {
    const value = BigInt(weiAmount);
    const etherValue = formatEther(value);
    const numValue = parseFloat(etherValue);
    return numValue.toFixed(decimals);
  } catch (error) {
    console.warn('格式化代币数量失败:', error);
    return '0.00';
  }
}

/**
 * 将用户输入的代币数量转换为Wei格式
 * @param userAmount - 用户输入的数量（字符串或数字），如 "1.50" 或 1.5
 * @returns Wei格式的bigint
 */
export function parseTokenAmount(userAmount: string | number): bigint {
  try {
    const stringAmount = typeof userAmount === 'number' ? userAmount.toString() : userAmount;
    return parseEther(stringAmount);
  } catch (error) {
    console.warn('解析代币数量失败:', error);
    return BigInt(0);
  }
}

/**
 * 验证用户输入的代币数量格式是否正确
 * @param amount - 用户输入的数量字符串
 * @returns 是否为有效格式
 */
export function isValidTokenAmount(amount: string): boolean {
  if (!amount || amount.trim() === '') return false;
  
  // 检查是否为有效数字格式
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
 * 安全地处理可能包含小数的字符串转换为BigInt
 * @param amount - 可能包含小数的字符串
 * @returns Wei格式的bigint
 */
export function safeParseToBigInt(amount: string | undefined): bigint {
  if (!amount) return BigInt(0);
  
  try {
    // 如果字符串包含小数点，使用parseEther
    if (amount.includes('.')) {
      return parseEther(amount);
    }
    // 如果是整数字符串，直接转换
    return BigInt(amount);
  } catch (error) {
    console.warn('安全转换BigInt失败:', error);
    return BigInt(0);
  }
}

/**
 * 格式化费用显示（专门用于费用字段）
 * @param feeAmount - 费用数量（可能是Wei格式的字符串或已格式化的字符串）
 * @returns 格式化的费用字符串
 */
export function formatFeeAmount(feeAmount: string | undefined): string {
  if (!feeAmount) return '0.00';
  
  // 如果已经是格式化的字符串（包含小数点且长度较短），直接返回
  if (feeAmount.includes('.') && feeAmount.length < 10) {
    return feeAmount;
  }
  
  // 否则按Wei格式处理
  try {
    return formatTokenAmount(feeAmount, 2);
  } catch {
    return feeAmount; // 如果转换失败，返回原值
  }
} 