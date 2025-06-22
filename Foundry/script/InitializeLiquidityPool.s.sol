// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

/**
 * @title InitializeLiquidityPool
 * @dev 初始化流动性池，添加初始流动性
 * @notice 需要先部署GreenTalesLiquidityPool合约
 */
contract InitializeLiquidityPool is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    
    // 已部署的合约地址（需要根据实际部署结果更新）
    address constant CARBON_TOKEN = 0x808b73A3A1D97382acF32d4F4F834e799Aa08198;
    // 需要部署后更新这个地址
    address constant LIQUIDITY_POOL = 0x0000000000000000000000000000000000000000; // 部署后更新
    
    // 初始流动性参数
    uint256 constant INITIAL_CARBON_AMOUNT = 1000 * 1e18; // 1000 碳币
    uint256 constant INITIAL_USDT_AMOUNT = 88000 * 1e18;  // 88000 USDT (18位精度)
    
    function setUp() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== 流动性池初始化脚本 ===");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"链ID:", block.chainid);
        console.log(unicode"网络: Sepolia测试网");
        console.log("");
        
        // 显示合约地址
        console.log(unicode"合约地址:");
        console.log(unicode"CarbonToken:", CARBON_TOKEN);
        console.log(unicode"USDT:", SEPOLIA_USDT);
        console.log(unicode"LiquidityPool:", LIQUIDITY_POOL);
        console.log("");
        
        // 显示初始流动性参数
        console.log(unicode"初始流动性参数:");
        console.log(unicode"碳币数量:", INITIAL_CARBON_AMOUNT / 1e18, unicode"碳币");
        console.log(unicode"USDT数量:", INITIAL_USDT_AMOUNT / 1e18, unicode"USDT");
        console.log(unicode"初始价格:", (INITIAL_USDT_AMOUNT * 1e18) / INITIAL_CARBON_AMOUNT / 1e18, unicode"USDT/碳币");
        console.log("");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"开始初始化流动性池...");
        
        // 检查合约地址是否已设置
        if (LIQUIDITY_POOL == address(0)) {
            console.log(unicode"错误: 请先部署GreenTalesLiquidityPool合约并更新LIQUIDITY_POOL地址");
            return;
        }
        
        // 创建合约实例
        CarbonToken carbonToken = CarbonToken(CARBON_TOKEN);
        IERC20 usdtToken = IERC20(SEPOLIA_USDT);
        GreenTalesLiquidityPool pool = GreenTalesLiquidityPool(LIQUIDITY_POOL);
        
        // 检查代币余额
        uint256 carbonBalance = carbonToken.balanceOf(deployer);
        uint256 usdtBalance = usdtToken.balanceOf(deployer);
        
        console.log(unicode"当前余额:");
        console.log(unicode"碳币余额:", carbonBalance / 1e18, unicode"碳币");
        console.log(unicode"USDT余额:", usdtBalance / 1e18, unicode"USDT");
        console.log("");
        
        // 检查余额是否足够
        if (carbonBalance < INITIAL_CARBON_AMOUNT) {
            console.log(unicode"错误: 碳币余额不足");
            console.log(unicode"需要:", INITIAL_CARBON_AMOUNT / 1e18, unicode"碳币");
            console.log(unicode"当前:", carbonBalance / 1e18, unicode"碳币");
            return;
        }
        
        if (usdtBalance < INITIAL_USDT_AMOUNT) {
            console.log(unicode"错误: USDT余额不足");
            console.log(unicode"需要:", INITIAL_USDT_AMOUNT / 1e18, unicode"USDT");
            console.log(unicode"当前:", usdtBalance / 1e18, unicode"USDT");
            return;
        }
        
        // 1. 授权碳币给流动性池
        console.log(unicode"1. 授权碳币给流动性池...");
        vm.startBroadcast(deployerPrivateKey);
        carbonToken.approve(LIQUIDITY_POOL, INITIAL_CARBON_AMOUNT);
        console.log(unicode"碳币授权成功");
        vm.stopBroadcast();
        
        // 2. 授权USDT给流动性池
        console.log(unicode"2. 授权USDT给流动性池...");
        vm.startBroadcast(deployerPrivateKey);
        usdtToken.approve(LIQUIDITY_POOL, INITIAL_USDT_AMOUNT);
        console.log(unicode"USDT授权成功");
        vm.stopBroadcast();
        
        // 3. 添加流动性
        console.log(unicode"3. 添加初始流动性...");
        vm.startBroadcast(deployerPrivateKey);
        uint256 lpTokens = pool.addLiquidity(INITIAL_CARBON_AMOUNT, INITIAL_USDT_AMOUNT);
        console.log(unicode"流动性添加成功！获得LP代币:", lpTokens);
        vm.stopBroadcast();
        
        // 4. 获取池子信息
        console.log(unicode"4. 获取池子信息...");
        (uint256 totalCarbon, uint256 totalUsdt, uint256 totalLP, uint256 currentPrice, , , , , ) = pool.getPoolInfo();
        
        console.log(unicode"\n=== 初始化完成！===");
        console.log(unicode"池中碳币总量:", totalCarbon / 1e18, unicode"碳币");
        console.log(unicode"池中USDT总量:", totalUsdt / 1e18, unicode"USDT");
        console.log(unicode"LP代币总量:", totalLP);
        console.log(unicode"当前价格:", currentPrice / 1e18, unicode"USDT/碳币");
        console.log(unicode"获得的LP代币:", lpTokens);
        console.log(unicode"==================");
        
        console.log(unicode"\n=== 下一步操作 ===");
        console.log(unicode"1. 测试兑换功能: swapCarbonToUsdt(), swapUsdtToCarbon()");
        console.log(unicode"2. 测试市价单功能: marketBuy(), marketSell()");
        console.log(unicode"3. 测试限价单功能: createBuyOrder(), createSellOrder()");
        console.log(unicode"4. 配置预言机订阅ID和操作员权限");
        console.log(unicode"==================");
    }
} 