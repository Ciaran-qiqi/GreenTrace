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

/**
 * @title DeployStepByStep
 * @dev Step-by-step deployment script to avoid gas insufficiency
 */
contract DeployStepByStep is Script {
    // Sepolia testnet contract addresses
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // Deployment parameters
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== Step-by-Step Deployment Script ===");
        console.log(unicode"Deployer Address:", deployer);
        console.log(unicode"Chain ID:", block.chainid);
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"Starting step-by-step deployment...");
        
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
        
        // 9. Deploy GreenTalesLiquidityPool (removed USDT/USD price oracle dependency)
        console.log(unicode"9. Deploying GreenTalesLiquidityPool...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            carbonTokenAddress,
            SEPOLIA_USDT
        );
        address liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool deployed successfully! Address:", liquidityPoolAddress);
        vm.stopBroadcast();
        
        // 10. Set Pool's carbon price oracle address
        console.log(unicode"10. Setting Pool's carbon price oracle address...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setCarbonPriceOracle(carbonPriceOracleAddress);
        console.log(unicode"Pool's carbon price oracle address set successfully");
        vm.stopBroadcast();
        
        // 11. Deploy GreenTalesMarket
        console.log(unicode"11. Deploying GreenTalesMarket...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesMarket market = new GreenTalesMarket(
            nftAddress,
            carbonTokenAddress,
            100, // 1% fee rate
            deployer,
            greenTraceAddress
        );
        address marketAddress = address(market);
        console.log(unicode"GreenTalesMarket deployed successfully! Address:", marketAddress);
        vm.stopBroadcast();
        
        // Output all addresses
        console.log(unicode"\n=== Deployment Complete! ===");
        console.log(unicode"CarbonToken:", carbonTokenAddress);
        console.log(unicode"GreenTrace:", greenTraceAddress);
        console.log(unicode"GreenTalesNFT:", nftAddress);
        console.log(unicode"CarbonPriceOracle:", carbonPriceOracleAddress);
        console.log(unicode"GreenTalesLiquidityPool:", liquidityPoolAddress);
        console.log(unicode"GreenTalesMarket:", marketAddress);
        console.log(unicode"==================");
    }
} 