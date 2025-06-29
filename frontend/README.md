# GreenTrace - Carbon Credit NFT Ecosystem - Feature Documentation

## 📋 Project Overview

**GreenTrace** is a blockchain-based carbon credit NFT ecosystem designed to transform users' environmental actions into valuable digital assets by recording their green behaviors. The project adopts a decentralized approach, ensuring data transparency and credibility through smart contracts, providing users with environmental incentives and carbon credit trading platforms.

### 🌟 Core Values
- **Environmental Incentives**: Encourage users to participate in environmental behaviors and earn carbon credit rewards
- **Data Transparency**: Based on blockchain technology, ensuring the immutability of environmental data
- **Value Realization**: Transform environmental actions into tradable digital assets
- **Community Building**: Build a green environmental Web3 community

## 🏗️ Technical Architecture

### Frontend Technology Stack
- **Framework**: Next.js 15.3.4 + React 19
- **Web3 Integration**: Wagmi + RainbowKit + Ethers.js
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript
- **State Management**: TanStack React Query
- **Internationalization**: Support for Chinese and English bilingual

### Smart Contract Architecture
- **GreenTrace**: Core management contract, responsible for ecosystem management
- **CarbonToken**: Carbon credit token contract, ERC20 standard
- **GreenTalesNFT**: NFT contract, ERC721 standard
- **Market**: NFT trading market contract
- **CarbonPriceOracle**: Carbon price oracle contract
- **GreenTalesLiquidityPool**: Liquidity pool contract
- **CarbonUSDTMarket**: Order book market contract

### Supported Networks
- **Sepolia Testnet**: Main development and testing environment
- **Ethereum Mainnet**: Production environment
- **Local Foundry Testnet**: Local development environment

## 👥 User Permission System

### 1. Regular User (Visitor)
**Permission Scope**:
- Browse homepage and project introduction
- View carbon coin market trends
- View NFT marketplace
- View liquidity pool information

**Feature Access**:
- 🏠 Homepage
- 📈 Carbon Market
- 💧 Liquidity Pool
- 🛒 NFT Marketplace

### 2. Registered User (Connected User)
**Permission Scope**:
- All regular user permissions
- Create green NFTs
- Manage personal assets
- Participate in NFT trading
- Apply for NFT exchange

**Feature Access**:
- 🌱 NFT Creation
- 💼 My Assets
- 🏪 My Listings
- 🔄 NFT Exchange

### 3. Auditor
**Permission Scope**:
- All registered user permissions
- Review NFT creation applications
- Review NFT exchange applications
- View audit data

**Feature Access**:
- 🔍 Audit Center

### 4. Administrator (Admin)
**Permission Scope**:
- All auditor permissions
- System data statistics
- Auditor management
- Contract management
- System settings

**Feature Access**:
- ⚙️ Management Center

## 🎯 Core Feature Modules

### 1. 🌱 NFT Creation Module
**Feature Description**: Users record environmental behaviors to create green NFTs

**Main Features**:
- Environmental behavior recording (transportation methods, energy usage, waste disposal, etc.)
- NFT metadata generation
- Request fee payment
- Creation status tracking

**Usage Process**:
1. Connect wallet
2. Fill in environmental behavior information
3. Upload relevant supporting materials
4. Pay carbon token request fees
5. Submit review application
6. Wait for auditor review

**Technical Implementation**:
- Use IPFS to store NFT metadata
- Smart contract management of creation requests
- Multi-language form validation

### 2. 🔍 Audit Center Module
**Feature Description**: Professional auditors verify the authenticity of environmental behaviors

**Main Features**:
- Pending review application list
- Application detail viewing
- Review result submission
- Review history records

**Review Process**:
1. View pending review applications
2. Review submitted materials
3. Verify authenticity of environmental behaviors
4. Submit review results (approve/reject)
5. Record review comments

**Permission Control**:
- Only authorized auditors can access
- Review results cannot be tampered with
- Review records permanently saved

### 3. 🏪 NFT Trading Marketplace Module
**Feature Description**: Provide NFT display, search, purchase, and sale functions

**Main Features**:
- NFT grid display
- Advanced search and filtering
- Price sorting functionality
- Purchase and sale operations
- Transaction history records

**Market Features**:
- Real-time price updates
- 1% transaction fee
- Batch operation support
- Transaction status tracking

**Filtering Features**:
- Filter by price range
- Sort by creation time
- Sort by carbon reduction amount
- Keyword search

### 4. 💰 Carbon Coin Trading Market Module
**Feature Description**: Provide market order and limit order trading for carbon tokens

**Main Features**:
- Real-time price display
- Market order trading
- Limit order trading
- Order book display
- Transaction history

**Trading Types**:
- **Market Order**: Execute immediately at current market price
- **Limit Order**: Trade at specified price
- **Order Management**: View and manage personal orders

**Market Features**:
- Smart matching engine
- Price protection mechanism
- 0.3% transaction fee
- 0.5% order placement fee

### 5. 💧 Liquidity Pool Module
**Feature Description**: Provide liquidity trading for carbon tokens and USDT

**Main Features**:
- Liquidity addition
- Liquidity removal
- Profit calculation
- Pool status display

