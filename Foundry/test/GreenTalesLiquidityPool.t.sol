// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonToken.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "../src/interfaces/ICarbonPriceOracle.sol";
import "../src/CarbonPriceOracle.sol";

/**
 * @title GreenTalesLiquidityPoolTest
 * @dev 流动性池合约的测试套件
 * @notice 测试流动性池的所有主要功能，包括添加/移除流动性、代币兑换等
 */
contract GreenTalesLiquidityPoolTest is Test {
    // 测试合约实例
    GreenTalesLiquidityPool public liquidityPool;
    CarbonToken public carbonToken;
    IERC20 public usdtToken;
    CarbonPriceOracle public carbonPriceOracle;
    
    // 测试账户
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public owner = address(this);
    
    // 测试常量
    uint256 public constant INITIAL_CARBON_SUPPLY = 1000000 * 1e18;
    uint256 public constant INITIAL_USDT_SUPPLY = 1000000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 100000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_USDT = 100000 * 1e18;
    
    // 模拟Chainlink价格预言机
    address public mockPriceFeed;
    address public mockEurUsdPriceFeed;
    
    function setUp() public {
        // 部署碳币合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](0);
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署USDT合约（模拟）
        usdtToken = IERC20(address(new MockUSDT()));
        
        // 部署EUR/USD价格预言机（模拟）
        mockEurUsdPriceFeed = address(new MockPriceFeed());
        
        // 部署碳价预言机
        carbonPriceOracle = new CarbonPriceOracle(
            address(0x123), // 模拟router地址
            bytes32("mock_don_id"), // 模拟DON ID
            mockEurUsdPriceFeed,
            address(0) // 模拟LINK代币地址
        );
        
        // 部署流动性池合约
        liquidityPool = new GreenTalesLiquidityPool(
            address(carbonToken),
            address(usdtToken),
            mockPriceFeed
        );
        
        // 设置碳价预言机
        liquidityPool.setCarbonPriceOracle(address(carbonPriceOracle));
        
        // 给测试账户分配代币
        carbonToken.setGreenTrace(address(this));
        carbonToken.mint(alice, INITIAL_CARBON_SUPPLY);
        carbonToken.mint(bob, INITIAL_CARBON_SUPPLY);
        MockUSDT(address(usdtToken)).mint(alice, INITIAL_USDT_SUPPLY);
        MockUSDT(address(usdtToken)).mint(bob, INITIAL_USDT_SUPPLY);
        
        // 设置初始流动性
        vm.startPrank(alice);
        carbonToken.approve(address(liquidityPool), INITIAL_LIQUIDITY_CARBON);
        usdtToken.approve(address(liquidityPool), INITIAL_LIQUIDITY_USDT);
        liquidityPool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
    }
    
    /**
     * @dev 测试添加流动性
     */
    function testAddLiquidity() public {
        uint256 carbonAmount = 1000 * 1e18;
        uint256 usdtAmount = 1000 * 1e18;
        
        vm.startPrank(bob);
        carbonToken.approve(address(liquidityPool), carbonAmount);
        usdtToken.approve(address(liquidityPool), usdtAmount);
        
        uint256 lpTokens = liquidityPool.addLiquidity(carbonAmount, usdtAmount);
        vm.stopPrank();
        
        assertTrue(lpTokens > 0, "Should receive LP tokens");
        assertEq(liquidityPool.userLPTokens(bob), lpTokens, "LP tokens should be recorded");
    }
    
    /**
     * @dev 测试移除流动性
     */
    function testRemoveLiquidity() public {
        uint256 lpTokens = liquidityPool.userLPTokens(alice);
        require(lpTokens > 0, "No LP tokens to remove");
        
        vm.startPrank(alice);
        (uint256 carbonAmount, uint256 usdtAmount) = liquidityPool.removeLiquidity(lpTokens);
        vm.stopPrank();
        
        assertTrue(carbonAmount > 0, "Should receive carbon tokens");
        assertTrue(usdtAmount > 0, "Should receive USDT");
        assertEq(liquidityPool.userLPTokens(alice), 0, "LP tokens should be zero");
    }
    
    /**
     * @dev 测试碳币兑换USDT
     */
    function testSwapCarbonToUsdt() public {
        uint256 carbonAmount = 1000 * 1e18;
        
        vm.startPrank(bob);
        carbonToken.approve(address(liquidityPool), carbonAmount);
        uint256 usdtAmount = liquidityPool.swapCarbonToUsdt(carbonAmount);
        vm.stopPrank();
        
        assertTrue(usdtAmount > 0, "Should receive USDT");
    }
    
    /**
     * @dev 测试USDT兑换碳币
     */
    function testSwapUsdtToCarbon() public {
        uint256 usdtAmount = 1000 * 1e18;
        
        vm.startPrank(bob);
        usdtToken.approve(address(liquidityPool), usdtAmount);
        uint256 carbonAmount = liquidityPool.swapUsdtToCarbon(usdtAmount);
        vm.stopPrank();
        
        assertTrue(carbonAmount > 0, "Should receive carbon tokens");
    }
    
    /**
     * @dev 测试价格偏离检查
     */
    function testPriceDeviation() public {
        // 设置预言机价格 - 使用setter函数，设置更极端的价格
        uint256 eurPrice = 1 * 1e8; // 1 EUR (8位精度)
        uint256 usdPrice = 2 * 1e8; // 2 USD (8位精度，制造更大偏离)
        carbonPriceOracle.setTestCarbonPriceEUR(eurPrice);
        carbonPriceOracle.setTestCarbonPriceUSD(usdPrice);

        // 验证价格设置成功
        console.log("EUR Price from oracle:", carbonPriceOracle.getLatestCarbonPriceEUR());
        console.log("USD Price from oracle:", carbonPriceOracle.getLatestCarbonPriceUSD());

        // bob极端添加USDT流动性，拉高池内USDT数量，制造极端市场价格
        uint256 carbonAmount = 1000 * 1e18;
        uint256 usdtAmount = 10000000 * 1e18; // 极大USDT数量
        MockUSDT(address(usdtToken)).mint(bob, usdtAmount);
        vm.startPrank(bob);
        carbonToken.approve(address(liquidityPool), 1 * 1e18);
        usdtToken.approve(address(liquidityPool), usdtAmount);
        liquidityPool.addLiquidity(1 * 1e18, usdtAmount); // 极端拉高池中USDT
        carbonToken.approve(address(liquidityPool), carbonAmount);
        
        // 调试：输出市场价格和参考价格
        uint256 marketPrice = liquidityPool.getCarbonPrice(); // 18位精度
        uint256 referencePrice = carbonPriceOracle.getLatestCarbonPriceUSD(); // 8位精度
        uint256 referencePrice18 = referencePrice * 1e10; // 转换为18位精度
        console.log(unicode"Market Price (18位):", marketPrice);
        console.log(unicode"Reference Price (8位):", referencePrice);
        console.log(unicode"Reference Price (18位):", referencePrice18);
        console.log("Price Deviation Threshold:", liquidityPool.priceDeviationThreshold());
        console.log("Is Price Deviated:", liquidityPool.isPriceDeviated(marketPrice));
        
        // 现在兑换应该因为价格偏离过大而revert
        vm.expectRevert("Price deviation too large");
        liquidityPool.swapCarbonToUsdt(carbonAmount);
        vm.stopPrank();
    }
}

/**
 * @title MockUSDT
 * @dev 用于测试的USDT模拟合约
 */
contract MockUSDT {
    mapping(address => uint256) public balanceOf;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address, uint256) external returns (bool) {
        return true;
    }
}

// Mock EUR/USD价格预言机合约
contract MockPriceFeed {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (0, int256(1.1 * 1e8), 0, block.timestamp, 0); // 1 EUR = 1.1 USD (8位精度)
    }
} 