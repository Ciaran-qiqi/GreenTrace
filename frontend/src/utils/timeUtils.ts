/**
 * 时间工具函数
 * 统一处理区块链时间戳的格式化显示
 */

/**
 * 智能格式化时间戳
 * 自动检测时间戳是秒还是毫秒，并转换为可读格式
 * @param timestamp - 时间戳（字符串或数字，可能是秒或毫秒）
 * @param locale - 本地化设置，默认为中文
 * @returns 格式化的时间字符串
 */
export function formatTimestamp(timestamp: string | number | undefined, locale: string = 'zh-CN'): string {
  if (!timestamp) return '未知时间';
  
  try {
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    
    // 检测时间戳单位：
    // 如果是10位数字，认为是秒级时间戳
    // 如果是13位数字，认为是毫秒级时间戳
    // 如果小于10位，可能是相对时间，乘以1000
    let milliseconds: number;
    
    if (numTimestamp > 1e12) {
      // 13位或更多，认为已经是毫秒
      milliseconds = numTimestamp;
    } else if (numTimestamp > 1e9) {
      // 10-12位，认为是秒，转换为毫秒
      milliseconds = numTimestamp * 1000;
    } else {
      // 小于10位，可能是相对时间或其他格式
      // 尝试直接使用，如果结果不合理则乘以1000
      const directDate = new Date(numTimestamp);
      const convertedDate = new Date(numTimestamp * 1000);
      
      // 如果直接使用的结果在1970年之前，使用转换后的
      if (directDate.getFullYear() < 1990) {
        milliseconds = numTimestamp * 1000;
      } else {
        milliseconds = numTimestamp;
      }
    }
    
    const date = new Date(milliseconds);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('无效的时间戳:', timestamp);
      return '无效时间';
    }
    
    // 检查日期是否合理（不能早于2020年或晚于2030年）
    const year = date.getFullYear();
    if (year < 2020 || year > 2030) {
      console.warn('时间戳可能有误:', {
        original: timestamp,
        converted: milliseconds,
        date: date.toISOString(),
        year
      });
      
      // 尝试另一种转换方式
      const alternativeMs = numTimestamp > 1e9 ? numTimestamp : numTimestamp * 1000;
      const alternativeDate = new Date(alternativeMs);
      const alternativeYear = alternativeDate.getFullYear();
      
      if (alternativeYear >= 2020 && alternativeYear <= 2030) {
        return alternativeDate.toLocaleString(locale);
      }
      
      return `时间异常 (${date.toLocaleDateString(locale)})`;
    }
    
    return date.toLocaleString(locale);
  } catch (error) {
    console.error('格式化时间戳失败:', error, { timestamp });
    return '时间格式错误';
  }
}

/**
 * 格式化相对时间（多久之前）
 * @param timestamp - 时间戳
 * @returns 相对时间字符串，如 "3分钟前"
 */
export function formatRelativeTime(timestamp: string | number | undefined): string {
  if (!timestamp) return '未知时间';
  
  try {
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    let milliseconds = numTimestamp > 1e12 ? numTimestamp : numTimestamp * 1000;
    
    const now = Date.now();
    const diff = now - milliseconds;
    
    if (diff < 0) return '将来';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (minutes > 0) return `${minutes}分钟前`;
    if (seconds > 0) return `${seconds}秒前`;
    
    return '刚刚';
  } catch (error) {
    console.error('格式化相对时间失败:', error);
    return '时间错误';
  }
}

/**
 * 格式化为简短日期格式
 * @param timestamp - 时间戳
 * @returns 简短日期字符串，如 "2024-01-15"
 */
export function formatShortDate(timestamp: string | number | undefined): string {
  if (!timestamp) return '未知日期';
  
  try {
    const formatted = formatTimestamp(timestamp);
    if (formatted.includes('异常') || formatted.includes('错误')) {
      return formatted;
    }
    
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    const milliseconds = numTimestamp > 1e12 ? numTimestamp : numTimestamp * 1000;
    const date = new Date(milliseconds);
    
    return date.toLocaleDateString('zh-CN');
  } catch (error) {
    console.error('格式化短日期失败:', error);
    return '日期错误';
  }
} 