import { formatEther } from 'viem';

/**
 * 格式化工具函数
 * 专门处理从智能合约获取的数据格式化
 */

/**
 * 格式化碳减排量
 * @description 智能合约中碳减排量以Wei格式存储（18位小数），表示tCO₂e（吨二氧化碳当量）
 * @param carbonReductionStr - 碳减排量字符串（Wei格式，表示tCO₂e）
 * @returns 格式化后的碳减排量，如 "2.5tCO₂e" 或 "0.1tCO₂e"
 */
export function formatCarbonReduction(carbonReductionStr: string): string {
  if (!carbonReductionStr || carbonReductionStr === '0') {
    return '0tCO₂e';
  }

  try {
    // 将字符串转换为BigInt然后格式化
    const carbonReductionBigInt = BigInt(carbonReductionStr);
    const tCO2e = parseFloat(formatEther(carbonReductionBigInt));
    
    if (isNaN(tCO2e) || tCO2e <= 0) {
      return '0tCO₂e';
    }

    // 根据数值大小选择合适的小数位数
    if (tCO2e < 0.01) {
      // 小于0.01，显示更多小数位
      return `${tCO2e.toFixed(4)}tCO₂e`;
    } else if (tCO2e < 1) {
      // 小于1，显示2位小数
      return `${tCO2e.toFixed(2)}tCO₂e`;
    } else if (tCO2e < 1000) {
      // 1-1000，显示1位小数
      return `${tCO2e.toFixed(1)}tCO₂e`;
    } else {
      // 大于1000，显示整数
      return `${Math.round(tCO2e).toLocaleString()}tCO₂e`;
    }
  } catch (error) {
    console.error('格式化碳减排量失败:', error, { carbonReductionStr });
    return '数据格式错误';
  }
}

/**
 * 格式化智能合约时间戳
 * @description 处理智能合约返回的时间戳，转换为相对时间显示
 * @param timestampStr - 时间戳字符串或BigInt（秒）
 * @returns 相对时间字符串，如 "3分钟前"
 */
export function formatContractTimestamp(timestampStr: string | number | bigint): string {
  if (!timestampStr) {
    return '未知时间';
  }

  try {
    // 处理BigInt类型的时间戳
    let timestamp: number;
    if (typeof timestampStr === 'bigint') {
      timestamp = Number(timestampStr);
    } else if (typeof timestampStr === 'string') {
      timestamp = parseInt(timestampStr);
    } else {
      timestamp = timestampStr;
    }
    
    if (isNaN(timestamp) || timestamp <= 0) {
      return '未知时间';
    }

    // 转换为毫秒
    const timestampMs = timestamp * 1000;
    const now = Date.now();
    const diffMs = now - timestampMs;

    // 如果时间戳在未来，显示具体日期（可能是测试数据）
    if (diffMs < 0) {
      console.warn('时间戳在未来:', { timestamp, timestampMs, now });
      const date = new Date(timestampMs);
      return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 365) {
      // 超过一年，显示具体日期
      const date = new Date(timestampMs);
      return date.toLocaleDateString('zh-CN');
    } else if (diffDays > 0) {
      return `${diffDays}天前`;
    } else if (diffHours > 0) {
      return `${diffHours}小时前`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}分钟前`;
    } else if (diffSeconds > 0) {
      return `${diffSeconds}秒前`;
    } else {
      return '刚刚';
    }
  } catch (error) {
    console.error('格式化时间戳失败:', error, { timestampStr });
    return '时间格式错误';
  }
}

/**
 * 格式化智能合约价格
 * @description 处理智能合约返回的价格（Wei格式）
 * @param priceStr - 价格字符串或BigInt（Wei格式）
 * @returns 格式化后的价格字符串
 */
export function formatContractPrice(priceStr: string | bigint): string {
  if (!priceStr || priceStr === '0' || priceStr === BigInt(0)) {
    return '0.00';
  }

  try {
    let priceBigInt: bigint;
    if (typeof priceStr === 'bigint') {
      priceBigInt = priceStr;
    } else {
      // 如果已经是小数格式，直接返回
      if (priceStr.includes('.') && priceStr.length < 20) {
        const price = parseFloat(priceStr);
        return price.toFixed(2);
      }
      priceBigInt = BigInt(priceStr);
    }

    const etherValue = formatEther(priceBigInt);
    const numValue = parseFloat(etherValue);
    return numValue.toFixed(2);
  } catch (error) {
    console.error('格式化价格失败:', error, { priceStr });
    return '价格格式错误';
  }
}

/**
 * 调试输出数据格式
 * @description 用于调试，输出原始数据以便分析格式
 * @param label - 标签
 * @param data - 数据
 */
export function debugLogData(label: string, data: unknown): void {
  console.log(`🐛 [${label}]`, {
    value: data,
    type: typeof data,
    string: String(data),
    length: String(data).length,
    parsed: isNaN(Number(data)) ? 'NaN' : Number(data),
  });
} 