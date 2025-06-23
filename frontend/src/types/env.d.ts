declare global {
  namespace NodeJS {
    interface ProcessEnv {

      // 修改自行修改


      // 网络配置
      NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: string;
      NEXT_PUBLIC_ALCHEMY_RPC_URL: string;
      NEXT_PUBLIC_MAINNET_RPC_URL: string;
      
      // 合约地址配置
      NEXT_PUBLIC_CARBON_TOKEN_ADDRESS: string;
      NEXT_PUBLIC_GREEN_TRACE_ADDRESS: string;
      NEXT_PUBLIC_NFT_ADDRESS: string;
      NEXT_PUBLIC_MARKET_ADDRESS: string;
      
      // 新部署的合约地址
      NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS: string;
      NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS: string;
      NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS: string;
      
      // IPFS配置
      NEXT_PUBLIC_PINATA_API_KEY: string;
      NEXT_PUBLIC_PINATA_SECRET_KEY: string;
      NEXT_PUBLIC_PINATA_JWT: string;
    }
  }
}

export {}; 