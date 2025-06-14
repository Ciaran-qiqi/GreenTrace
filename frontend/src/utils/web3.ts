import { formatEther, parseEther } from 'viem';

// 格式化以太坊地址
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// 格式化代币金额
export const formatTokenAmount = (amount: bigint, decimals: number = 18): string => {
  try {
    return formatEther(amount);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0';
  }
};

// 解析代币金额
export const parseTokenAmount = (amount: string, decimals: number = 18): bigint => {
  try {
    return parseEther(amount);
  } catch (error) {
    console.error('Error parsing token amount:', error);
    return BigInt(0);
  }
};

// 检查地址是否有效
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// 获取网络名称
export const getNetworkName = (chainId: number): string => {
  switch (chainId) {
    case 1:
      return 'Ethereum Mainnet';
    case 11155111:
      return 'Sepolia Testnet';
    case 31337:
      return 'Foundry Local';
    default:
      return 'Unknown Network';
  }
}; 