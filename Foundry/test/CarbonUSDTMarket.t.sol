// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonUSDTMarket.sol";
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
 * @title CarbonUSDTMarketTest
 * @dev 测试CarbonUSDTMarket合约的所有功能
 * @notice 包含限价单、市价单、订单管理等全面测试
 */
contract CarbonUSDTMarketTest is Test {
    // 测试合约实例
    CarbonUSDTMarket public market;
    GreenTalesLiquidityPool public pool;
    CarbonToken public carbonToken;
    CarbonPriceOracle public oracle;
    IERC20 public usdtToken;
    
    // 测试地址
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public feeCollector;
    
    // Sepolia测试网地址
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910;
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;
    
    // 测试参数
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 public constant INITIAL_USDT_AMOUNT = 88_000_000 * 1e18;
    uint256 public constant INITIAL_LIQUIDITY_CARBON = 800_000 * 1e18; // 80万碳币
    uint256 public constant INITIAL_LIQUIDITY_USDT = 88_000_000 * 1e18;  // 8800万USDT
    uint256 public constant PLATFORM_FEE_RATE = 100; // 1%
    uint256 public constant LIMIT_ORDER_FEE_RATE = 50; // 0.5%
    uint256 public constant FILL_ORDER_FEE_RATE = 30; // 0.3%
    
    // 测试事件
    event OrderCreated(uint256 indexed orderId, address indexed user, CarbonUSDTMarket.OrderType orderType, uint256 amount, uint256 price, uint256 timestamp);
    event OrderFilled(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, uint256 price, uint256 platformFee, uint256 timestamp);
    event MarketOrderExecuted(address indexed user, CarbonUSDTMarket.OrderType orderType, uint256 amount, uint256 price, uint256 timestamp);

    function setUp() public {
        // 设置测试地址
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        feeCollector = makeAddr("feeCollector");
        
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
        
        // 部署预言机合约
        oracle = new CarbonPriceOracle(
            SEPOLIA_FUNCTIONS_ROUTER,
            SEPOLIA_DON_ID,
            SEPOLIA_EUR_USD_FEED,
            SEPOLIA_CHAINLINK_TOKEN
        );
        
        // 部署流动性池合约
        pool = new GreenTalesLiquidityPool(
            address(carbonToken),
            address(usdtToken)
        );
        
        // 设置预言机地址
        pool.setCarbonPriceOracle(address(oracle));
        
        // 部署市场合约
        market = new CarbonUSDTMarket(
            address(carbonToken),
            address(usdtToken),
            address(pool),
            PLATFORM_FEE_RATE,
            LIMIT_ORDER_FEE_RATE,
            FILL_ORDER_FEE_RATE,
            feeCollector
        );
        
        // 给测试用户分配代币
        carbonToken.transfer(user1, 50_000 * 1e18);
        carbonToken.transfer(user2, 50_000 * 1e18);
        carbonToken.transfer(user3, 50_000 * 1e18);
        
        // 添加初始流动性到池子
        vm.startPrank(owner);
        carbonToken.approve(address(pool), INITIAL_LIQUIDITY_CARBON);
        IERC20(address(usdtToken)).approve(address(pool), INITIAL_LIQUIDITY_USDT);
        pool.addLiquidity(INITIAL_LIQUIDITY_CARBON, INITIAL_LIQUIDITY_USDT);
        vm.stopPrank();
        
        // 设置预言机价格
        oracle.setTestCarbonPriceUSD(880000000); // 88.00 USD
    }
    
    // ============ 基础功能测试 ============
    
    function test_Constructor() public {
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(address(market.usdtToken()), address(usdtToken));
        assertEq(address(market.ammPool()), address(pool));
        assertEq(market.platformFeeRate(), PLATFORM_FEE_RATE);
        assertEq(market.feeCollector(), feeCollector);
    }
    
    function test_UpdatePlatformFeeRate() public {
        market.updatePlatformFeeRate(200); // 2%
        assertEq(market.platformFeeRate(), 200);
    }
    
    function test_UpdatePlatformFeeRate_TooHigh() public {
        vm.expectRevert("Fee rate too high");
        market.updatePlatformFeeRate(1001); // 超过10%
    }
    
    function test_UpdateFeeCollector() public {
        address newCollector = makeAddr("newCollector");
        market.updateFeeCollector(newCollector);
        assertEq(market.feeCollector(), newCollector);
    }
    
    // ============ 限价单测试 ============
    
    function test_CreateBuyOrder() public {
        uint256 amount = 1_000 * 1e18; // 1000 carbon tokens
        uint256 price = 88 * 1e18;     // 88 USDT/carbon
        uint256 totalUSDT = amount * price / 1e18;
        
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(market), totalUSDT);
        
        vm.expectEmit(true, true, true, true);
        emit OrderCreated(0, user1, CarbonUSDTMarket.OrderType.Buy, amount, price, block.timestamp);
        
        uint256 orderId = market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        assertEq(orderId, 0, "Order ID should be 0");
        
        CarbonUSDTMarket.Order memory order = market.getOrder(orderId);
        assertEq(order.user, user1, "Order user error");
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Buy), "Order type error");
        assertEq(order.amount, amount, "Order amount error");
        assertEq(order.price, price, "Order price error");
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Active), "Order status should be Active");
    }
    
    function test_CreateSellOrder() public {
        uint256 amount = 1_000 * 1e18; // 1000 carbon tokens
        uint256 price = 88 * 1e18;     // 88 USDT/carbon
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        
        vm.expectEmit(true, true, true, true);
        emit OrderCreated(0, user1, CarbonUSDTMarket.OrderType.Sell, amount, price, block.timestamp);
        
        uint256 orderId = market.createSellOrder(amount, price);
        vm.stopPrank();
        
        assertEq(orderId, 0, "Order ID should be 0");
        
        CarbonUSDTMarket.Order memory order = market.getOrder(orderId);
        assertEq(order.user, user1, "Order user error");
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Sell), "Order type error");
        assertEq(order.amount, amount, "Order amount error");
        assertEq(order.price, price, "Order price error");
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Active), "Order status should be Active");
    }
    
    // ============ 市价单测试 ============
    
    function test_MarketBuy() public {
        uint256 amount = 1_000 * 1e18; // 1000 carbon tokens
        
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(market), 100_000 * 1e18); // Approve enough USDT
        
        vm.expectEmit(true, true, true, true);
        emit MarketOrderExecuted(user1, CarbonUSDTMarket.OrderType.Buy, amount, 88 * 1e18, block.timestamp);
        
        uint256 usdtSpent = market.marketBuy(amount);
        vm.stopPrank();
        
        assertGt(usdtSpent, 0, "Should spend USDT");
        
        // Check user received carbon tokens
        uint256 userCarbonBalance = carbonToken.balanceOf(user1);
        assertGt(userCarbonBalance, 0, "User should receive carbon tokens");
    }
    
    function test_MarketSell() public {
        uint256 amount = 1_000 * 1e18; // 1000 carbon tokens
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        
        vm.expectEmit(true, true, true, true);
        emit MarketOrderExecuted(user1, CarbonUSDTMarket.OrderType.Sell, amount, 88 * 1e18, block.timestamp);
        
        uint256 usdtReceived = market.marketSell(amount);
        vm.stopPrank();
        
        assertGt(usdtReceived, 0, "Should receive USDT");
        
        // Check user received USDT
        uint256 userUsdtBalance = IERC20(address(usdtToken)).balanceOf(user1);
        assertGt(userUsdtBalance, 0, "User should receive USDT");
    }
    
    // ============ 订单成交测试 ============
    
    function test_FillOrder_BuyOrder() public {
        // Create buy order
        uint256 amount = 1_000 * 1e18;
        uint256 price = 88 * 1e18;
        uint256 totalUSDT = amount * price / 1e18;
        
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(market), totalUSDT);
        uint256 buyOrderId = market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // Fill buy order
        vm.startPrank(user2);
        carbonToken.approve(address(market), amount);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(buyOrderId, user1, user2, amount, price, totalUSDT * PLATFORM_FEE_RATE / 10000, block.timestamp);
        
        market.fillOrder(buyOrderId);
        vm.stopPrank();
        
        // Check order status
        CarbonUSDTMarket.Order memory order = market.getOrder(buyOrderId);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled), "Order should be filled");
    }
    
    function test_FillOrder_SellOrder() public {
        // Create sell order
        uint256 amount = 1_000 * 1e18;
        uint256 price = 88 * 1e18;
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        uint256 sellOrderId = market.createSellOrder(amount, price);
        vm.stopPrank();
        
        // Fill sell order
        uint256 totalUSDT = amount * price / 1e18;
        vm.startPrank(user2);
        IERC20(address(usdtToken)).approve(address(market), totalUSDT);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(sellOrderId, user2, user1, amount, price, totalUSDT * PLATFORM_FEE_RATE / 10000, block.timestamp);
        
        market.fillOrder(sellOrderId);
        vm.stopPrank();
        
        // Check order status
        CarbonUSDTMarket.Order memory order = market.getOrder(sellOrderId);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled), "Order should be filled");
    }
    
    // ============ 订单取消测试 ============
    
    function test_CancelOrder() public {
        // Create buy order
        uint256 amount = 1_000 * 1e18;
        uint256 price = 88 * 1e18;
        uint256 totalUSDT = amount * price / 1e18;
        
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(market), totalUSDT);
        uint256 orderId = market.createBuyOrder(amount, price);
        
        // Record USDT balance before cancellation
        uint256 balanceBefore = IERC20(address(usdtToken)).balanceOf(user1);
        
        market.cancelOrder(orderId);
        vm.stopPrank();
        
        // Check order status
        CarbonUSDTMarket.Order memory order = market.getOrder(orderId);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Cancelled), "Order should be cancelled");
        
        // Check USDT is returned
        uint256 balanceAfter = IERC20(address(usdtToken)).balanceOf(user1);
        assertEq(balanceAfter, balanceBefore + totalUSDT, "USDT should be returned");
    }
    
    // ============ 查询功能测试 ============
    
    function test_GetMarketOrderEstimate() public {
        uint256 amount = 1_000 * 1e18;
        
        // Buy order estimate
        (uint256 estimatedAmount, uint256 estimatedFee, uint256 totalAmount) = 
            market.getMarketOrderEstimate(amount, true);
        
        assertGt(estimatedAmount, 0, "Estimated amount should be greater than 0");
        assertEq(estimatedFee, 0, "Market buy should have no platform fee");
        assertEq(totalAmount, estimatedAmount, "Total amount should equal estimated amount");
        
        // Sell order estimate
        (estimatedAmount, estimatedFee, totalAmount) = 
            market.getMarketOrderEstimate(amount, false);
        
        assertGt(estimatedAmount, 0, "Estimated amount should be greater than 0");
        assertEq(estimatedFee, 0, "Market sell should have no platform fee");
        assertEq(totalAmount, estimatedAmount, "Total amount should equal estimated amount");
    }
    
    function test_GetFeeRates() public {
        (uint256 platformFee, uint256 limitOrderFee, uint256 fillOrderFee) = 
            market.getFeeRates();
        
        assertEq(platformFee, PLATFORM_FEE_RATE, "Platform fee rate error");
        assertEq(limitOrderFee, LIMIT_ORDER_FEE_RATE, "Limit order fee rate error");
        assertEq(fillOrderFee, FILL_ORDER_FEE_RATE, "Fill order fee rate error");
    }
    
    // ============ 统计信息测试 ============
    
    function test_GetMarketStats() public {
        // Create and fill order
        vm.startPrank(user1);
        carbonToken.approve(address(market), 1_000 * 1e18);
        uint256 orderId = market.createSellOrder(1_000 * 1e18, 88 * 1e18);
        vm.stopPrank();
        
        vm.startPrank(user2);
        IERC20(address(usdtToken)).approve(address(market), 88_000 * 1e18);
        market.fillOrder(orderId);
        vm.stopPrank();
        
        // Query statistics
        (uint256 ordersCreated, uint256 ordersFilled, uint256 ordersCancelled, uint256 volumeTraded, uint256 feesCollected, uint256 nextOrderId) = 
            market.getMarketStats();
        
        assertEq(ordersCreated, 1, "Orders created count error");
        assertEq(ordersFilled, 1, "Orders filled count error");
        assertEq(ordersCancelled, 0, "Orders cancelled count error");
        assertGt(volumeTraded, 0, "Volume traded should be greater than 0");
        assertGt(feesCollected, 0, "Fees collected should be greater than 0");
        assertEq(nextOrderId, 1, "Next order ID should be 1");
    }
    
    // ============ 紧急功能测试 ============
    
    function test_EmergencyPause() public {
        market.setPaused(true);
        assertEq(market.paused(), true, "Contract should be paused");
        
        // Cannot create orders when paused
        vm.startPrank(user1);
        carbonToken.approve(address(market), 1_000 * 1e18);
        vm.expectRevert("Contract is paused");
        market.createSellOrder(1_000 * 1e18, 88 * 1e18);
        vm.stopPrank();
        
        // Resume contract
        market.setPaused(false);
        assertEq(market.paused(), false, "Contract should be resumed");
    }
    
    // ============ 边界条件测试 ============
    
    function test_CreateOrder_ZeroAmount() public {
        vm.startPrank(user1);
        carbonToken.approve(address(market), 1_000 * 1e18);
        
        vm.expectRevert("Amount must be greater than 0");
        market.createSellOrder(0, 88 * 1e18);
        vm.stopPrank();
    }
    
    function test_CreateOrder_ZeroPrice() public {
        vm.startPrank(user1);
        carbonToken.approve(address(market), 1_000 * 1e18);
        
        vm.expectRevert("Price must be greater than 0");
        market.createSellOrder(1_000 * 1e18, 0);
        vm.stopPrank();
    }
    
    function test_MarketOrder_ZeroAmount() public {
        vm.startPrank(user1);
        IERC20(address(usdtToken)).approve(address(market), 100_000 * 1e18);
        
        vm.expectRevert("Amount must be greater than 0");
        market.marketBuy(0);
        vm.stopPrank();
    }
} 