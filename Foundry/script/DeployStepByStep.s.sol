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
 * @dev 分步部署脚本，避免gas不足
 */
contract DeployStepByStep is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // 部署参数
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== 分步部署脚本 ===");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"链ID:", block.chainid);
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"开始分步部署...");
        
        // 1. 部署CarbonToken
        console.log(unicode"1. 部署 CarbonToken...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance({
            to: deployer,
            amount: INITIAL_CARBON_SUPPLY
        });
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        address carbonTokenAddress = address(carbonToken);
        console.log(unicode"CarbonToken 部署成功！地址:", carbonTokenAddress);
        vm.stopBroadcast();
        
        // 2. 部署GreenTrace
        console.log(unicode"2. 部署 GreenTrace...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTrace greenTrace = new GreenTrace(carbonTokenAddress, address(0));
        address greenTraceAddress = address(greenTrace);
        console.log(unicode"GreenTrace 部署成功！地址:", greenTraceAddress);
        vm.stopBroadcast();
        
        // 3. 部署GreenTalesNFT
        console.log(unicode"3. 部署 GreenTalesNFT...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesNFT nft = new GreenTalesNFT(greenTraceAddress);
        address nftAddress = address(nft);
        console.log(unicode"GreenTalesNFT 部署成功！地址:", nftAddress);
        vm.stopBroadcast();
        
        // 4. 设置NFT的GreenTrace地址
        console.log(unicode"4. 设置NFT的GreenTrace地址...");
        vm.startBroadcast(deployerPrivateKey);
        nft.setGreenTrace(greenTraceAddress);
        console.log(unicode"NFT的GreenTrace地址设置成功");
        vm.stopBroadcast();
        
        // 5. 设置CarbonToken的GreenTrace地址
        console.log(unicode"5. 设置CarbonToken的GreenTrace地址...");
        vm.startBroadcast(deployerPrivateKey);
        carbonToken.setGreenTrace(greenTraceAddress);
        console.log(unicode"CarbonToken的GreenTrace地址设置成功");
        vm.stopBroadcast();
        
        // 6. 设置GreenTrace的NFT地址
        console.log(unicode"6. 设置GreenTrace的NFT地址...");
        vm.startBroadcast(deployerPrivateKey);
        greenTrace.setNFTContract(nftAddress);
        console.log(unicode"GreenTrace的NFT地址设置成功");
        vm.stopBroadcast();
        
        // 7. 初始化GreenTrace
        console.log(unicode"7. 初始化GreenTrace...");
        vm.startBroadcast(deployerPrivateKey);
        greenTrace.initialize();
        console.log(unicode"GreenTrace初始化成功");
        vm.stopBroadcast();
        
        // 8. 部署CarbonPriceOracle
        console.log(unicode"8. 部署 CarbonPriceOracle...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonPriceOracle oracle = new CarbonPriceOracle(
            SEPOLIA_FUNCTIONS_ROUTER,
            SEPOLIA_DON_ID,
            SEPOLIA_EUR_USD_FEED,
            SEPOLIA_CHAINLINK_TOKEN
        );
        address carbonPriceOracleAddress = address(oracle);
        console.log(unicode"CarbonPriceOracle 部署成功！地址:", carbonPriceOracleAddress);
        vm.stopBroadcast();
        
        // 9. 部署GreenTalesLiquidityPool
        console.log(unicode"9. 部署 GreenTalesLiquidityPool...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            carbonTokenAddress,
            SEPOLIA_USDT,
            address(0)
        );
        address liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool 部署成功！地址:", liquidityPoolAddress);
        vm.stopBroadcast();
        
        // 10. 部署GreenTalesMarket
        console.log(unicode"10. 部署 GreenTalesMarket...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesMarket market = new GreenTalesMarket(
            nftAddress,
            carbonTokenAddress,
            100, // 1%手续费率
            deployer,
            greenTraceAddress
        );
        address marketAddress = address(market);
        console.log(unicode"GreenTalesMarket 部署成功！地址:", marketAddress);
        vm.stopBroadcast();
        
        // 输出所有地址
        console.log(unicode"\n=== 部署完成！===");
        console.log(unicode"CarbonToken:", carbonTokenAddress);
        console.log(unicode"GreenTrace:", greenTraceAddress);
        console.log(unicode"GreenTalesNFT:", nftAddress);
        console.log(unicode"CarbonPriceOracle:", carbonPriceOracleAddress);
        console.log(unicode"GreenTalesLiquidityPool:", liquidityPoolAddress);
        console.log(unicode"GreenTalesMarket:", marketAddress);
        console.log(unicode"==================");
    }
} 