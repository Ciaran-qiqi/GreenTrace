import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';
import { http, fallback } from 'viem';

// Wagmi配置 - 支持Sepolia测试网和以太坊主网，优化网络配置
export const config = getDefaultConfig({
  appName: 'GreenTrace',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [
    sepolia, // Sepolia测试网 - 主要开发环境
    mainnet, // 以太坊主网 - 生产环境
  ],
  transports: {
    [sepolia.id]: fallback([
      // 优先使用您自己的Alchemy节点（最稳定）
      http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!, {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // 备用节点1 - 您自己的Infura节点
      http(process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // 备用节点2 - 以太坊基金会公共节点
      http('https://rpc.sepolia.ethpandaops.io', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // 备用节点3 - Ankr公共节点
      http('https://rpc.ankr.com/eth_sepolia', {
        timeout: 15_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // 备用节点4 - Infura公共节点
      http('https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', {
        timeout: 12_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // 备用节点5 - Alchemy公共节点
      http('https://eth-sepolia.g.alchemy.com/v2/demo', {
        timeout: 12_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // 最后选择 - DRPC节点（较短超时，快速失败）
      http('https://sepolia.drpc.org', {
        timeout: 8_000, // 更短的超时时间
        retryCount: 1,   // 减少重试次数
        retryDelay: 2000,
      }),
    ], {
      // Fallback配置优化
      rank: false, // 按顺序尝试节点
      retryCount: 3,  // 整体重试3次
      retryDelay: 500, // 固定500ms延迟
    }),
    [mainnet.id]: fallback([
      // 主要RPC节点 - 您自己的Alchemy节点
      http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL!, {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // 备用节点1 - 公共节点
      http('https://ethereum.publicnode.com', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // 备用节点2 - DRPC（较短超时）
      http('https://eth.drpc.org', {
        timeout: 8_000,
        retryCount: 1,
        retryDelay: 2000,
      }),
    ], {
      rank: false,
      retryCount: 3,
      retryDelay: 500,
    }),
  },
  ssr: true, // 启用服务端渲染支持
  // 添加轮询配置，减少不必要的请求
  pollingInterval: 8_000, // 8秒轮询间隔，而不是默认的1秒
}); 
