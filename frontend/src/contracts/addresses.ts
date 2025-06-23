// 合约地址配置
export const CONTRACT_ADDRESSES = {
  // // 主网
  // mainnet: {
  //   CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
  //   GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
  //   NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
  //   Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
  // },
  // Sepolia 测试网  修改自行修改
  sepolia: {
    // 碳币合约 - 用于碳信用交易和奖励
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '0x808b73A3A1D97382acF32d4F4F834e799Aa08198',
    
    // 核心合约 - 管理整个生态系统
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673',
    
    // NFT合约 - 用于碳信用NFT的铸造和交易
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '0x3456a42043955B1626F6353936c0FEfCd1cB5f1c',
    
    // NFT市场合约 - 用于NFT的买卖交易
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x82c59961a858f92816d61be7Ec28541E51d37224',
    
    // 碳价预言机合约 - 提供实时碳价格数据
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA',
    
    // 流动性池合约 - 提供碳币和USDT的流动性交易
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '0xCfBE2B410E5707b35231B9237bD7E523403Db889',
    
    // 订单簿市场合约 - 提供限价单交易功能
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '0x15Dfc335131191e0767036cD611D22a8b9b5Ed43',
  },
  // // 本地 Foundry 测试网
  // foundry: {
  //   CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
  //   GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
  //   NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
  //   Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
  // },
}; 