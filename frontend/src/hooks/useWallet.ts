import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

// 本地存储键名
const STORAGE_KEYS = {
  WALLET_ADDRESS: 'greentrace_wallet_address',
  CONNECTED_CHAIN: 'greentrace_connected_chain',
  LAST_CONNECTED: 'greentrace_last_connected',
  USER_PREFERENCES: 'greentrace_user_preferences',
};

// 缓存过期时间（12小时）
const CACHE_EXPIRY_HOURS = 12;

export const useWallet = () => {
  const { address, isConnected } = useAccount();
  const [userPreferences, setUserPreferences] = useState<any>(null);

  // 检查缓存是否过期
  const isCacheExpired = (timestamp: string) => {
    const lastConnectedTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    const hoursSinceLastConnect = (now - lastConnectedTime) / (1000 * 60 * 60);
    return hoursSinceLastConnect >= CACHE_EXPIRY_HOURS;
  };

  // 从本地存储加载用户偏好设置
  useEffect(() => {
    const savedPreferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    const lastConnected = localStorage.getItem(STORAGE_KEYS.LAST_CONNECTED);

    // 如果缓存过期，清除所有数据
    if (lastConnected && isCacheExpired(lastConnected)) {
      clearUserData();
      return;
    }

    if (savedPreferences) {
      try {
        setUserPreferences(JSON.parse(savedPreferences));
      } catch (e) {
        console.error('Failed to parse user preferences:', e);
        clearUserData();
      }
    }
  }, []);

  // 保存用户偏好设置
  const saveUserPreferences = (preferences: any) => {
    try {
      const preferencesString = JSON.stringify(preferences);
      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, preferencesString);
      localStorage.setItem(STORAGE_KEYS.LAST_CONNECTED, new Date().toISOString());
      setUserPreferences(preferences);
    } catch (e) {
      console.error('Failed to save user preferences:', e);
    }
  };

  // 清除用户数据
  const clearUserData = () => {
    localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    localStorage.removeItem(STORAGE_KEYS.LAST_CONNECTED);
    localStorage.removeItem(STORAGE_KEYS.CONNECTED_CHAIN);
    setUserPreferences(null);
  };

  // 检查钱包连接状态
  useEffect(() => {
    if (!isConnected) {
      clearUserData();
    }
  }, [isConnected]);

  return {
    // RainbowKit 的钱包状态
    walletAddress: address,
    isConnected,
    
    // 用户偏好设置
    userPreferences,
    saveUserPreferences,
    clearUserData,
  };
}; 