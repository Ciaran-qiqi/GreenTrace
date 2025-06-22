// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonUSDTMarket.sol";

/**
 * @title DeployRemainingContracts
 * @dev 部署剩余的GreenTalesLiquidityPool和CarbonUSDTMarket合约
 * @notice 基于已部署的合约地址进行部署
 */
contract DeployRemainingContracts is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    
    // 已部署的合约地址（从Deploy.md文档获取）
    address constant CARBON_TOKEN = 0x808b73A3A1D97382acF32d4F4F834e799Aa08198;
    address constant CARBON_PRICE_ORACLE = 0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA;
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== 剩余合约部署脚本 ===");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"链ID:", block.chainid);
        console.log(unicode"网络: Sepolia测试网");
        console.log("");
        
        // 显示已部署的合约地址
        console.log(unicode"已部署的合约地址:");
        console.log(unicode"CarbonToken:", CARBON_TOKEN);
        console.log(unicode"CarbonPriceOracle:", CARBON_PRICE_ORACLE);
        console.log(unicode"USDT:", SEPOLIA_USDT);
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"开始部署剩余合约...");
        
        // 1. 部署GreenTalesLiquidityPool
        console.log(unicode"1. 部署 GreenTalesLiquidityPool...");
        vm.startBroadcast(deployerPrivateKey);
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            CARBON_TOKEN,        // 碳币合约地址
            SEPOLIA_USDT         // USDT合约地址
        );
        address liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool 部署成功！地址:", liquidityPoolAddress);
        vm.stopBroadcast();
        
        // 2. 设置Pool的碳价预言机地址
        console.log(unicode"2. 设置Pool的碳价预言机地址...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setCarbonPriceOracle(CARBON_PRICE_ORACLE);
        console.log(unicode"Pool的碳价预言机地址设置成功");
        vm.stopBroadcast();
        
        // 3. 设置Pool的手续费率（可选，使用默认值0.3%）
        console.log(unicode"3. 设置Pool的手续费率...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setFeeRate(30); // 0.3%手续费率
        console.log(unicode"Pool手续费率设置成功: 0.3%");
        vm.stopBroadcast();
        
        // 4. 设置Pool的价格偏离阈值
        console.log(unicode"4. 设置Pool的价格偏离阈值...");
        vm.startBroadcast(deployerPrivateKey);
        pool.setPriceDeviationThreshold(10); // 10%偏离阈值
        console.log(unicode"Pool价格偏离阈值设置成功: 10%");
        vm.stopBroadcast();
        
        // 5. 部署CarbonUSDTMarket
        console.log(unicode"5. 部署 CarbonUSDTMarket...");
        vm.startBroadcast(deployerPrivateKey);
        CarbonUSDTMarket market = new CarbonUSDTMarket(
            CARBON_TOKEN,        // 碳币合约地址
            SEPOLIA_USDT,        // USDT合约地址
            liquidityPoolAddress, // AMM流动性池地址
            100,                 // 平台手续费率 1% (100基点)
            50,                  // 限价单挂单手续费率 0.5% (50基点)
            30,                  // 限价单成交手续费率 0.3% (30基点)
            deployer             // 手续费接收地址
        );
        address marketAddress = address(market);
        console.log(unicode"CarbonUSDTMarket 部署成功！地址:", marketAddress);
        vm.stopBroadcast();
        
        // 输出所有地址
        console.log(unicode"\n=== 部署完成！===");
        console.log(unicode"GreenTalesLiquidityPool:", liquidityPoolAddress);
        console.log(unicode"CarbonUSDTMarket:", marketAddress);
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
        console.log(unicode"2. 初始化流动性池（添加初始流动性）");
        console.log(unicode"3. 测试市价单和限价单功能");
        console.log(unicode"4. 配置预言机订阅ID和操作员权限");
        console.log(unicode"==================");
    }
} 