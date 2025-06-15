// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonToken.sol";
import "../src/CarbonUSDTMarket.sol";
import "../src/GreenTalesLiquidityPool.sol";

/**
 * @title DeployMarket
 * @dev 部署碳币交易市场和流动性池的脚本
 * 
 * 部署流程：
 * 1. 部署CarbonToken合约
 * 2. 部署CarbonUSDTMarket合约
 * 3. 部署GreenTalesLiquidityPool合约
 * 4. 初始化流动性池
 */
contract DeployMarket is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant SEPOLIA_USDT_USD_FEED = 0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43;
    
    // 初始流动性配置
    uint256 constant INITIAL_CARBON_AMOUNT = 1_000_000 * 1e18;  // 100万碳币
    uint256 constant INITIAL_USDT_AMOUNT = 100_000 * 1e6;       // 10万USDT
    uint256 constant INITIAL_PRICE = 0.1 * 1e6;                 // 0.1 USDT/碳币
    
    // 平台手续费配置
    uint256 constant PLATFORM_FEE_RATE = 100;                   // 1%手续费率
    uint256 constant POOL_FEE_RATE = 30;                        // 0.3%手续费率

    function run() external {
        // 获取部署者私钥
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // 开始广播交易
        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署CarbonToken合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance({
            to: deployer,
            amount: INITIAL_CARBON_AMOUNT
        });
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        console.log("CarbonToken deployed at:", address(carbonToken));

        // 2. 部署CarbonUSDTMarket合约
        CarbonUSDTMarket market = new CarbonUSDTMarket(
            address(carbonToken),
            SEPOLIA_USDT,
            PLATFORM_FEE_RATE,
            deployer  // 手续费接收地址设置为部署者
        );
        console.log("CarbonUSDTMarket deployed at:", address(market));

        // 3. 部署GreenTalesLiquidityPool合约
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            address(carbonToken),
            SEPOLIA_USDT,
            SEPOLIA_USDT_USD_FEED
        );
        console.log("GreenTalesLiquidityPool deployed at:", address(pool));

        // 4. 初始化流动性池
        // 4.1 授权市场合约使用碳币
        carbonToken.approve(address(market), INITIAL_CARBON_AMOUNT);
        carbonToken.approve(address(pool), INITIAL_CARBON_AMOUNT);

        // 4.2 创建初始卖单
        market.createSellOrder(INITIAL_CARBON_AMOUNT, INITIAL_PRICE);
        console.log("Created initial sell order with price:", INITIAL_PRICE / 1e6, "USDT");

        // 4.3 添加初始流动性
        pool.addLiquidity(INITIAL_CARBON_AMOUNT / 2, INITIAL_USDT_AMOUNT / 2);
        console.log("Added initial liquidity to pool");

        // 停止广播
        vm.stopBroadcast();

        // 输出部署信息
        console.log(unicode"\n部署完成！");
        console.log(unicode"CarbonToken地址:", address(carbonToken));
        console.log(unicode"CarbonUSDTMarket地址:", address(market));
        console.log(unicode"GreenTalesLiquidityPool地址:", address(pool));
        console.log(unicode"Sepolia USDT地址:", SEPOLIA_USDT);
        console.log(unicode"Sepolia USDT/USD价格预言机地址:", SEPOLIA_USDT_USD_FEED);
        console.log(unicode"\n初始配置：");
        console.log(unicode"- 初始碳币数量:", INITIAL_CARBON_AMOUNT / 1e18);
        console.log(unicode"- 初始USDT数量:", INITIAL_USDT_AMOUNT / 1e6);
        console.log(unicode"- 初始价格:", INITIAL_PRICE / 1e6, "USDT");
        console.log(unicode"- 市场手续费率:", PLATFORM_FEE_RATE / 100, "%");
        console.log(unicode"- 流动性池手续费率:", POOL_FEE_RATE / 100, "%");
    }
} 