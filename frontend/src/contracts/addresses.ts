// 合约地址配置 - 支持多网络部署
export const CONTRACT_ADDRESSES = {
  // 以太坊主网配置（生产环境）
  mainnet: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '',
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '',
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '',
    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7', // 主网USDT地址 (6位精度)
  },
  
  // Sepolia测试网配置（开发环境）
  sepolia: {
    // 碳币合约 - 用于碳信用交易和奖励
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '0x808b73A3A1D97382acF32d4F4F834e799Aa08198', // CarbonToken 合约地址，初始供应量 1,000,000 碳币，接收地址为部署者
    
    // 核心合约 - 管理整个生态系统
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '0x141B2c6Df6AE9863f1cD8FC4624d165209b9c18c', // GreenTrace 核心合约地址，负责生态系统管理，已设置碳币和NFT合约
    
    // NFT合约 - 用于碳信用NFT的铸造和交易
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '0x3456a42043955B1626F6353936c0FEfCd1cB5f1c', // GreenTalesNFT 合约地址，支持NFT铸造与交易，已设置GreenTrace地址
    
    // NFT市场合约 - 用于NFT的买卖交易
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x2661421e4e0373a06A3e705A83d1063e8F2F40EA', // GreenTalesMarket 合约地址，支持NFT市场交易，手续费1%，已设置NFT和碳币合约
    
    // 碳价预言机合约 - 提供实时碳价格数据
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA', // CarbonPriceOracle 预言机合约地址，已集成API，支持requestCarbonPrice
    
    // 流动性池合约 - 提供碳币和USDT的流动性交易
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '0xCfBE2B410E5707b35231B9237bD7E523403Db889', // GreenTalesLiquidityPool 流动性池合约地址，已初始化，池中有1,000碳币和88,000 USDT
    
    // 订单簿市场合约 - 提供限价单交易功能（新部署的合约）
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3', // CarbonUSDTMarket 订单簿市场合约地址，支持限价单，挂单费0.5%，成交费0.3%
    
    // USDT合约地址 - 用于交易 (Sepolia测试网USDT)
    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0xdCdC73413C6136c9ABc3E8d250af42947aC2Fc7', // 测试网USDT合约地址 (18位精度)
  },
  
  // 本地Foundry测试网配置（本地开发）
  foundry: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '',
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '',
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '',
    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '', // 本地测试USDT地址
  },
};

// Helper functions to get contract addresses based on chain ID
// 根据链ID获取CarbonToken合约地址的辅助函数
export const getCarbonTokenAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.CarbonToken;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.CarbonToken;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry.CarbonToken;
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia.CarbonToken;
  }
};

// 根据链ID获取CarbonUSDTMarket合约地址的辅助函数（新增）
export const getCarbonUSDTMarketAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.CarbonUSDTMarket;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.CarbonUSDTMarket;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry.CarbonUSDTMarket;
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia.CarbonUSDTMarket;
  }
};

// 根据链ID获取GreenTalesNFT合约地址的辅助函数
export const getGreenTalesNFTAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.NFT;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.NFT;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry.NFT;
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia.NFT;
  }
};

// 根据链ID获取GreenTrace合约地址的辅助函数
export const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// 根据链ID获取USDT合约地址的辅助函数
export const getUSDTAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet.USDT || '';
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia.USDT;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry.USDT || '';
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia.USDT;
  }
};

// 根据链ID获取所有合约地址的辅助函数
export const getAllContractAddresses = (chainId: number) => {
  switch (chainId) {
    case 1: // 以太坊主网
      return CONTRACT_ADDRESSES.mainnet;
    case 11155111: // Sepolia测试网
      return CONTRACT_ADDRESSES.sepolia;
    case 31337: // 本地Foundry网络
      return CONTRACT_ADDRESSES.foundry;
    default:
      // 默认返回Sepolia测试网地址
      return CONTRACT_ADDRESSES.sepolia;
  }
};

// 通用合约地址获取函数（保持向后兼容）
export const getContractAddress = (chainId: number): string => {
  return getGreenTraceAddress(chainId);
}; 