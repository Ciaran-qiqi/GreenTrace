# GreenTrace 🌱

A decentralized carbon credit NFT ecosystem that tokenizes individual environmental actions using Chainlink oracles and DeFi protocols.

## 🎯 Project Overview

GreenTrace transforms personal environmental actions (walking, cycling, waste reduction) into tradeable carbon credit NFTs, creating financial incentives for sustainable behavior through a complete DeFi ecosystem.

## 🏆 Hackathon Track: Onchain Finance

This project is submitted for the **$50,000 Onchain Finance** track in the Chromion Chainlink Hackathon, demonstrating:

- **Tokenization of RWAs**: Carbon credits based on offchain environmental actions
- **DeFi Innovation**: Custom order book, liquidity pools, and price oracle systems
- **Chainlink Integration**: Multiple Chainlink services for automated, secure operations

## 🛠️ Technology Stack

### Smart Contracts

- **Solidity** - Smart contract development
- **Foundry** - Development, testing, and deployment framework
- **OpenZeppelin** - Secure contract libraries

### Frontend

- **Next.js 15.3.4** - React framework
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Styling
- **Wagmi + RainbowKit** - Web3 wallet integration
- **TanStack React Query** - Data fetching

### Backend

- **Golang** - High-performance backend services
- **Custom crawlers** - Carbon data collection

### Blockchain

- **Ethereum** - Main blockchain platform
- **Sepolia Testnet** - Testing environment
- **IPFS** - Decentralized storage for NFT metadata

## 🔗 Chainlink Integration

### Files Using Chainlink Services

#### Core Chainlink Integration Files:

- [`Foundry/src/CarbonPriceOracle.sol`](./Foundry/src/CarbonPriceOracle.sol) - **Main Chainlink Functions implementation**
- [`Foundry/src/interfaces/ICarbonPriceOracle.sol`](./Foundry/src/interfaces/ICarbonPriceOracle.sol) - Oracle interface
- [`Foundry/src/CarbonUSDTMarket.sol`](./Foundry/src/CarbonUSDTMarket.sol) - Uses Chainlink price feeds
- [`Foundry/src/GreenTalesLiquidityPool.sol`](./Foundry/src/GreenTalesLiquidityPool.sol) - Oracle-based price validation

#### Test Files:

- [`Foundry/test/CarbonPriceOracle.t.sol`](./Foundry/test/CarbonPriceOracle.t.sol) - Oracle testing
- [`Foundry/test/CarbonUSDTMarketComplete.t.sol`](./Foundry/test/CarbonUSDTMarketComplete.t.sol) - Market integration tests
- [`Foundry/test/GreenTalesLiquidityPool.t.sol`](./Foundry/test/GreenTalesLiquidityPool.t.sol) - Pool testing

#### Deployment Scripts:

- [`Foundry/script/Deploy.s.sol`](./Foundry/script/Deploy.s.sol) - Main deployment with Chainlink config
- [`Foundry/script/DeployStepByStep.s.sol`](./Foundry/script/DeployStepByStep.s.sol) - Step-by-step deployment

#### Frontend Integration:

- [`frontend/src/contracts/hooks/useGreenTrace.ts`](./frontend/src/contracts/hooks/useGreenTrace.ts) - Oracle data integration
- [`frontend/src/hooks/useCarbonToken.ts`](./frontend/src/hooks/useCarbonToken.ts) - Token interactions
- [`frontend/src/components/CarbonMarket.tsx`](./frontend/src/components/CarbonMarket.tsx) - Market UI with oracle data

### Chainlink Services Used

#### 1. **Chainlink Functions**

- **File**: `CarbonPriceOracle.sol`
- **Purpose**: Fetch real-time carbon prices from external APIs
- **Implementation**:
  ```solidity
  import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
  import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
  ```

#### 2. **Chainlink Data Feeds**

- **File**: `CarbonPriceOracle.sol`
- **Purpose**: EUR/USD price conversion
- **Implementation**:
  ```solidity
  import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
  ```

#### 3. **Oracle-Based Price Validation**

- **Files**: `CarbonUSDTMarket.sol`, `GreenTalesLiquidityPool.sol`
- **Purpose**: MEV protection and price deviation monitoring
- **Implementation**: Real-time price comparison with oracle data

## 🏗️ Architecture

### Smart Contract Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CarbonToken   │    │ CarbonPriceOracle│    │ CarbonUSDTMarket│
│   (ERC20)       │    │ (Chainlink Func) │    │ (Order Book)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌──────────────────┐
                    │ GreenTalesLiquidity│
                    │ Pool (AMM)       │
                    └──────────────────┘
```

### Chainlink Integration Flow

1. **Price Fetching**: Chainlink Functions calls external API for carbon prices
2. **Price Conversion**: Chainlink Data Feeds convert EUR to USD
3. **Price Validation**: Oracle prices used for MEV protection and trade validation
4. **Automated Operations**: Threshold-based automated market operations

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Foundry
- Go 1.21+

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/GreenTrace.git
   cd GreenTrace
   ```
2. **Install Foundry dependencies**

   ```bash
   cd Foundry
   forge install
   ```
3. **Install frontend dependencies**

   ```bash
   cd ../frontend
   npm install
   ```
4. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Add your configuration
   ```

### Deployment

1. **Deploy smart contracts**

   ```bash
   cd Foundry
   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
   ```
2. **Start frontend**

   ```bash
   cd frontend
   npm run dev
   ```

## 📊 Key Features

### Carbon Credit Tokenization

- Convert environmental actions into NFT carbon credits
- Verifiable on-chain environmental impact tracking
- Transparent carbon reduction quantification

### DeFi Trading Ecosystem

- **Order Book Trading**: Traditional DEX-style carbon credit trading
- **Liquidity Pools**: AMM-style carbon credit-USDT pools
- **Price Oracle**: Real-time carbon price feeds via Chainlink
- **MEV Protection**: Oracle-based price deviation monitoring

### Automated Market Operations

- **Price Deviation Monitoring**: Automated trade blocking for price manipulation
- **Oracle Integration**: Real-time price validation
- **Risk Management**: Configurable thresholds for market protection

## 🔒 Security Features

- **Oracle-Based Validation**: All prices validated against Chainlink oracles
- **MEV Protection**: Price deviation thresholds prevent sandwich attacks
- **Access Control**: Role-based permissions for admin functions
- **Fallback Mechanisms**: Multiple price sources for reliability

## 🧪 Testing

```bash
cd Foundry
forge test
```

## 📝 Documentation

- [Challenges Faced](./frontend/Challenges.md) - Technical challenges and solutions
- [intro.md](./intro.md) - Chinese project documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Hackathon Submission

This project is submitted for the **Chromion Chainlink Hackathon** in the **Onchain Finance** track.

### Chainlink Integration Summary

- ✅ **Chainlink Functions**: Real-time carbon price fetching
- ✅ **Chainlink Data Feeds**: EUR/USD price conversion
- ✅ **Oracle-Based Automation**: MEV protection and price validation
- ✅ **State Changes**: Smart contract state modifications based on oracle data

### Innovation Highlights

- **First large-scale individual environmental action tokenization**
- **Complete DeFi ecosystem for carbon credits**
- **MEV-aware trading with oracle protection**
- **Automated risk management through Chainlink services**

---

**Built with ❤️ for a sustainable future**
