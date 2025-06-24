'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface CarbonPriceData {
  price: number;
  date: string;
  dailyChange: number;
  monthlyChange: number;
  yearlyChange: number;
  lastUpdated: string;
}

interface ExchangeRate {
  rates: {
    USD: number;
    CNY: number;
  };
}

// 缓存键名
const CACHE_KEYS = {
  PRICE_DATA: 'carbon_price_data',
  EXCHANGE_RATE: 'exchange_rate',
  LAST_FETCH: 'last_fetch_time'
};

// 缓存有效期（5小时）
const CACHE_DURATION = 300 * 60 * 1000;

// 计算距离下一个更新时间点的毫秒数
const getTimeUntilNextUpdate = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // 设置目标时间点（00:05 和 12:05）
  const targetTimes = [
    { hour: 0, minute: 5 },
    { hour: 12, minute: 5 }
  ];
  
  // 找到下一个更新时间点
  const nextUpdate = new Date(now);
  let found = false;
  
  for (const time of targetTimes) {
    if (currentHour < time.hour || (currentHour === time.hour && currentMinute < time.minute)) {
      nextUpdate.setHours(time.hour, time.minute, 0, 0);
      found = true;
      break;
    }
  }
  
  // 如果没有找到今天的时间点，就设置为明天的第一个时间点
  if (!found) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    nextUpdate.setHours(targetTimes[0].hour, targetTimes[0].minute, 0, 0);
  }
  
  return nextUpdate.getTime() - now.getTime();
};

export const CarbonPriceCard = () => {
  const [priceData, setPriceData] = useState<CarbonPriceData | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 格式化时间显示
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // 检查缓存是否有效
  const isCacheValid = () => {
    const lastFetch = localStorage.getItem(CACHE_KEYS.LAST_FETCH);
    if (!lastFetch) return false;
    
    const now = new Date().getTime();
    const lastFetchTime = parseInt(lastFetch);
    return now - lastFetchTime < CACHE_DURATION;
  };

  // 从缓存获取数据
  const getCachedData = () => {
    try {
      const cachedPriceData = localStorage.getItem(CACHE_KEYS.PRICE_DATA);
      const cachedExchangeRate = localStorage.getItem(CACHE_KEYS.EXCHANGE_RATE);
      
      if (cachedPriceData && cachedExchangeRate) {
        setPriceData(JSON.parse(cachedPriceData));
        setExchangeRate(JSON.parse(cachedExchangeRate));
        return true;
      }
    } catch (err) {
      console.error('读取缓存失败:', err);
    }
    return false;
  };

  // 保存数据到缓存
  const saveToCache = (priceData: CarbonPriceData, exchangeRate: ExchangeRate) => {
    try {
      localStorage.setItem(CACHE_KEYS.PRICE_DATA, JSON.stringify(priceData));
      localStorage.setItem(CACHE_KEYS.EXCHANGE_RATE, JSON.stringify(exchangeRate));
      localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
    } catch (err) {
      console.error('保存缓存失败:', err);
    }
  };

  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        // 如果缓存有效，直接使用缓存数据
        if (isCacheValid() && getCachedData()) {
          setLoading(false);
          return;
        }

        // 否则从API获取新数据
        const [priceResponse, rateResponse] = await Promise.all([
          axios.get('https://greentrace-api.onrender.com/api/carbon-price'),
          axios.get('https://open.er-api.com/v6/latest/EUR')
        ]);
        
        const newPriceData = priceResponse.data;
        const newExchangeRate = rateResponse.data;
        
        setPriceData(newPriceData);
        setExchangeRate(newExchangeRate);
        saveToCache(newPriceData, newExchangeRate);
        setError(null);
      } catch (err) {
        setError('获取数据失败');
        console.error('获取数据失败:', err);
      } finally {
        setLoading(false);
      }
    };

    // 初始加载数据
    fetchPriceData();

    // 设置定时更新
    const scheduleNextUpdate = () => {
      const timeUntilNext = getTimeUntilNextUpdate();
      setTimeout(() => {
        fetchPriceData();
        scheduleNextUpdate(); // 递归设置下一次更新
      }, timeUntilNext);
    };

    // 启动定时更新
    scheduleNextUpdate();

    // 清理函数
    return () => {
      // 清除所有定时器
      const timers = window.setTimeout(() => {}, 0);
      for (let i = 0; i < timers; i++) {
        window.clearTimeout(i);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-1/4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!priceData || !exchangeRate) return null;

  const usdPrice = priceData.price * exchangeRate.rates.USD;
  const cnyPrice = priceData.price * exchangeRate.rates.CNY;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 relative">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">碳价指数（EEX European Carbon Index）</h2>
      
      {/* 价格显示区域 */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">欧元 (EUR)</p>
          <p className="text-2xl font-bold text-emerald-600">
            €{priceData.price.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">美元 (USD)</p>
          <p className="text-2xl font-bold text-emerald-600">
            ${usdPrice.toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">人民币 (CNY)</p>
          <p className="text-2xl font-bold text-emerald-600">
            ¥{cnyPrice.toFixed(2)}
          </p>
        </div>
      </div>

      {/* 涨跌幅显示区域 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">日涨跌 (Daily)</p>
          <p className={`text-lg font-semibold ${priceData.dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {priceData.dailyChange >= 0 ? '+' : ''}{priceData.dailyChange.toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">月涨跌 (Monthly)</p>
          <p className={`text-lg font-semibold ${priceData.monthlyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {priceData.monthlyChange >= 0 ? '+' : ''}{priceData.monthlyChange.toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-1">年涨跌 (Yearly)</p>
          <p className={`text-lg font-semibold ${priceData.yearlyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {priceData.yearlyChange >= 0 ? '+' : ''}{priceData.yearlyChange.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* 更新时间 */}
      <div className="absolute bottom-3 right-6">
        <p className="text-sm text-gray-500">
          最后更新: {formatDateTime(priceData.lastUpdated)}
        </p>
      </div>
    </div>
  );
}; 