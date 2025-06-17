declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID: string;
      NEXT_PUBLIC_ALCHEMY_RPC_URL: string;
      NEXT_PUBLIC_MAINNET_RPC_URL: string;
      NEXT_PUBLIC_CARBON_TOKEN_ADDRESS: string;
      NEXT_PUBLIC_GREEN_TRACE_ADDRESS: string;
      NEXT_PUBLIC_NFT_ADDRESS: string;
      NEXT_PUBLIC_MARKET_ADDRESS: string;
    }
  }
}

export {}; 