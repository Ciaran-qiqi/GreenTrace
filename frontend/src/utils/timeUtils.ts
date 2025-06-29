/**
 * Time utility functions
 * Unified formatting for blockchain timestamps
 */

/**
 * Smart timestamp formatting
 * Automatically detects if the timestamp is in seconds or milliseconds and converts to readable format
 * @param timestamp - Timestamp (string or number, could be seconds or milliseconds)
 * @param locale - Locale setting, default is Chinese
 * @returns Formatted time string
 */
export function formatTimestamp(timestamp: string | number | undefined, locale: string = 'zh-CN'): string {
  if (!timestamp) return 'Unknown time';
  
  try {
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    
    // Detect timestamp unit:
    // If 10 digits, treat as seconds
    // If 13 digits, treat as milliseconds
    // If less than 10 digits, maybe relative time, multiply by 1000
    let milliseconds: number;
    
    if (numTimestamp > 1e12) {
      // 13 digits or more, treat as milliseconds
      milliseconds = numTimestamp;
    } else if (numTimestamp > 1e9) {
      // 10-12 digits, treat as seconds, convert to milliseconds
      milliseconds = numTimestamp * 1000;
    } else {
      // Less than 10 digits, maybe relative time or other format
      // Try direct use, if result is unreasonable then multiply by 1000
      const directDate = new Date(numTimestamp);
      // const convertedDate = new Date(numTimestamp * 1000); // Unused, commented out
      
      // If direct use results in year before 1970, use converted
      if (directDate.getFullYear() < 1990) {
        milliseconds = numTimestamp * 1000;
      } else {
        milliseconds = numTimestamp;
      }
    }
    
    const date = new Date(milliseconds);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return 'Invalid time';
    }
    
    // Check if date is reasonable (not before 2020 or after 2030)
    const year = date.getFullYear();
    if (year < 2020 || year > 2030) {
      console.warn('Timestamp may be incorrect:', {
        original: timestamp,
        converted: milliseconds,
        date: date.toISOString(),
        year
      });
      
      // Try another conversion method
      const alternativeMs = numTimestamp > 1e9 ? numTimestamp : numTimestamp * 1000;
      const alternativeDate = new Date(alternativeMs);
      const alternativeYear = alternativeDate.getFullYear();
      
      if (alternativeYear >= 2020 && alternativeYear <= 2030) {
        return alternativeDate.toLocaleString(locale);
      }
      
      return `Abnormal time (${date.toLocaleDateString(locale)})`;
    }
    
    return date.toLocaleString(locale);
  } catch (error) {
    console.error('Failed to format timestamp:', error, { timestamp });
    return 'Time format error';
  }
}

/**
 * Format relative time (how long ago)
 * @param timestamp - Timestamp
 * @returns Relative time string, e.g. "3 minutes ago"
 */
export function formatRelativeTime(timestamp: string | number | undefined): string {
  if (!timestamp) return 'Unknown time';
  
  try {
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    const milliseconds = numTimestamp > 1e12 ? numTimestamp : numTimestamp * 1000;
    
    const now = Date.now();
    const diff = now - milliseconds;
    
    if (diff < 0) return 'In the future';
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    if (seconds > 0) return `${seconds} seconds ago`;
    
    return 'Just now';
  } catch (error) {
    console.error('Failed to format relative time:', error);
    return 'Time error';
  }
}

/**
 * Format as short date
 * @param timestamp - Timestamp
 * @returns Short date string, e.g. "2024-01-15"
 */
export function formatShortDate(timestamp: string | number | undefined): string {
  if (!timestamp) return 'Unknown date';
  
  try {
    const formatted = formatTimestamp(timestamp);
    if (formatted.includes('Abnormal') || formatted.includes('error')) {
      return formatted;
    }
    
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    const milliseconds = numTimestamp > 1e12 ? numTimestamp : numTimestamp * 1000;
    const date = new Date(milliseconds);
    
    return date.toLocaleDateString('zh-CN');
  } catch (error) {
    console.error('Failed to format short date:', error);
    return 'Date error';
  }
}

/**
 * Format time ago (alias for formatRelativeTime)
 * @param timestamp - Timestamp or ISO string
 * @returns Relative time string
 */
export function formatTimeAgo(timestamp: string | number | undefined): string {
  return formatRelativeTime(timestamp);
}

/**
 * Format time - simple time formatting function
 * @param timestamp - Timestamp or ISO string
 * @returns Formatted time string
 */
export function formatTime(timestamp: string | number | undefined): string {
  if (!timestamp) return 'Unknown time';
  
  try {
    // If ISO string, parse directly
    if (typeof timestamp === 'string' && timestamp.includes('T')) {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN');
    }
    
    // Otherwise use general timestamp formatting
    return formatTimestamp(timestamp);
  } catch (error) {
    console.error('Failed to format time:', error);
    return 'Time error';
  }
} 