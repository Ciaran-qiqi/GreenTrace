// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/CarbonToken.sol";
import "../src/CarbonUSDTMarket.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonPriceOracle.sol";

/**
 * @title DeployMarket
 * @dev 部署碳币交易市场和流动性池的脚本
 * 
 * 部署流程：
 * 1. 部署CarbonToken合约
 * 2. 部署CarbonUSDTMarket合约
 * 3. 部署GreenTalesLiquidityPool合约
 * 4. 部署CarbonPriceOracle合约
 * 5. 初始化流动性池
 */
contract DeployMarket is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdcdc73413c6136c9abcc3e8d250af42947ac2fc7;          //USDT（Testnet USDT）18位精度 主网6位
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910; // Chainlink Sepolia EUR/USD预言机地址
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // Sepolia Chainlink Token
    
    // 初始流动性配置
    uint256 constant INITIAL_CARBON_AMOUNT = 1_000_000 * 1e18;  // 100万碳币
    uint256 constant INITIAL_USDT_AMOUNT = 88_000_000 * 1e18;   // 8800万USDT（使用18位精度）
    uint256 constant INITIAL_PRICE = 88 * 1e18;                 // 88 USDT/碳币（使用18位精度）
    
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
            address(0)  // 移除USDT/USD价格预言机
        );
        console.log("GreenTalesLiquidityPool deployed at:", address(pool));

        // 4. 部署CarbonPriceOracle合约
        CarbonPriceOracle oracle = new CarbonPriceOracle(
            SEPOLIA_CHAINLINK_TOKEN,
            SEPOLIA_EUR_USD_FEED
        );
        console.log("CarbonPriceOracle deployed at:", address(oracle));

        // 5. 初始化流动性池
        // 5.1 授权市场合约使用碳币
        carbonToken.approve(address(market), INITIAL_CARBON_AMOUNT);
        carbonToken.approve(address(pool), INITIAL_CARBON_AMOUNT);

        // 5.2 创建初始卖单
        market.createSellOrder(INITIAL_CARBON_AMOUNT, INITIAL_PRICE);
        console.log("Created initial sell order with price:", INITIAL_PRICE / 1e18, "USDT");

        // 5.3 添加初始流动性
        pool.addLiquidity(INITIAL_CARBON_AMOUNT / 2, INITIAL_USDT_AMOUNT / 2);
        console.log("Added initial liquidity to pool");

        // 5.4 设置碳价预言机
        pool.setCarbonPriceOracle(address(oracle));
        pool.setPriceDeviationThreshold(10); // 设置10%的偏离阈值
        console.log("Set carbon price oracle and deviation threshold");

        // 停止广播
        vm.stopBroadcast();

        // 输出部署信息
        console.log(unicode"\n部署完成！");
        console.log(unicode"CarbonToken地址:", address(carbonToken));
        console.log(unicode"CarbonUSDTMarket地址:", address(market));
        console.log(unicode"GreenTalesLiquidityPool地址:", address(pool));
        console.log(unicode"CarbonPriceOracle地址:", address(oracle));
        console.log(unicode"Sepolia USDT地址:", SEPOLIA_USDT);
        console.log(unicode"Sepolia EUR/USD价格预言机地址:", SEPOLIA_EUR_USD_FEED);
        console.log(unicode"Sepolia Chainlink Token地址:", SEPOLIA_CHAINLINK_TOKEN);
        console.log(unicode"\n初始配置：");
        console.log(unicode"- 初始碳币数量:", INITIAL_CARBON_AMOUNT / 1e18);
        console.log(unicode"- 初始USDT数量:", INITIAL_USDT_AMOUNT / 1e18);
        console.log(unicode"- 初始价格:", INITIAL_PRICE / 1e18, "USDT");
        console.log(unicode"- 市场手续费率:", PLATFORM_FEE_RATE / 100, "%");
        console.log(unicode"- 流动性池手续费率:", POOL_FEE_RATE / 100, "%");
        console.log(unicode"- 价格偏离阈值:", 10, "%");
    }
} 