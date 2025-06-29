// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "../src/GreenTalesMarket.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonPriceOracle.sol";
import "../src/CarbonUSDTMarket.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title Deploy
 * @dev Complete deployment script, deploys all contracts at once
 * @notice Includes deployment, configuration and initialization of all contracts
 */
contract Deploy is Script {
    // Sepolia testnet contract addresses
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // Deployment parameters
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 1_000 * 1e18; // 1000 carbon tokens
    uint256 public constant INITIAL_LIQUIDITY_USDT = 88_000 * 1e18;  // 88000 USDT
    
    // Oracle configuration
    uint64 constant SUBSCRIPTION_ID = 5045;
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== GreenTrace Complete Deployment Script ===");
        console.log(unicode"Deployer address:", deployer);
        console.log(unicode"Chain ID:", block.chainid);
        console.log(unicode"Network: Sepolia Testnet");
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"Starting complete deployment...");
        
        // ============ Phase 1: Core Contract Deployment ============
        console.log(unicode"\n=== Phase 1: Core Contract Deployment ===");
        
        // 1. Deploy CarbonToken
        console.log(unicode"1. Deploying CarbonToken...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance({
            to: deployer,
            amount: INITIAL_CARBON_SUPPLY
        });
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        address carbonTokenAddress = address(carbonToken);
        console.log(unicode"CarbonToken deployed successfully! Address:", carbonTokenAddress);
        vm.stopBroadcast();
        
        // 2. Deploy GreenTrace
        console.log(unicode"2. Deploying GreenTrace...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTrace greenTrace = new GreenTrace(carbonTokenAddress, address(0));
        address greenTraceAddress = address(greenTrace);
        console.log(unicode"GreenTrace deployed successfully! Address:", greenTraceAddress);
        vm.stopBroadcast();
        
        // 3. Deploy GreenTalesNFT
        console.log(unicode"3. Deploying GreenTalesNFT...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesNFT nft = new GreenTalesNFT(greenTraceAddress);
        address nftAddress = address(nft);
        console.log(unicode"GreenTalesNFT deployed successfully! Address:", nftAddress);
        vm.stopBroadcast();
        
        // ============ Phase 2: Contract Dependency Configuration ============
        console.log(unicode"\n=== Phase 2: Contract Dependency Configuration ===");
        
        // 4. Set NFT's GreenTrace address
        console.log(unicode"4. Setting NFT's GreenTrace address...");
        vm.startBroadcast(deployerPrivateKey);
        nft.setGreenTrace(greenTraceAddress);
        console.log(unicode"NFT's GreenTrace address set successfully");
        vm.stopBroadcast();
        
        // 5. Set CarbonToken's GreenTrace address
        console.log(unicode"5. Setting CarbonToken's GreenTrace address...");
        vm.startBroadcast(deployerPrivateKey);
        carbonToken.setGreenTrace(greenTraceAddress);
        console.log(unicode"CarbonToken's GreenTrace address set successfully");
        vm.stopBroadcast();
        
        // 6. Set GreenTrace's NFT address
        console.log(unicode"6. Setting GreenTrace's NFT address...");
        vm.startBroadcast(deployerPrivateKey);
        greenTrace.setNFTContract(nftAddress);
        console.log(unicode"GreenTrace's NFT address set successfully");
        vm.stopBroadcast();
        
        // 7. Initialize GreenTrace
        console.log(unicode"7. Initializing GreenTrace...");
        vm.startBroadcast(deployerPrivateKey);
        greenTrace.initialize();
        console.log(unicode"GreenTrace initialized successfully");
        vm.stopBroadcast();
        
        // ============ Phase 3: Oracle and Liquidity Pool Deployment ============
        console.log(unicode"\n=== Phase 3: Oracle and Liquidity Pool Deployment ===");
        
        // 8. Deploy CarbonPriceOracle
        console.log(unicode"8. Deploying CarbonPriceOracle...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonPriceOracle oracle = new CarbonPriceOracle(
            SEPOLIA_FUNCTIONS_ROUTER,
            SEPOLIA_DON_ID,
            SEPOLIA_EUR_USD_FEED,
            SEPOLIA_CHAINLINK_TOKEN
        );
        address carbonPriceOracleAddress = address(oracle);
        console.log(unicode"CarbonPriceOracle deployed successfully! Address:", carbonPriceOracleAddress);
        vm.stopBroadcast();
        
        // 9. Configure oracle
        console.log(unicode"9. Configuring oracle...");
        vm.startBroadcast(deployerPrivateKey);
        oracle.setSubscriptionId(SUBSCRIPTION_ID);
        oracle.addOperator(deployer);
        console.log(unicode"Oracle configured successfully - Subscription ID:", SUBSCRIPTION_ID);
        vm.stopBroadcast();
        
        // 10. Deploy GreenTalesLiquidityPool
        console.log(unicode"10. Deploying GreenTalesLiquidityPool...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            carbonTokenAddress,
            SEPOLIA_USDT
        );
        address liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool deployed successfully! Address:", liquidityPoolAddress);
        vm.stopBroadcast();
        
        // 11. Configure liquidity pool
        console.log(unicode"11. Configuring liquidity pool...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setCarbonPriceOracle(carbonPriceOracleAddress);
        pool.setFeeRate(30); // 0.3% fee rate
        pool.setPriceDeviationThreshold(10); // 10% deviation threshold
        console.log(unicode"Liquidity pool configured successfully");
        vm.stopBroadcast();
        
        // ============ Phase 4: Market Contract Deployment ============
        console.log(unicode"\n=== Phase 4: Market Contract Deployment ===");
        
        // 12. Deploy GreenTalesMarket (NFT Market)
        console.log(unicode"12. Deploying GreenTalesMarket...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesMarket nftMarket = new GreenTalesMarket(
            nftAddress,
            carbonTokenAddress,
            100, // 1% fee rate
            deployer,
            greenTraceAddress
        );
        address nftMarketAddress = address(nftMarket);
        console.log(unicode"GreenTalesMarket deployed successfully! Address:", nftMarketAddress);
        vm.stopBroadcast();
        
        // 13. Deploy CarbonUSDTMarket (Order Book Market)
        console.log(unicode"13. Deploying CarbonUSDTMarket...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonUSDTMarket usdtMarket = new CarbonUSDTMarket(
            carbonTokenAddress,
            SEPOLIA_USDT,
            liquidityPoolAddress,
            carbonPriceOracleAddress,
            deployer
        );
        address usdtMarketAddress = address(usdtMarket);
        console.log(unicode"CarbonUSDTMarket deployed successfully! Address:", usdtMarketAddress);
        vm.stopBroadcast();
        
        // ============ Phase 5: Liquidity Initialization ============
        console.log(unicode"\n=== Phase 5: Liquidity Initialization ===");
        
        // 14. Approve tokens to liquidity pool
        console.log(unicode"14. Approving tokens to liquidity pool...");
        vm.startBroadcast(deployerPrivateKey);
        carbonToken.approve(liquidityPoolAddress, INITIAL_LIQUIDITY_CARBON);
        IERC20(SEPOLIA_USDT).approve(liquidityPoolAddress, INITIAL_LIQUIDITY_USDT);
        console.log(unicode"Token approval successful");
        vm.stopBroadcast();
        
        // ============ Deployment Completion Summary ============
        console.log(unicode"\n=== Deployment Complete! ===");
        console.log(unicode"All contract addresses:");
        console.log(unicode"CarbonToken:", carbonTokenAddress);
        console.log(unicode"GreenTrace:", greenTraceAddress);
        console.log(unicode"GreenTalesNFT:", nftAddress);
        console.log(unicode"CarbonPriceOracle:", carbonPriceOracleAddress);
        console.log(unicode"GreenTalesLiquidityPool:", liquidityPoolAddress);
        console.log(unicode"GreenTalesMarket:", nftMarketAddress);
        console.log(unicode"CarbonUSDTMarket:", usdtMarketAddress);
        console.log(unicode"==================");
        
        console.log(unicode"\n=== Contract Functionality Description ===");
        console.log(unicode"GreenTalesLiquidityPool:");
        console.log(unicode"  - Add liquidity: addLiquidity()");
        console.log(unicode"  - Remove liquidity: removeLiquidity()");
        console.log(unicode"  - Carbon token to USDT swap: swapCarbonToUsdt()");
        console.log(unicode"  - USDT to carbon token swap: swapUsdtToCarbon()");
        console.log(unicode"  - Price deviation check: based on oracle price");
        console.log(unicode"  - Fee rate: 0.3%");
        console.log(unicode"");
        console.log(unicode"CarbonUSDTMarket:");
        console.log(unicode"  - Market buy: marketBuy()");
        console.log(unicode"  - Market sell: marketSell()");
        console.log(unicode"  - Limit buy order: createBuyOrder()");
        console.log(unicode"  - Limit sell order: createSellOrder()");
        console.log(unicode"  - Filled order: fillOrder()");
        console.log(unicode"  - Canceled order: cancelOrder()");
        console.log(unicode"  - Integrated with AMM pool: Market order directly calls pool");
        console.log(unicode"==================");
        
        console.log(unicode"\n=== Next Steps ===");
        console.log(unicode"1. Verify contract code on Etherscan");
        console.log(unicode"2. Test market order and limit order functionality");
        console.log(unicode"3. Test oracle price update");
        console.log(unicode"4. Configure oracle subscription ID and operator permissions");
        console.log(unicode"==================");
    }
} 