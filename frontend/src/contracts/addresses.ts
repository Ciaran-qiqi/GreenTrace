export const CONTRACT_ADDRESSES = {
  mainnet: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    Auction: process.env.NEXT_PUBLIC_AUCTION_ADDRESS || '',
    Tender: process.env.NEXT_PUBLIC_TENDER_ADDRESS || '',
  },
  sepolia: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    Auction: process.env.NEXT_PUBLIC_AUCTION_ADDRESS || '',
    Tender: process.env.NEXT_PUBLIC_TENDER_ADDRESS || '',
  },
  foundry: {
    CarbonToken: process.env.NEXT_PUBLIC_CARBON_TOKEN_ADDRESS || '',
    GreenTrace: process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS || '',
    NFT: process.env.NEXT_PUBLIC_NFT_ADDRESS || '',
    Market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '',
    Auction: process.env.NEXT_PUBLIC_AUCTION_ADDRESS || '',
    Tender: process.env.NEXT_PUBLIC_TENDER_ADDRESS || '',
  },
}; 