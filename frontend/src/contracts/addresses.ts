// 合约地址配置
export const CONTRACT_ADDRESSES = {
  // 主网
  mainnet: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
  },
  // Sepolia 测试网
  sepolia: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
  },
  // 本地 Foundry 测试网
  foundry: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
  },
}; 