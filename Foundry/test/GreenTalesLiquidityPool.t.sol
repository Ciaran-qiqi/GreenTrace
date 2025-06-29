// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonToken.sol";
import "../src/CarbonPriceOracle.sol";
import "../src/interfaces/ICarbonPriceOracle.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/// @dev 本地测试用Mock USDT合约，支持mint
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title GreenTalesLiquidityPoolTest
 * @dev 测试GreenTalesLiquidityPool合约的所有功能
 * @notice 包含流动性管理、价格预言、兑换功能、价格偏离检查等全面测试
 */
contract GreenTalesLiquidityPoolTest is Test {
    // 测试合约实例
    GreenTalesLiquidityPool public pool;
    CarbonToken public carbonToken;
    CarbonPriceOracle public oracle;
    IERC20 public usdtToken;
    
    // 测试地址
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    
    // Sepolia测试网地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // 测试参数
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 1_000_000 * 1e18; // 100万碳币
    uint256 public constant INITIAL_LIQUIDITY_USDT = 88_000_000 * 1e18;  // 8800万USDT
    
    // 测试事件
    event LiquidityAdded(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event LiquidityRemoved(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event TokensSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event PriceDeviationChecked(uint256 referencePrice, uint256 marketPrice, uint256 deviation, bool isDeviated);
    event SwapBlockedByPriceDeviation(uint256 referencePrice, uint256 marketPrice, uint256 deviation);
    event EmergencyPaused(address indexed by, bool paused);

    function setUp() public {
        // 设置测试地址
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // 部署碳币合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance({
            to: owner,
            amount: INITIAL_CARBON_SUPPLY
        });
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署Mock USDT合约并分配余额
        MockERC20 mockUsdt = new MockERC20("Mock USDT", "USDT");
        mockUsdt.mint(user1, 10_000_000 * 1e18);
        mockUsdt.mint(user2, 10_000_000 * 1e18);
        mockUsdt.mint(user3, 10_000_000 * 1e18);
        mockUsdt.mint(owner, 100_000_000 * 1e18);
        usdtToken = IERC20(address(mockUsdt));
        
        // 部署流动性池合约
        pool = new GreenTalesLiquidityPool(
            address(carbonToken),
            address(usdtToken)
        );
        
        // 给测试用户分配碳币
        carbonToken.transfer(user1, 100_000 * 1e18);
        carbonToken.transfer(user2, 100_000 * 1e18);
        carbonToken.transfer(user3, 100_000 * 1e18);
    }
    
    // ============ 基础功能测试 ============
    
    function test_Constructor() public {
        assertEq(address(pool.carbonToken()), address(carbonToken));
        assertEq(address(pool.usdtToken()), address(usdtToken));
        assertEq(pool.priceDeviationThreshold(), 10); // 默认10%
        assertEq(pool.totalCarbonTokens(), 0);
        assertEq(pool.totalUsdtTokens(), 0);
        assertEq(pool.totalLPTokens(), 0);
    }
    
    function test_SetCarbonPriceOracle() public {
        address newOracle = makeAddr("newOracle");
        pool.setCarbonPriceOracle(newOracle);
        assertEq(address(pool.carbonPriceOracle()), newOracle);
    }
    
    function test_SetPriceDeviationThreshold() public {
        pool.setPriceDeviationThreshold(15);
        assertEq(pool.priceDeviationThreshold(), 15);
    }
    
    // ============ 价格相关测试 ============
    
    function test_GetCarbonPrice_EmptyPool() public {
        uint256 price = pool.getCarbonPrice();
        assertEq(price, 0, "Empty pool price should be 0");
    }
    
    function test_GetCarbonPrice_WithLiquidity() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 检查价格
        uint256 price = pool.getCarbonPrice();
        uint256 expectedPrice = (INITIAL_LIQUIDITY_USDT * 1e18) / INITIAL_LIQUIDITY_CARBON;
        assertEq(price, expectedPrice, "Price calculation error");
        assertEq(price, 88 * 1e18, "Expected price should be 88 USDT/carbon");
    }
    
    function test_GetOracleReferencePrice() public {
        // 设置测试价格
        oracle.setTestCarbonPriceUSD(550000000); // 5.50 USD (8位精度)
        
        uint256 referencePrice = pool.getOracleReferencePrice();
        uint256 expectedPrice = 550000000 * 1e10; // 转换为18位精度
        assertEq(referencePrice, expectedPrice, "Oracle price conversion error");
    }
    
    function test_GetCarbonPriceUSD() public {
        // 设置测试价格
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD (8位精度)
        
        uint256 usdPrice = pool.getCarbonPriceUSD();
        uint256 expectedPrice = 880000000 * 1e10; // 转换为18位精度
        assertEq(usdPrice, expectedPrice, "USD price should match oracle price");
    }
    
    function test_PriceDeviationCheck() public {
        // 设置预言机价格为88 USD
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD (8位精度)
        
        // 添加流动性，设置池子价格为88 USDT
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 检查价格偏离
        (uint256 referencePrice, uint256 marketPrice, uint256 deviation, uint256 threshold, bool isDeviated) = 
            pool.getPriceDeviationDetails();
        
        assertEq(referencePrice, 88 * 1e18, "Oracle price error");
        assertEq(marketPrice, 88 * 1e18, "Market price error");
        assertEq(deviation, 0, "Price deviation should be 0");
        assertEq(threshold, 10, "Deviation threshold should be 10%");
        assertEq(isDeviated, false, "Price should not be deviated");
    }
    
    function test_PriceDeviationCheck_Deviated() public {
        // 设置预言机价格为100 USD
        oracle.setTestCarbonPriceUSD(1000000000); // 100.00 USD (8位精度)
        
        // 添加流动性，设置池子价格为88 USDT
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 检查价格偏离
        (,, uint256 deviation,, bool isDeviated) = pool.getPriceDeviationDetails();
        
        // 偏离 = (100 - 88) / 100 * 100 = 12%
        assertGt(deviation, 10, "Price deviation should exceed 10%");
        assertEq(isDeviated, true, "Price should be deviated");
    }
    
    function test_IsPriceDeviated() public {
        // 设置预言机价格为100 USD
        oracle.setTestCarbonPriceUSD(1000000000); // 100.00 USD
        
        // 添加流动性，设置池子价格为88 USDT
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        uint256 marketPrice = pool.getCarbonPrice();
        bool isDeviated = pool.isPriceDeviated(marketPrice);
        
        assertEq(isDeviated, true, "Price should be deviated");
    }
    
    // ============ 流动性管理测试 ============
    
    function test_AddLiquidity() public {
        uint256 carbonAmount = 10_000 * 1e18;
        uint256 usdtAmount = 880_000 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), carbonAmount);
        IERC20(address(usdtToken)).approve(address(pool), usdtAmount);
        
        vm.expectEmit(true, true, true, true);
        emit LiquidityAdded(user1, carbonAmount, usdtAmount, 0); // LP tokens will be calculated
        
        uint256 lpTokens = pool.addLiquidity(carbonAmount, usdtAmount);
        vm.stopPrank();
        
        assertGt(lpTokens, 0, "Should receive LP tokens");
        assertEq(pool.userLPTokens(user1), lpTokens, "User LP token count error");
        assertEq(pool.totalCarbonTokens(), carbonAmount, "Pool carbon token count error");
        assertEq(pool.totalUsdtTokens(), usdtAmount, "Pool USDT count error");
        assertEq(pool.totalLPTokens(), lpTokens, "Total LP token count error");
        assertEq(pool.totalLiquidityProviders(), 1, "Liquidity provider count error");
    }
    
    function test_AddLiquidity_SecondUser() public {
        // 第一个用户添加流动性
        uint256 carbonAmount1 = 10_000 * 1e18;
        uint256 usdtAmount1 = 880_000 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), carbonAmount1);
        IERC20(address(usdtToken)).approve(address(pool), usdtAmount1);
        uint256 lpTokens1 = pool.addLiquidity(carbonAmount1, usdtAmount1);
        vm.stopPrank();
        
        // 第二个用户添加流动性
        uint256 carbonAmount2 = 5_000 * 1e18;
        uint256 usdtAmount2 = 440_000 * 1e18;
        
        vm.startPrank(user2);
        carbonToken.approve(address(pool), carbonAmount2);
        IERC20(address(usdtToken)).approve(address(pool), usdtAmount2);
        uint256 lpTokens2 = pool.addLiquidity(carbonAmount2, usdtAmount2);
        vm.stopPrank();
        
        assertGt(lpTokens2, 0, "Second user should receive LP tokens");
        assertEq(pool.totalLiquidityProviders(), 2, "Should have 2 liquidity providers");
        assertEq(pool.totalCarbonTokens(), carbonAmount1 + carbonAmount2, "Total carbon tokens error");
        assertEq(pool.totalUsdtTokens(), usdtAmount1 + usdtAmount2, "Total USDT error");
    }
    
    function test_AddLiquidity_ZeroAmount() public {
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        IERC20(address(usdtToken)).approve(address(pool), 88_000 * 1e18);
        
        vm.expectRevert("Amounts must be greater than 0");
        pool.addLiquidity(0, 88_000 * 1e18);
        
        vm.expectRevert("Amounts must be greater than 0");
        pool.addLiquidity(1_000 * 1e18, 0);
        vm.stopPrank();
    }
    
    function test_RemoveLiquidity() public {
        // 先添加流动性
        uint256 carbonAmount = 10_000 * 1e18;
        uint256 usdtAmount = 880_000 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), carbonAmount);
        IERC20(address(usdtToken)).approve(address(pool), usdtAmount);
        uint256 lpTokens = pool.addLiquidity(carbonAmount, usdtAmount);
        
        // 记录移除前的余额
        uint256 carbonBalanceBefore = carbonToken.balanceOf(user1);
        uint256 usdtBalanceBefore = IERC20(address(usdtToken)).balanceOf(user1);
        
        vm.expectEmit(true, true, true, true);
        emit LiquidityRemoved(user1, 0, 0, lpTokens); // Amounts will be calculated
        
        (uint256 carbonReturned, uint256 usdtReturned) = pool.removeLiquidity(lpTokens);
        vm.stopPrank();
        
        assertGt(carbonReturned, 0, "Should return carbon tokens");
        assertGt(usdtReturned, 0, "Should return USDT");
        assertEq(pool.userLPTokens(user1), 0, "User LP tokens should be 0");
        assertEq(pool.totalLiquidityProviders(), 0, "Liquidity provider count should be 0");
        
        // 检查用户余额增加
        uint256 carbonBalanceAfter = carbonToken.balanceOf(user1);
        uint256 usdtBalanceAfter = IERC20(address(usdtToken)).balanceOf(user1);
        assertEq(carbonBalanceAfter, carbonBalanceBefore + carbonReturned, "Carbon balance should increase");
        assertEq(usdtBalanceAfter, usdtBalanceBefore + usdtReturned, "USDT balance should increase");
    }
    
    function test_RemoveLiquidity_InsufficientLP() public {
        vm.startPrank(user1);
        vm.expectRevert("Insufficient LP tokens");
        pool.removeLiquidity(1_000 * 1e18);
        vm.stopPrank();
    }
    
    // ============ 兑换功能测试 ============
    
    function test_SwapCarbonToUsdt() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格（与池子价格一致）
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD
        
        uint256 swapAmount = 1_000 * 1e18; // 1000碳币
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), swapAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TokensSwapped(user1, address(carbonToken), address(usdtToken), swapAmount, 0); // USDT amount will be calculated
        
        uint256 usdtReceived = pool.swapCarbonToUsdt(swapAmount);
        vm.stopPrank();
        
        assertGt(usdtReceived, 0, "Should receive USDT");
        
        // 检查池子状态变化
        assertEq(pool.totalCarbonTokens(), INITIAL_LIQUIDITY_CARBON + swapAmount, "Pool carbon tokens should increase");
        assertLt(pool.totalUsdtTokens(), INITIAL_LIQUIDITY_USDT, "Pool USDT should decrease");
    }
    
    function test_SwapUsdtToCarbon() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格（与池子价格一致）
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD
        
        uint256 swapAmount = 88_000 * 1e18; // 88000 USDT
        
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(pool), swapAmount);
        
        vm.expectEmit(true, true, true, true);
        emit TokensSwapped(user1, address(usdtToken), address(carbonToken), swapAmount, 0); // Carbon amount will be calculated
        
        uint256 carbonReceived = pool.swapUsdtToCarbon(swapAmount);
        vm.stopPrank();
        
        assertGt(carbonReceived, 0, "Should receive carbon tokens");
        
        // 检查池子状态变化
        assertEq(pool.totalUsdtTokens(), INITIAL_LIQUIDITY_USDT + swapAmount, "Pool USDT should increase");
        assertLt(pool.totalCarbonTokens(), INITIAL_LIQUIDITY_CARBON, "Pool carbon tokens should decrease");
    }
    
    function test_Swap_PriceDeviation() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格为100 USD（偏离超过阈值）
        oracle.setTestCarbonPriceUSD(1000000000); // 100.00 USD
        
        uint256 swapAmount = 1_000 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), swapAmount);
        
        vm.expectEmit(true, true, true, true);
        emit SwapBlockedByPriceDeviation(100 * 1e18, 88 * 1e18, 12); // 12% deviation
        
        vm.expectRevert("Price deviation too large");
        pool.swapCarbonToUsdt(swapAmount);
        vm.stopPrank();
    }
    
    function test_Swap_ZeroAmount() public {
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        
        vm.expectRevert("Amount must be greater than 0");
        pool.swapCarbonToUsdt(0);
        
        IERC20(address(usdtToken)).approve(address(pool), 88_000 * 1e18);
        vm.expectRevert("Amount must be greater than 0");
        pool.swapUsdtToCarbon(0);
        vm.stopPrank();
    }
    
    // ============ 估算功能测试 ============
    
    function test_GetSwapEstimate() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        uint256 amountIn = 1_000 * 1e18;
        
        // 碳币兑换USDT估算
        (uint256 amountOut, uint256 fee, uint256 priceImpact) = 
            pool.getSwapEstimate(amountIn, true);
        
        assertGt(amountOut, 0, "Estimated output should be greater than 0");
        assertGt(fee, 0, "Estimated fee should be greater than 0");
        assertGt(priceImpact, 0, "Price impact should be greater than 0");
        
        // USDT兑换碳币估算
        (amountOut, fee, priceImpact) = 
            pool.getSwapEstimate(amountIn, false);
        
        assertGt(amountOut, 0, "Estimated output should be greater than 0");
        assertGt(fee, 0, "Estimated fee should be greater than 0");
        assertGt(priceImpact, 0, "Price impact should be greater than 0");
    }
    
    function test_GetAddLiquidityEstimate() public {
        uint256 carbonAmount = 10_000 * 1e18;
        uint256 usdtAmount = 880_000 * 1e18;
        
        (uint256 lpTokens, uint256 carbonShare, uint256 usdtShare) = 
            pool.getAddLiquidityEstimate(carbonAmount, usdtAmount);
        
        assertGt(lpTokens, 0, "Estimated LP tokens should be greater than 0");
        assertEq(carbonShare, carbonAmount, "Carbon share should equal input amount");
        assertEq(usdtShare, usdtAmount, "USDT share should equal input amount");
    }
    
    function test_GetRemoveLiquidityEstimate() public {
        // 先添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        uint256 lpTokens = 1_000 * 1e18;
        
        (uint256 carbonAmount, uint256 usdtAmount, uint256 sharePercentage) = 
            pool.getRemoveLiquidityEstimate(lpTokens);
        
        assertGt(carbonAmount, 0, "Estimated carbon amount should be greater than 0");
        assertGt(usdtAmount, 0, "Estimated USDT amount should be greater than 0");
        assertGt(sharePercentage, 0, "Share percentage should be greater than 0");
    }
    
    // ============ 统计信息测试 ============
    
    function test_GetPoolStats() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 进行兑换
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        pool.swapCarbonToUsdt(1_000 * 1e18);
        vm.stopPrank();
        
        (uint256 totalCarbon, uint256 totalUsdt, uint256 totalLP, uint256 currentPrice, uint256 swapCount, uint256 totalVolume, uint256 totalFees, uint256 totalProviders) = 
            pool.getPoolStats();
        
        assertEq(totalCarbon, INITIAL_LIQUIDITY_CARBON + 1_000 * 1e18, "Total carbon tokens error");
        assertLt(totalUsdt, INITIAL_LIQUIDITY_USDT, "Total USDT should decrease");
        assertGt(totalLP, 0, "Total LP tokens should be greater than 0");
        assertEq(currentPrice, 88 * 1e18, "Current price error");
        assertEq(swapCount, 1, "Total swaps should be 1");
        assertGt(totalVolume, 0, "Total volume should be greater than 0");
        assertGt(totalFees, 0, "Total fees should be greater than 0");
        assertEq(totalProviders, 1, "Total providers should be 1");
    }
    
    function test_GetLiquidityProviderInfo() public {
        // 添加流动性
        uint256 carbonAmount = 10_000 * 1e18;
        uint256 usdtAmount = 880_000 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), carbonAmount);
        IERC20(address(usdtToken)).approve(address(pool), usdtAmount);
        uint256 lpTokens = pool.addLiquidity(carbonAmount, usdtAmount);
        vm.stopPrank();
        
        (uint256 userLPTokens, uint256 carbonShare, uint256 usdtShare, uint256 sharePercentage) = 
            pool.getLiquidityProviderInfo(user1);
        
        assertEq(userLPTokens, lpTokens, "User LP tokens error");
        assertEq(carbonShare, carbonAmount, "Carbon share error");
        assertEq(usdtShare, usdtAmount, "USDT share error");
        assertEq(sharePercentage, 10000, "Share percentage should be 100%");
    }
    
    function test_GetPoolInfo() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD
        
        (uint256 totalCarbon, uint256 totalUsdt, uint256 totalLP, uint256 currentPrice, uint256 oraclePrice, bool priceDeviated, uint256 deviationPercent, uint256 feeRate, bool isPaused) = 
            pool.getPoolInfo();
        
        assertEq(totalCarbon, INITIAL_LIQUIDITY_CARBON, "Total carbon error");
        assertEq(totalUsdt, INITIAL_LIQUIDITY_USDT, "Total USDT error");
        assertGt(totalLP, 0, "Total LP should be greater than 0");
        assertEq(currentPrice, 88 * 1e18, "Current price error");
        assertEq(oraclePrice, 88 * 1e18, "Oracle price error");
        assertEq(priceDeviated, false, "Price should not be deviated");
        assertEq(deviationPercent, 0, "Deviation percent should be 0");
        assertEq(feeRate, 30, "Fee rate should be 0.3%");
        assertEq(isPaused, false, "Pool should not be paused");
    }
    
    // ============ 手续费管理测试 ============
    
    function test_WithdrawFees() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 进行兑换产生手续费
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        pool.swapCarbonToUsdt(1_000 * 1e18);
        vm.stopPrank();
        
        // 提取手续费
        uint256 balanceBefore = IERC20(address(usdtToken)).balanceOf(owner);
        pool.withdrawPlatformFees(address(usdtToken), 1_000 * 1e18);
        uint256 balanceAfter = IERC20(address(usdtToken)).balanceOf(owner);
        
        assertGt(balanceAfter, balanceBefore, "Should withdraw fees successfully");
    }
    
    function test_WithdrawFees_InvalidToken() public {
        vm.expectRevert("Invalid token");
        pool.withdrawPlatformFees(address(0), 1_000 * 1e18);
    }
    
    function test_WithdrawFees_ZeroAmount() public {
        vm.expectRevert("Amount must be greater than 0");
        pool.withdrawPlatformFees(address(usdtToken), 0);
    }
    
    // ============ 紧急功能测试 ============
    
    function test_EmergencyPause() public {
        pool.pause();
        assertEq(pool.paused(), true, "Pool should be paused");
        
        // 暂停时不能添加流动性
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        IERC20(address(usdtToken)).approve(address(pool), 88_000 * 1e18);
        
        vm.expectRevert("Contract is paused");
        pool.addLiquidity(1_000 * 1e18, 88_000 * 1e18);
        vm.stopPrank();
        
        // 恢复池子
        pool.unpause();
        assertEq(pool.paused(), false, "Pool should be resumed");
    }
    
    function test_EmergencyWithdraw() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 紧急提取
        uint256 balanceBefore = carbonToken.balanceOf(owner);
        pool.emergencyWithdraw(address(carbonToken), owner, 1_000 * 1e18);
        uint256 balanceAfter = carbonToken.balanceOf(owner);
        
        assertEq(balanceAfter, balanceBefore + 1_000 * 1e18, "Should withdraw successfully");
    }
    
    function test_EmergencyWithdraw_InvalidRecipient() public {
        vm.expectRevert("Invalid recipient");
        pool.emergencyWithdraw(address(carbonToken), address(0), 1_000 * 1e18);
    }
    
    function test_EmergencyWithdraw_ZeroAmount() public {
        vm.expectRevert("Amount must be greater than 0");
        pool.emergencyWithdraw(address(carbonToken), owner, 0);
    }
    
    function test_EmergencyWithdraw_UnsupportedToken() public {
        vm.expectRevert("Unsupported token");
        pool.emergencyWithdraw(address(0), owner, 1_000 * 1e18);
    }
    
    // ============ 边界条件测试 ============
    
    function test_AddLiquidity_InvalidRatio() public {
        // 添加初始流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 尝试以不同比例添加流动性
        vm.startPrank(user1);
        carbonToken.approve(address(pool), 1_000 * 1e18);
        IERC20(address(usdtToken)).approve(address(pool), 100_000 * 1e18); // 不同比例
        
        uint256 lpTokens = pool.addLiquidity(1_000 * 1e18, 100_000 * 1e18);
        vm.stopPrank();
        
        assertGt(lpTokens, 0, "Should receive LP tokens even with different ratio");
    }
    
    function test_Swap_LargeAmount() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD
        
        // 大额兑换
        uint256 largeAmount = 100_000 * 1e18; // 10万碳币
        
        vm.startPrank(user1);
        carbonToken.approve(address(pool), largeAmount);
        
        uint256 usdtReceived = pool.swapCarbonToUsdt(largeAmount);
        vm.stopPrank();
        
        assertGt(usdtReceived, 0, "Should receive USDT for large swap");
        
        // 检查价格影响
        uint256 newPrice = pool.getCarbonPrice();
        assertLt(newPrice, 88 * 1e18, "Price should decrease after large swap");
    }
    
    function test_GetDetailedSwapEstimate() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        uint256 amountIn = 1_000 * 1e18;
        
        // 详细兑换估算
        (uint256 amountOut, uint256 fee, uint256 priceImpact, uint256 newPrice) = 
            pool.getDetailedSwapEstimate(amountIn, true);
        
        assertGt(amountOut, 0, "Estimated output should be greater than 0");
        assertGt(fee, 0, "Estimated fee should be greater than 0");
        assertGt(priceImpact, 0, "Price impact should be greater than 0");
        assertLt(newPrice, 88 * 1e18, "New price should be lower than current price");
    }
    
    function test_GetDetailedAddLiquidityEstimate() public {
        uint256 carbonAmount = 10_000 * 1e18;
        uint256 usdtAmount = 880_000 * 1e18;
        
        (uint256 lpTokens, uint256 carbonShare, uint256 usdtShare, uint256 priceImpact, uint256 newPrice) = 
            pool.getDetailedAddLiquidityEstimate(carbonAmount, usdtAmount);
        
        assertGt(lpTokens, 0, "Estimated LP tokens should be greater than 0");
        assertEq(carbonShare, carbonAmount, "Carbon share should equal input amount");
        assertEq(usdtShare, usdtAmount, "USDT share should equal input amount");
        assertEq(priceImpact, 0, "Price impact should be 0 for first liquidity");
        assertEq(newPrice, 88 * 1e18, "New price should be 88 USDT/carbon");
    }
    
    function test_CheckLiquiditySufficiency() public {
        // 添加流动性
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        uint256 lpTokens = pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        (bool hasEnough, uint256 currentLP, uint256 requiredLP) = 
            pool.checkLiquiditySufficiency(owner, lpTokens);
        
        assertEq(hasEnough, true, "Should have enough liquidity");
        assertEq(currentLP, lpTokens, "Current LP should match");
        assertEq(requiredLP, lpTokens, "Required LP should match");
        
        // 检查不足的情况
        (hasEnough, currentLP, requiredLP) = 
            pool.checkLiquiditySufficiency(owner, lpTokens + 1);
        
        assertEq(hasEnough, false, "Should not have enough liquidity");
    }
} 