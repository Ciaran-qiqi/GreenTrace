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
 * @param locale - 语言代码，默认为'zh'（中文）
 * @returns 相对时间字符串，如 "3分钟前" 或 "3 minutes ago"
 */
export function formatContractTimestamp(timestampStr: string | number | bigint, locale: string = 'zh'): string {
  if (!timestampStr) {
    return locale === 'zh' ? '未知时间' : 'Unknown time';
  }

  try {
    // 处理BigInt类型的时间戳
    let timestamp: number;
    if (typeof timestampStr === 'bigint') {
      timestamp = Number(timestampStr);
    } else if (typeof timestampStr === 'string') {
      // 如果字符串包含小数点，先取整数部分
      const cleanTimestamp = timestampStr.split('.')[0];
      timestamp = parseInt(cleanTimestamp);
    } else {
      timestamp = timestampStr;
    }
    
    if (isNaN(timestamp) || timestamp <= 0) {
      console.warn('无效时间戳:', { timestampStr, parsed: timestamp });
      return locale === 'zh' ? '未知时间' : 'Unknown time';
    }

    // 智能合约时间戳通常是秒，但JavaScript时间戳是毫秒
    let timestampMs: number;
    
    // 通过时间戳的位数判断单位
    const timestampStr2 = timestamp.toString();
    if (timestampStr2.length === 13) {
      // 13位数字，已经是毫秒
      timestampMs = timestamp;
    } else if (timestampStr2.length === 10) {
      // 10位数字，是秒，需要转换为毫秒
      timestampMs = timestamp * 1000;
    } else if (timestamp > 1e12) {
      // 大于1e12，认为是毫秒
      timestampMs = timestamp;
    } else {
      // 其他情况，认为是秒
      timestampMs = timestamp * 1000;
    }
    
    const now = Date.now();
    const diffMs = now - timestampMs;

    // 如果时间戳在未来或者相差过大，显示具体日期
    if (diffMs < 0 || diffMs > 365 * 24 * 60 * 60 * 1000) {
      const date = new Date(timestampMs);
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.warn('无效日期:', { timestamp, timestampMs, timestampStr });
        return locale === 'zh' ? '时间格式错误' : 'Invalid time format';
      }
      const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';
      return `${date.toLocaleDateString(localeCode)} ${date.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' })}`;
    }

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 30) {
      // 超过30天，显示具体日期
      const date = new Date(timestampMs);
      const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';
      return date.toLocaleDateString(localeCode);
    } else if (diffDays > 0) {
      return locale === 'zh' ? `${diffDays}天前` : `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return locale === 'zh' ? `${diffHours}小时前` : `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return locale === 'zh' ? `${diffMinutes}分钟前` : `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffSeconds > 0) {
      return locale === 'zh' ? `${diffSeconds}秒前` : `${diffSeconds} second${diffSeconds > 1 ? 's' : ''} ago`;
    } else {
      return locale === 'zh' ? '刚刚' : 'Just now';
    }
  } catch (error) {
    console.error('格式化时间戳失败:', error, { timestampStr });
    return locale === 'zh' ? '时间格式错误' : 'Time format error';
  }
}

/**
 * 格式化智能合约价格
 * @description 处理智能合约返回的价格（wei格式，需要转换为正常单位）
 * @param priceStr - 价格字符串或BigInt（wei格式，如3000000000000000000000表示3000 CARB）
 * @returns 格式化后的价格字符串
 */
export function formatContractPrice(priceStr: string | bigint): string {
  if (!priceStr || priceStr === '0' || priceStr === BigInt(0)) {
    return '0.00';
  }

  try {
    let priceValue: number;
    
    if (typeof priceStr === 'bigint') {
      // BigInt类型，使用formatEther转换
      priceValue = Number(formatEther(priceStr));
    } else {
      const price = parseFloat(priceStr);
      
      // 如果数值过大（超过1e15），认为是wei格式，需要转换
      if (price > 1e15) {
        priceValue = price / 1e18;
      } else {
        // 如果已经是正常格式，直接使用
        priceValue = price;
      }
    }

    if (isNaN(priceValue) || priceValue <= 0) {
      return '0.00';
    }

    // 根据价格大小选择合适的显示格式
    if (priceValue < 0.01) {
      // 小于0.01，显示更多小数位
      return priceValue.toFixed(6).replace(/\.?0+$/, '');
    } else if (priceValue < 1) {
      // 小于1，显示4位小数
      return priceValue.toFixed(4).replace(/\.?0+$/, '');
    } else if (priceValue < 1000) {
      // 1-1000，显示2位小数
      return priceValue.toFixed(2).replace(/\.?0+$/, '');
    } else {
      // 大于1000，显示整数并用千分位分隔符
      return Math.round(priceValue).toLocaleString();
    }
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

/**
 * 格式化区块链代币数量（支持wei转换）
 * @description 处理区块链上的代币数量，自动识别是否需要wei转换
 * @param amountStr - 代币数量字符串或BigInt（可能是wei格式）
 * @param decimals - 小数位数，默认18位
 * @param maxDecimals - 最大显示小数位数，默认2位
 * @returns 格式化后的数量字符串
 */
export function formatTokenAmount(amountStr: string | bigint | undefined, decimals: number = 18, maxDecimals: number = 2): string {
  if (!amountStr || amountStr === '0' || amountStr === BigInt(0)) {
    return '0';
  }

  try {
    let amount: number;

    if (typeof amountStr === 'bigint') {
      // BigInt类型，使用formatEther转换
      amount = Number(formatEther(amountStr));
    } else if (typeof amountStr === 'string') {
      // 如果字符串包含科学计数法，先处理
      if (amountStr.includes('e') || amountStr.includes('E')) {
        const numValue = parseFloat(amountStr);
        if (!isNaN(numValue)) {
          amount = numValue;
        } else {
          return '0';
        }
      } else {
        const amountValue = parseFloat(amountStr);
        
        // 如果数值过大（超过1e15），认为是wei格式，需要转换
        if (amountValue > 1e15) {
          amount = amountValue / Math.pow(10, decimals);
        } else {
          amount = amountValue;
        }
      }
    } else {
      return '0';
    }

    if (isNaN(amount) || amount < 0) {
      return '0';
    }

    // 根据数量大小选择合适的显示格式
    if (amount === 0) {
      return '0';
    } else if (amount < 0.01) {
      // 小于0.01，显示更多小数位但避免科学计数法
      return amount.toFixed(6).replace(/\.?0+$/, '');
    } else if (amount < 1) {
      // 小于1，显示2-4位小数
      return amount.toFixed(4).replace(/\.?0+$/, '');
    } else if (amount < 1000) {
      // 1-1000，显示指定的最大小数位数
      return amount.toFixed(maxDecimals).replace(/\.?0+$/, '');
    } else if (amount < 1000000) {
      // 1K-1M，显示K单位
      return `${(amount / 1000).toFixed(1).replace(/\.?0+$/, '')}K`;
    } else if (amount < 1000000000) {
      // 1M-1B，显示M单位
      return `${(amount / 1000000).toFixed(1).replace(/\.?0+$/, '')}M`;
    } else {
      // 超过1B，显示B单位
      return `${(amount / 1000000000).toFixed(1).replace(/\.?0+$/, '')}B`;
    }
  } catch (error) {
    console.error('格式化代币数量失败:', error, { amountStr });
    return '格式错误';
  }
}

/**
 * 格式化CARB代币价格（专门用于NFT价格显示）
 * @description 处理CARB代币价格，确保友好的显示格式
 * @param priceStr - 价格字符串（wei格式）
 * @returns 格式化后的价格字符串（不含单位）
 */
export function formatCarbonPrice(priceStr: string | bigint): string {
  if (!priceStr || priceStr === '0' || priceStr === BigInt(0)) {
    return '0';
  }

  try {
    let price: number;

    if (typeof priceStr === 'bigint') {
      // BigInt类型，使用formatEther转换
      price = Number(formatEther(priceStr));
    } else {
      const priceValue = parseFloat(priceStr);
      
      // 如果数值过大（超过1e15），认为是wei格式，需要转换
      if (priceValue > 1e15) {
        price = priceValue / 1e18;
      } else {
        price = priceValue;
      }
    }

    if (isNaN(price) || price < 0) {
      return '0';
    }

    // 价格显示格式：保留适当的小数位数
    if (price === 0) {
      return '0';
    } else if (price < 0.001) {
      // 小于0.001，显示6位小数
      return price.toFixed(6).replace(/\.?0+$/, '');
    } else if (price < 1) {
      // 小于1，显示4位小数
      return price.toFixed(4).replace(/\.?0+$/, '');
    } else if (price < 1000) {
      // 1-1000，显示2位小数
      return price.toFixed(2).replace(/\.?0+$/, '');
    } else {
      // 大于1000，显示整数并用千分位分隔符
      return Math.round(price).toLocaleString();
    }
  } catch (error) {
    console.error('格式化CARB价格失败:', error, { priceStr });
    return '格式错误';
  }
}

/**
 * 格式化交易量数据（用于市场统计）
 * @description 专门用于格式化市场交易量，支持大数值的友好显示
 * @param volumeStr - 交易量字符串（wei格式）
 * @returns 格式化后的交易量字符串
 */
export function formatTradingVolume(volumeStr: string | bigint): string {
  if (!volumeStr || volumeStr === '0' || volumeStr === BigInt(0)) {
    return '0';
  }

  try {
    let volume: number;

    if (typeof volumeStr === 'bigint') {
      // BigInt类型，使用formatEther转换
      volume = Number(formatEther(volumeStr));
    } else {
      const volumeValue = parseFloat(volumeStr);
      
      // 如果数值过大（超过1e15），认为是wei格式，需要转换
      if (volumeValue > 1e15) {
        volume = volumeValue / 1e18;
      } else {
        volume = volumeValue;
      }
    }

    if (isNaN(volume) || volume < 0) {
      return '0';
    }

    // 交易量显示格式：使用合适的单位
    if (volume === 0) {
      return '0';
    } else if (volume < 1000) {
      // 小于1000，显示整数
      return Math.round(volume).toLocaleString();
    } else if (volume < 1000000) {
      // 1K-1M，显示K单位
      return `${(volume / 1000).toFixed(1).replace(/\.?0+$/, '')}K`;
    } else if (volume < 1000000000) {
      // 1M-1B，显示M单位
      return `${(volume / 1000000).toFixed(1).replace(/\.?0+$/, '')}M`;
    } else {
      // 超过1B，显示B单位
      return `${(volume / 1000000000).toFixed(1).replace(/\.?0+$/, '')}B`;
    }
  } catch (error) {
    console.error('格式化交易量失败:', error, { volumeStr });
    return '格式错误';
  }
} 