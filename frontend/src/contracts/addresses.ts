// Contract address configuration -Support multi-network deployment

export const CONTRACT_ADDRESSES = {
  // Ethereum main network configuration (production environment)

  mainnet: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '',
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '',
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '',
    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Main network USDT address (6-bit accuracy)

  },
  
  // Sepolia test network configuration (development environment)

  sepolia: {
    // Carbon Coin Contract -for carbon credit trading and rewards

    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '0x808b73A3A1D97382acF32d4F4F834e799Aa08198', // CarbonToken contract address, initial supply of 1,000,000 carbon coins, receiving address is the deployer

    
    // Core Contracts -Manage the entire ecosystem

    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '0x141B2c6Df6AE9863f1cD8FC4624d165209b9c18c', // GreenTrace Core Contract Address, responsible for ecosystem management, and has set up carbon coins and NFT contracts

    
    // NFT Contracts -For casting and trading of carbon credit NFTs

    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '0x3456a42043955B1626F6353936c0FEfCd1cB5f1c', // GreenTalesNFT contract address, supports NFT minting and transaction, GreenTrace address has been set

    
    // NFT Market Contracts -Purchase and Sell Trading for NFT

    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0x2661421e4e0373a06A3e705A83d1063e8F2F40EA', // GreenTalesMarket contract address, supports NFT market transactions, handling fee of 1%, NFT and carbon currency contracts have been set

    
    // Carbon Price Oracle Contract -Provide real-time carbon price data

    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA', // CarbonPriceOracle oracle contract address, integrated API, support requestCarbonPrice

    
    // Liquidity Pool Contracts -Provide liquidity trading of carbon coins and USDT

    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '0xCfBE2B410E5707b35231B9237bD7E523403Db889', // GreenTalesLiquidityPool LiquidityPool contract address, initialized, with 1,000 carbon coins and 88,000 USDT in the pool

    
    // Order Book Market Contract -Provides limit order trading functionality (newly deployed contracts)

    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3', // CarbonUSDTMarket Order Book Market Contract Address, Supports Limit Order Order Fee 0.5%, Transaction Fee 0.3%

    
    // USDT contract address -for transactions (Sepolia test network USDT)

    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '0xdCdC73413C6136c9ABc3E8d250af42947aC2Fc7', // Test network USDT contract address (18-bit accuracy)

  },
  
  // Local foundry testnet configuration (local development)

  foundry: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    CarbonPriceOracle: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS || '',
    GreenTalesLiquidityPool: process.env.NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS || '',
    CarbonUSDTMarket: process.env.NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS || '',
    USDT: process.env.NEXT_PUBLIC_USDT_ADDRESS || '', // Local test usdt address

  },
};

// Helper functions to get contract addresses based on chain ID
// 根据链ID获取CarbonToken合约地址的辅助函数

export const getCarbonTokenAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.CarbonToken;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.CarbonToken;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.CarbonToken;
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.CarbonToken;
  }
};

// Get the helper function of carbon usdt market contract address based on the chain id (new)

export const getCarbonUSDTMarketAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.CarbonUSDTMarket;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.CarbonUSDTMarket;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.CarbonUSDTMarket;
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.CarbonUSDTMarket;
  }
};

// Accessing the helper function of the green tales nft contract address according to the chain id

export const getGreenTalesNFTAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.NFT;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.NFT;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.NFT;
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.NFT;
  }
};

// The auxiliary function to obtain the green trace contract address according to the chain id

export const getGreenTraceAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.GreenTrace;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.GreenTrace;
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.GreenTrace;
  }
};

// Accessing the auxiliary function of the usdt contract address based on the chain id

export const getUSDTAddress = (chainId: number): string => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet.USDT || '';
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia.USDT;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry.USDT || '';
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia.USDT;
  }
};

// Get helper functions for all contract addresses based on chain id

export const getAllContractAddresses = (chainId: number) => {
  switch (chainId) {
    case 1: // Ethereum Main Network

      return CONTRACT_ADDRESSES.mainnet;
    case 11155111: // Sepolia Test Network

      return CONTRACT_ADDRESSES.sepolia;
    case 31337: // Local foundry network

      return CONTRACT_ADDRESSES.foundry;
    default:
      // Return the sepolia test network address by default

      return CONTRACT_ADDRESSES.sepolia;
  }
};

// Common contract address acquisition function (maintain backward compatibility)

export const getContractAddress = (chainId: number): string => {
  return getGreenTraceAddress(chainId);
}; 