**Liquidity Management**:
- Add carbon tokens and USDT to receive LP tokens
- Remove liquidity to receive corresponding tokens
- Earn trading fee profits
- Real-time profit calculation

**Risk Warnings**:
- Impermanent loss risk
- Liquidity provider profits
- Pool depth display

### 6. 🔄 NFT Exchange Module
**Feature Description**: Exchange approved NFTs for carbon tokens

**Main Features**:
- Exchangeable NFT list
- Exchange application submission
- Exchange status tracking
- Exchange history records

**Exchange Process**:
1. View exchangeable NFTs
2. Select NFTs to exchange
3. Submit exchange application
4. Wait for auditor review
5. Receive carbon tokens after approval

**Exchange Rules**:
- Only approved NFTs can be exchanged
- Exchange ratio calculated based on carbon reduction amount
- Exchange fees required

### 7. 💼 Asset Management Module
**Feature Description**: Manage user's NFT and carbon token assets

**Main Features**:
- NFT asset display
- Carbon token balance display
- Asset transfer functionality
- Transaction history records

**Asset Types**:
- **NFT Assets**: Green NFTs created by users
- **Carbon Tokens**: Carbon credit token balance
- **LP Tokens**: Liquidity provider tokens

### 8. ⚙️ Management Center Module
**Feature Description**: System management and data analysis (administrators only)

**Main Features**:
- **Data Statistics**: System-wide data overview
- **Auditor Management**: Add/remove auditors
- **Audit Data Management**: View all audit records
- **Contract Management**: Contract parameter configuration
- **System Settings**: System-level configuration

**Management Functions**:
- User permission management
- System parameter adjustment
- Data statistical analysis
- Contract upgrade management

## 🔄 Complete Business Processes

### 1. User Registration Process
1. Visit GreenTrace website
2. Connect Web3 wallet (MetaMask, etc.)
3. Authorize application to access wallet
4. Complete user registration

### 2. NFT Creation Process
1. **Behavior Recording**: User records environmental behavior
2. **Material Submission**: Upload relevant supporting materials
3. **Fee Payment**: Use carbon tokens to pay request fees
4. **Application Submission**: Submit NFT creation application
5. **Wait for Review**: Wait for auditor review
6. **Review Result**: Receive review result
7. **NFT Minting**: Automatically mint NFT after approval

### 3. NFT Trading Process
1. **Market Browsing**: Browse purchasable NFTs in NFT marketplace
2. **NFT Selection**: Select desired NFT
3. **Price Confirmation**: Confirm purchase price
4. **Transaction Execution**: Execute purchase transaction
5. **NFT Acquisition**: Receive purchased NFT
6. **Transaction Record**: Record transaction history

### 4. Carbon Token Trading Process
1. **Market Entry**: Enter carbon coin trading market
2. **Order Type Selection**: Choose market order or limit order
3. **Trading Parameter Setting**: Set trading quantity and price
4. **Order Submission**: Submit trading order
5. **Order Matching**: Wait for order matching
6. **Transaction Completion**: Complete transaction and receive tokens

### 5. NFT Exchange Process
1. **NFT Viewing**: View exchangeable NFTs
2. **Exchange Application**: Submit exchange application
3. **Wait for Review**: Wait for auditor review
4. **Approval**: Receive carbon tokens after approval
5. **Asset Update**: Update user asset balance

## 🛡️ Security Features

### 1. Smart Contract Security
- Multi-signature wallet support
- Permission control mechanism
- Emergency pause functionality
- Contract upgrade mechanism

### 2. Data Security
- IPFS distributed storage
- Encrypted data transmission
- Privacy protection mechanism
- Audit log recording

### 3. User Security
- Secure wallet connection
- Transaction confirmation mechanism
- Error handling mechanism
- Network status monitoring

## 📊 Data Statistics

### System Metrics
- Total NFT count
- Total carbon reduction amount
- Active user count
- Trading volume statistics

### User Metrics
- Personal NFT count
- Carbon token balance
- Transaction history
- Profit statistics

## 🔧 Technical Features

### 1. Responsive Design
- Support for desktop and mobile
- Adaptive layout
- Touch-friendly interface

### 2. Performance Optimization
- Code splitting
- Image optimization
- Caching strategy
- Lazy loading

### 3. User Experience
- Loading status indicators
- Error handling mechanism
- Operation confirmation dialogs
- Success feedback prompts

### 4. Internationalization Support
- Chinese and English bilingual support
- Dynamic language switching
- Localized content
- Cultural adaptation

## 🚀 Deployment and Operations

### Development Environment
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production version
npm run build

# Start production server
npm start
```

### Environment Configuration
- Configure Web3 wallet connection
- Set smart contract addresses
- Configure IPFS nodes
- Set environment variables

### Monitoring and Maintenance
- Error log monitoring
- Performance metrics monitoring
- User behavior analysis
- System health checks

## 📞 Technical Support

### Documentation Resources
- User manual
- Developer documentation
- API interface documentation
- Smart contract documentation

### Community Support
- Discord community
- GitHub Issues
- Technical support email
- Online help center

---

*Document Version: v1.0*  
*Last Updated: June 2025*  
*Project URL: https://github.com/greentrace/frontend*
