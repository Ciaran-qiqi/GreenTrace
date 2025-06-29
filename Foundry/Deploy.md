# GreenTrace Ecosystem Deployment Information

## Deployment Overview

- **Deployment Date**: June 19, 2025
- **Network**: Sepolia Testnet
- **Deployer Address**: 0x294761C91734360C5A70e33F8372778ED2849767
- **Deployment Method**: Step-by-step deployment (DeployStepByStep.s.sol)
- **Total Gas Consumption**: 9,574,914 gas
- **Total Cost**: 0.000017442228262326 ETH

## Contract Address List

### 1. CarbonToken (Carbon Token Contract)

- **Contract Address**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **Etherscan**: [View Contract](https://sepolia.etherscan.io/address/0x808b73A3A1D97382acF32d4F4F834e799Aa08198)
- **Deployment Transaction**: `0xcb970676186faf3276dd671472b924098da0a00da5a9896c17774c62d3cbda3c`
- **Initial Supply**: 1,000,000 carbon tokens (1,000,000 * 10^18)
- **Recipient Address**: `0x294761C91734360C5A70e33F8372778ED2849767`

### 2. GreenTrace (Core Contract)

- **Contract Address**: `0x141B2c6Df6AE9863f1cD8FC4624d165209b9c18c`
- **Etherscan**: [View on Etherscan](https://sepolia.etherscan.io/address/0x141b2c6df6ae9863f1cd8fc4624d165209b9c18c)
- **Deployment Transaction**: `0x207d0680a5708c5669479662931af444a19109012c1a5ffacfd4d1fa78d92b80`
- **Carbon Token Contract**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **NFT Contract**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`

### 3. GreenTalesNFT (NFT Contract)

- **Contract Address**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- **Etherscan**: [View Contract](https://sepolia.etherscan.io/address/0x3456a42043955B1626F6353936c0FEfCd1cB5f1c)
- **Deployment Transaction**: `0xea119be0d14dc897d39aafe51ea45faabc78b8c5b2c48de5d6df988564f34a56`
- **GreenTrace Contract**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`

### 4. GreenTalesMarket (NFT Marketplace)

- **Contract Address**: `0x2661421e4e0373a06A3e705A83d1063e8F2F40EA`
- **Etherscan**: [View on Etherscan](https://sepolia.etherscan.io/address/0x2661421e4e0373a06a3e705a83d1063e8f2f40ea)
- **Deployment Transaction**: `0xe71d9e068aba8249136adba707e67d00c0dd2e4b08777fcde69a821f56cd0004`
- **NFT Contract**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- **Carbon Token Contract**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **Platform Fee Rate**: 1% (100/10000)
- **Fee Recipient Address**: `0x294761C91734360C5A70e33F8372778ED2849767`
- **GreenTrace Contract**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`

### 5. CarbonPriceOracle (Carbon Price Oracle)

- **Contract Address**: `0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA`
- **Etherscan**: [View Contract](https://sepolia.etherscan.io/address/0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA)
- **Deployment Transaction**: `0x...`
- **Main Function**: requestCarbonPrice(0x07ca5e23)

### 6. GreenTalesLiquidityPool (Liquidity Pool) - ✅ New Deployment

- **Contract Address**: `0xCfBE2B410E5707b35231B9237bD7E523403Db889`
- **Etherscan**: [View Contract](https://sepolia.etherscan.io/address/0xcfbe2b410e5707b35231b9237bd7e523403db889)
- **Deployment Transaction**: `0x087c9a580f282249ebc34836007b6774f35be03b43c868904ec8bb7197129d3a`
- **Status**: ✅ Deployed and verified
- **Initialization Status**: ✅ Initialized
- **Carbon Tokens in Pool**: 1,000 carbon tokens
- **USDT in Pool**: 88,000 USDT
- **Total LP Tokens**: 9,380,831,519,646,859,109,131
- **Current Price**: 88 USDT/carbon token

### 7. CarbonUSDTMarket (Order Book Market) - ✅ New Deployment

- **Contract Address**: `0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3`
- **Etherscan**: [View Contract](https://sepolia.etherscan.io/address/0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3)
- **Deployment Transaction**: `0xcc9fcb3b7eaca7d604a901b96f527e274335801af5d775c1c92aab35f1dee7da`
- **Block Number**: 8633747
- **Block Explorer**: [View Transaction](https://sepolia.etherscan.io/tx/0xcc9fcb3b7eaca7d604a901b96f527e274335801af5d775c1c92aab35f1dee7da)
- **Status**: ✅ Deployed and verified
- **Platform Fee Rate**: 1% (100 basis points)
- **Limit Order Listing Fee Rate**: 0.5% (50 basis points)
- **Limit Order Execution Fee Rate**: 0.3% (30 basis points)
- **Fee Recipient Address**: `0x294761C91734360C5A70e33F8372778ED2849767`

## Network Configuration

### Sepolia Testnet Addresses

- **USDT**: `0xdCdC73413C6136c9ABc3E8d250af42947aC2Fc7` (18 decimals)
- **EUR/USD Price Oracle**: `0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910`
- **Chainlink Token**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- **Functions Router**: `0xb83E47C2bC239B3bf370bc41e1459A34b41238D0`
- **DON ID**: `0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000`

## Deployment Parameters

### Initial Configuration

- **Initial Carbon Token Supply**: 1,000,000 carbon tokens
- **Initial USDT Amount**: 88,000,000 USDT (18 decimals)
- **Initial Price**: 88 USDT/carbon token
- **Market Fee Rate**: 1%
- **Liquidity Pool Fee Rate**: 0.3%
- **Price Deviation Threshold**: 10%

### Contract Initialization Status

- ✅ CarbonToken deployed and initial supply allocated
- ✅ GreenTrace deployed and carbon token contract set
- ✅ GreenTalesNFT deployed and GreenTrace address set
- ✅ Contract dependencies correctly configured
- ✅ GreenTrace initialized
- ✅ CarbonPriceOracle deployed
- ✅ GreenTalesLiquidityPool deployed and oracle set
- ✅ GreenTalesLiquidityPool liquidity initialized
- ✅ CarbonUSDTMarket deployed
- ✅ GreenTalesMarket deployed

## Contract Verification Status

All contracts verified on Etherscan:

- ✅ CarbonToken - Verified
- ✅ GreenTrace - Verified
- ✅ GreenTalesNFT - Verified
- ✅ CarbonPriceOracle - Verified
- ✅ GreenTalesLiquidityPool - Verified
- ✅ CarbonUSDTMarket - Verified
- ✅ GreenTalesMarket - Verified

## Important Notes

1. **USDT Decimals**: Sepolia testnet USDT uses 18 decimals, different from mainnet's 6 decimals
2. **Oracle Configuration**: Requires subscription ID and operator permissions setup
3. **Liquidity Initialization**: ✅ Completed, pool contains 1,000 carbon tokens and 88,000 USDT
4. **API Integration**: Oracle configured to call `https://greentrace-api.onrender.com/api/carbon-price`
5. **Price Deviation Check**: Liquidity pool has 10% price deviation threshold set

## Deployment Scripts

- **Step-by-step Deployment Script**: `script/DeployStepByStep.s.sol`
- **Remaining Contracts Deployment Script**: `script/DeployRemainingContracts.s.sol`
- **Liquidity Pool Initialization Script**: `script/InitializeLiquidityPool.s.sol`

---

*Deployment Completed: June 19, 2024*
*Deployer: 0x294761C91734360C5A70e33F8372778ED2849767*
