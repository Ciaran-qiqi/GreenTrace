import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, mainnet } from 'wagmi/chains';
import { http, fallback } from 'viem';

// Wagmi config - Supports Sepolia testnet and Ethereum mainnet, optimized network settings
export const config = getDefaultConfig({
  appName: 'GreenTrace',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [
    sepolia, // Sepolia Testnet - Main development environment
    mainnet, // Ethereum Mainnet - Production environment
  ],
  transports: {
    [sepolia.id]: fallback([
      // Primary - Your own Alchemy node (most stable)
      http(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL!, {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // Fallback 1 - Your own Infura node
      http(process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // Fallback 2 - Ethereum Foundation public node
      http('https://rpc.sepolia.ethpandaops.io', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // Fallback 3 - Ankr public node
      http('https://rpc.ankr.com/eth_sepolia', {
        timeout: 15_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // Fallback 4 - Infura public node
      http('https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', {
        timeout: 12_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // Fallback 5 - Alchemy public node
      http('https://eth-sepolia.g.alchemy.com/v2/demo', {
        timeout: 12_000,
        retryCount: 1,
        retryDelay: 1000,
      }),
      // Final fallback - DRPC node (shorter timeout, fast fail)
      http('https://sepolia.drpc.org', {
        timeout: 8_000, // Shorter timeout
        retryCount: 1,   // Fewer retries
        retryDelay: 2000,
      }),
    ], {
      // Fallback config optimization
      rank: false, // Try nodes in order
      retryCount: 3,  // Retry 3 times in total
      retryDelay: 500, // Fixed 500ms delay
    }),
    [mainnet.id]: fallback([
      // Primary RPC node - Your own Alchemy node
      http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL!, {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // Fallback 1 - Public node
      http('https://ethereum.publicnode.com', {
        timeout: 15_000,
        retryCount: 2,
        retryDelay: 500,
      }),
      // Fallback 2 - DRPC (shorter timeout)
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
  ssr: true, // Enable server-side rendering support
  // Add polling config to reduce unnecessary requests
  pollingInterval: 8_000, // 8s polling interval instead of default
}); 