// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonToken.sol";
import "../src/interfaces/IUSDT.sol";
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
    IUSDT public usdtToken;
    CarbonPriceOracle public carbonPriceOracle;
    
    // 测试账户
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public owner = address(this);
    
    // 测试常量
    uint256 public constant INITIAL_CARBON_SUPPLY = 1000000 * 1e18;
    uint256 public constant INITIAL_USDT_SUPPLY = 1000000 * 1e6;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 100000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_USDT = 100000 * 1e6;
    
    // 模拟Chainlink价格预言机
    address public mockPriceFeed;
    address public mockEurUsdPriceFeed;
    
    function setUp() public {
        // 部署碳币合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](0);
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署USDT合约（模拟）
        usdtToken = IUSDT(address(new MockUSDT()));
        
        // 部署EUR/USD价格预言机（模拟）
        mockEurUsdPriceFeed = address(new MockPriceFeed());
        
        // 部署碳价预言机
        carbonPriceOracle = new CarbonPriceOracle(
            address(0), // 模拟LINK代币地址
            mockEurUsdPriceFeed  // 传入mock EUR/USD价格预言机地址
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
        uint256 usdtAmount = 1000 * 1e6;
        
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
        uint256 usdtAmount = 1000 * 1e6;
        
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
        // 模拟预言机返回一个非零价格，以触发价格偏离检查
        bytes32 requestId = bytes32("test_request_id");
        carbonPriceOracle.fulfillCarbonPrice(requestId, 1 * 1e18); // 设置预言机价格为1 EUR
        
        // 尝试进行兑换
        uint256 carbonAmount = 1000 * 1e18;
        
        vm.startPrank(bob);
        carbonToken.approve(address(liquidityPool), carbonAmount);
        
        // 应该失败
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
        return (0, int256(1.1 * 1e8), 0, block.timestamp, 0); // 1 EUR = 1.1 USD
    }
} 