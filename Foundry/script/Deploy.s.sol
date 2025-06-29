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
 * @dev 完整部署脚本，一次性部署所有合约
 * @notice 包含所有合约的部署、配置和初始化
 */
contract Deploy is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // 部署参数
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 1_000 * 1e18; // 1000 碳币
    uint256 public constant INITIAL_LIQUIDITY_USDT = 88_000 * 1e18;  // 88000 USDT
    
    // 预言机配置
    uint64 constant SUBSCRIPTION_ID = 5045;
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== GreenTrace 完整部署脚本 ===");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"链ID:", block.chainid);
        console.log(unicode"网络: Sepolia测试网");
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"开始完整部署...");
        
        // ============ 第一阶段：核心合约部署 ============
        console.log(unicode"\n=== 第一阶段：核心合约部署 ===");
        
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
        
        // ============ 第二阶段：合约间依赖配置 ============
        console.log(unicode"\n=== 第二阶段：合约间依赖配置 ===");
        
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
        
        // ============ 第三阶段：预言机和流动性池部署 ============
        console.log(unicode"\n=== 第三阶段：预言机和流动性池部署 ===");
        
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
        
        // 9. 配置预言机
        console.log(unicode"9. 配置预言机...");
        vm.startBroadcast(deployerPrivateKey);
        oracle.setSubscriptionId(SUBSCRIPTION_ID);
        oracle.addOperator(deployer);
        console.log(unicode"预言机配置成功 - 订阅ID:", SUBSCRIPTION_ID);
        vm.stopBroadcast();
        
        // 10. 部署GreenTalesLiquidityPool
        console.log(unicode"10. 部署 GreenTalesLiquidityPool...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            carbonTokenAddress,
            SEPOLIA_USDT
        );
        address liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool 部署成功！地址:", liquidityPoolAddress);
        vm.stopBroadcast();
        
        // 11. 配置流动性池
        console.log(unicode"11. 配置流动性池...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setCarbonPriceOracle(carbonPriceOracleAddress);
        pool.setFeeRate(30); // 0.3%手续费率
        pool.setPriceDeviationThreshold(10); // 10%偏离阈值
        console.log(unicode"流动性池配置成功");
        vm.stopBroadcast();
        
        // ============ 第四阶段：市场合约部署 ============
        console.log(unicode"\n=== 第四阶段：市场合约部署 ===");
        
        // 12. 部署GreenTalesMarket (NFT市场)
        console.log(unicode"12. 部署 GreenTalesMarket...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesMarket nftMarket = new GreenTalesMarket(
            nftAddress,
            carbonTokenAddress,
            100, // 1%手续费率
            deployer,
            greenTraceAddress
        );
        address nftMarketAddress = address(nftMarket);
        console.log(unicode"GreenTalesMarket 部署成功！地址:", nftMarketAddress);
        vm.stopBroadcast();
        
        // 13. 部署CarbonUSDTMarket (订单簿市场)
        console.log(unicode"13. 部署 CarbonUSDTMarket...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonUSDTMarket usdtMarket = new CarbonUSDTMarket(
            carbonTokenAddress,
            SEPOLIA_USDT,
            liquidityPoolAddress,
            carbonPriceOracleAddress,
            deployer
        );
        address usdtMarketAddress = address(usdtMarket);
        console.log(unicode"CarbonUSDTMarket 部署成功！地址:", usdtMarketAddress);
        vm.stopBroadcast();
        
        // ============ 第五阶段：流动性初始化 ============
        console.log(unicode"\n=== 第五阶段：流动性初始化 ===");
        
        // 14. 授权代币给流动性池
        console.log(unicode"14. 授权代币给流动性池...");
        vm.startBroadcast(deployerPrivateKey);
        carbonToken.approve(liquidityPoolAddress, INITIAL_LIQUIDITY_CARBON);
        IERC20(SEPOLIA_USDT).approve(liquidityPoolAddress, INITIAL_LIQUIDITY_USDT);
        console.log(unicode"代币授权成功");
        vm.stopBroadcast();
        
        // 15. 添加初始流动性
        console.log(unicode"15. 添加初始流动性...");
        vm.startBroadcast(deployerPrivateKey);
        uint256 lpTokens = pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        console.log(unicode"初始流动性添加成功！获得LP代币:", lpTokens);
        vm.stopBroadcast();
        
        // ============ 部署完成总结 ============
        console.log(unicode"\n=== 部署完成！===");
        console.log(unicode"所有合约地址:");
        console.log(unicode"CarbonToken:", carbonTokenAddress);
        console.log(unicode"GreenTrace:", greenTraceAddress);
        console.log(unicode"GreenTalesNFT:", nftAddress);
        console.log(unicode"CarbonPriceOracle:", carbonPriceOracleAddress);
        console.log(unicode"GreenTalesLiquidityPool:", liquidityPoolAddress);
        console.log(unicode"GreenTalesMarket:", nftMarketAddress);
        console.log(unicode"CarbonUSDTMarket:", usdtMarketAddress);
        console.log(unicode"==================");
        
        console.log(unicode"\n=== 合约功能说明 ===");
        console.log(unicode"GreenTalesLiquidityPool:");
        console.log(unicode"  - 添加流动性: addLiquidity()");
        console.log(unicode"  - 移除流动性: removeLiquidity()");
        console.log(unicode"  - 碳币兑换USDT: swapCarbonToUsdt()");
        console.log(unicode"  - USDT兑换碳币: swapUsdtToCarbon()");
        console.log(unicode"  - 价格偏离检查: 基于预言机价格");
        console.log(unicode"  - 手续费率: 0.3%");
        console.log(unicode"");
        console.log(unicode"CarbonUSDTMarket:");
        console.log(unicode"  - 市价买单: marketBuy()");
        console.log(unicode"  - 市价卖单: marketSell()");
        console.log(unicode"  - 限价买单: createBuyOrder()");
        console.log(unicode"  - 限价卖单: createSellOrder()");
        console.log(unicode"  - 成交订单: fillOrder()");
        console.log(unicode"  - 取消订单: cancelOrder()");
        console.log(unicode"  - 与AMM池集成: 市价单直接调用池子");
        console.log(unicode"==================");
        
        console.log(unicode"\n=== 下一步操作 ===");
        console.log(unicode"1. 验证合约代码到Etherscan");
        console.log(unicode"2. 测试市价单和限价单功能");
        console.log(unicode"3. 测试预言机价格更新");
        console.log(unicode"4. 配置预言机订阅ID和操作员权限");
        console.log(unicode"==================");
    }
} 