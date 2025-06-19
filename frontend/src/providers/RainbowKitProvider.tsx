import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider as RainbowKitProviderComponent,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  mainnet,
  sepolia,
  polygon,
  optimism,
  arbitrum,
  base,
  Chain,
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const queryClient = new QueryClient();

const foundryChain: Chain = {
  id: 31337,
  name: 'Foundry',
  nativeCurrency: {
    decimals: 18,
    name: 'Carbon Token',
    symbol: 'CARB',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
  blockExplorers: {
    default: { name: 'Foundry', url: '' },
  },
  testnet: true,
};

const sepoliaChain = {
  ...sepolia,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || ''] },
    public: { http: [process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL || ''] },
  },
};

const mainnetChain = {
  ...mainnet,
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MAINNET_RPC_URL || ''] },
    public: { http: [process.env.NEXT_PUBLIC_MAINNET_RPC_URL || ''] },
  },
};

const config = getDefaultConfig({
  appName: 'GreenTrace',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || '',
  chains: [foundryChain, sepoliaChain, mainnetChain, polygon, optimism, arbitrum, base],
  ssr: true,
});

export const WalletConnectButton = () => {
  return (
    <div className="fixed top-0 right-0 p-4 z-50">
      <ConnectButton />
    </div>
  );
};

export const RainbowKitProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProviderComponent>
          {children}
        </RainbowKitProviderComponent>
      </WagmiProvider>
    </QueryClientProvider>
  );
};