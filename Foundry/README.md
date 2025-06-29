# GreenTrace Project

## Project Overview

GreenTrace is a blockchain-based carbon reduction platform that enables tracking and trading of carbon credits through NFTs and carbon tokens. The project leverages Chainlink's decentralized oracle network to ensure real-time, accurate carbon price data and secure smart contract execution.

## Core Contracts

### CarbonToken (Carbon Token Contract)

- **Standard**: ERC20
- **Purpose**: Represents audited carbon reduction credits
- **Key Features**:
  - Mintable by authorized contracts (GreenTrace)
  - Burnable by users
  - Transferable between users
  - Used as the primary trading currency for carbon credits

### GreenTalesNFT (Carbon Credit NFT Contract)

- **Standard**: ERC721
- **Purpose**: Records and tracks carbon reduction projects
- **Key Features**:
  - Unique NFTs representing specific carbon reduction projects
  - Metadata includes project details, carbon reduction amount, and audit information
  - Can be redeemed for carbon tokens after audit completion
  - Supports trading on NFT marketplace

### GreenTrace (Core Management Contract)

- **Purpose**: Main contract responsible for project auditing, NFT redemption, and fee distribution
- **Key Features**:
  - Manages auditor permissions and project submissions
  - Handles NFT to carbon token conversion
  - Distributes fees (system fees, audit fees, redemption amounts)
  - Controls carbon token minting permissions

### CarbonPriceOracle (Price Oracle Contract)

- **Purpose**: Provides real-time carbon price data using Chainlink Functions
- **Key Features**:
  - Fetches live carbon prices from TradingEconomics API
  - Converts EUR prices to USD using EUR/USD price feeds
  - Updates carbon token pricing based on market data
  - Ensures decentralized and reliable price information

### GreenTalesMarket (NFT Marketplace)

- **Purpose**: Facilitates trading of carbon credit NFTs
- **Key Features**:
  - List and buy carbon credit NFTs
  - Platform fee collection (1%)
  - Integration with carbon token payments
  - Secure escrow system for transactions

### GreenTalesLiquidityPool (Liquidity Pool)

- **Purpose**: Provides liquidity for carbon token trading
- **Key Features**:
  - Automated market maker (AMM) functionality
  - Carbon token and USDT trading pairs
  - Liquidity provider rewards
  - Price discovery mechanism

### CarbonUSDTMarket (Order Book Market)

- **Purpose**: Advanced trading platform for carbon tokens
- **Key Features**:
  - Limit order functionality
  - Market order execution
  - Order book management
  - Advanced fee structure (listing fees, execution fees)

## Key Features

1. **Carbon Credit Generation**: Convert NFTs to carbon tokens based on audit results
2. **NFT Redemption**: Redeem NFTs for carbon tokens with fee distribution
3. **Audit Management**: Add/remove auditors, submit and complete audits
4. **Trading Infrastructure**: Multiple trading venues (NFT marketplace, liquidity pool, order book)
5. **Real-time Pricing**: Chainlink-powered carbon price feeds
6. **Decentralized Governance**: Transparent fee distribution and access control

## Testing Steps

1. **Install Dependencies**:

   ```bash
   forge install
   ```
2. **Compile Contracts**:

   ```bash
   forge build --via-ir --optimize
   ```
3. **Run Tests**:

   ```bash
   # Test CarbonToken functionality
   forge test --match-path test/CarbonToken.t.sol -vvv --via-ir --optimize

   # Test GreenTrace core functionality
   forge test --match-path test/GreenTrace.t.sol -vvv --via-ir --optimize

   # Test NFT functionality
   forge test --match-path test/GreenTalesNFT.t.sol -vvv --via-ir --optimize

   # Test complete market functionality
   forge test --match-path test/CarbonUSDTMarketComplete.t.sol -vvv --via-ir --optimize
   ```

## Deployment Steps

1. **Set Environment Variables**:
   Create a `.env` file in the project root with:

   ```
   PRIVATE_KEY=your_private_key
   RPC_URL=your_rpc_url
   ```
2. **Deploy Step by Step**:

   ```bash
   # Deploy core contracts
   forge script script/DeployStepByStep.s.sol --rpc-url $RPC_URL --broadcast

   # Deploy remaining contracts
   forge script script/DeployRemainingContracts.s.sol --rpc-url $RPC_URL --broadcast

   # Initialize liquidity pool
   forge script script/InitializeLiquidityPool.s.sol --rpc-url $RPC_URL --broadcast
   ```
3. **Verify Contracts**:

   ```bash
   forge verify-contract <contract_address> <contract_name> --chain-id <chain_id>
   ```

## Important Notes

- Ensure CarbonToken owner is set to GreenTrace contract before transferring ownership
- Verify all contract permissions and business logic during testing
- Set up Chainlink Functions subscription and operator permissions for oracle functionality
- Initialize liquidity pool with appropriate token amounts for market stability

## Architecture Benefits

- **Modular Design**: Each contract has a specific responsibility
- **Security**: Role-based access control and comprehensive testing
- **Scalability**: Upgradeable contracts and extensible architecture
- **Interoperability**: Standard ERC20/ERC721 compliance
- **Transparency**: On-chain audit trails and fee distribution

## Contributing

We welcome contributions! Please submit issues and pull requests to help improve the GreenTrace project.

## License

This project is licensed under the MIT License.
