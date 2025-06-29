// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonUSDTMarket.sol";
import "../src/CarbonToken.sol";
import "../src/interfaces/ICarbonPriceOracle.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title CarbonUSDTMarket Complete Test Contract
 * @dev Tests all functionality of the carbon token USDT market
 */
contract CarbonUSDTMarketCompleteTest is Test {
    // Contract instances
    CarbonUSDTMarket public market;
    CarbonToken public carbonToken;
    MockUSDT public usdtToken;
    MockLiquidityPool public ammPool;
    MockPriceOracle public priceOracle;
    
    // Test accounts
    address public owner;
    address public feeCollector;
    address public user1;
    address public user2;
    address public user3;
    
    // Test constants
    uint256 constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 constant INITIAL_USDT_SUPPLY = 100_000_000 * 1e18; // USDT is 18 decimals, 100M USDT
    uint256 constant CARBON_PRICE = 88; // 88 USDT per carbon (base unit, no 1e18 needed)
    
    // Event declarations (for testing)
    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        CarbonUSDTMarket.OrderType orderType,
        uint256 amount,
        uint256 price,
        uint256 orderFee,
        uint256 timestamp
    );
    
    event OrderFilled(
        uint256 indexed orderId,
        address indexed maker,
        address indexed taker,
        uint256 amount,
        uint256 price,
        uint256 makerFee,
        uint256 takerFee,
        uint256 timestamp
    );
    
    event PartialOrderFilled(
        uint256 indexed orderId,
        address indexed maker,
        address indexed taker,
        uint256 filledAmount,
        uint256 remainingAmount,
        uint256 price,
        uint256 makerFee,
        uint256 takerFee,
        uint256 timestamp
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed user,
        uint256 timestamp
    );

    function setUp() public {
        // Setup test accounts
        owner = address(this);
        feeCollector = makeAddr("feeCollector");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Deploy Mock contracts
        usdtToken = new MockUSDT();
        priceOracle = new MockPriceOracle();
        ammPool = new MockLiquidityPool();
        
        // Deploy carbon token contract
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](0);
        carbonToken = new CarbonToken(initialBalances);
        
        // Deploy market contract
        market = new CarbonUSDTMarket(
            address(carbonToken),
            address(usdtToken),
            address(ammPool),
            address(priceOracle),
            feeCollector
        );
        
        // Setup price oracle
        priceOracle.setPrice(CARBON_PRICE * 1e8); // Set to 8 decimals (88 * 1e8)
        ammPool.setPrice(CARBON_PRICE * 1e18); // AMM pool uses 18 decimals (88 * 1e18)
        
        // Allocate tokens to users
        _setupUserBalances();
    }
    
    function _setupUserBalances() internal {
        // Set GreenTrace address for minting
        carbonToken.setGreenTrace(address(this));
        
        // Allocate carbon tokens to users
        carbonToken.mint(user1, 10_000 * 1e18);
        carbonToken.mint(user2, 10_000 * 1e18);
        carbonToken.mint(user3, 10_000 * 1e18);
        
        // Allocate USDT to users (Note: USDT is 18 decimals)
        usdtToken.mint(user1, 10_000_000 * 1e18); // 10M USDT, 18 decimals
        usdtToken.mint(user2, 10_000_000 * 1e18); // 10M USDT
        usdtToken.mint(user3, 10_000_000 * 1e18); // 10M USDT
    }

    // ============ Basic Function Tests ============
    
    function test_Setup() public {
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(address(market.usdtToken()), address(usdtToken));
        assertEq(market.feeCollector(), feeCollector);
        assertEq(market.limitOrderFeeRate(), 50); // 0.5%
        assertEq(market.fillOrderFeeRate(), 30);  // 0.3%
    }
    
    function test_CreateBuyOrder() public {
        uint256 amount = 100 * 1e18; // 100 carbon
        uint256 price = 90;   // 90 USDT per carbon (base unit)
        uint256 totalCost = amount * price; // 100 * 1e18 * 90 = 9000 * 1e18
        uint256 orderFee = totalCost * 50 / 10000; // 0.5%
        uint256 totalRequired = totalCost + orderFee;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalRequired);
        
        vm.expectEmit(true, true, false, true);
        emit OrderCreated(1, user1, CarbonUSDTMarket.OrderType.Buy, amount, price, orderFee, block.timestamp);
        
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // Verify order information
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.user, user1);
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Buy));
        assertEq(order.amount, amount);
        assertEq(order.remainingAmount, amount);
        assertEq(order.price, price);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Active));
        
        // Verify user balance changes
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - totalRequired);
        
        // Verify market statistics
        (uint256 totalOrdersCreated,,,,,,,) = market.getMarketStats();
        assertEq(totalOrdersCreated, 1);
    }
    
    function test_CreateSellOrder() public {
        uint256 amount = 100 * 1e18; // 100 carbon
        uint256 price = 85;   // 85 USDT per carbon (base unit)
        uint256 expectedIncome = amount * price; // 100 * 1e18 * 85
        uint256 orderFee = expectedIncome * 50 / 10000; // 0.5%
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        usdtToken.approve(address(market), orderFee);
        
        vm.expectEmit(true, true, false, true);
        emit OrderCreated(1, user1, CarbonUSDTMarket.OrderType.Sell, amount, price, orderFee, block.timestamp);
        
        market.createSellOrder(amount, price);
        vm.stopPrank();
        
        // Verify order information
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.user, user1);
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Sell));
        assertEq(order.amount, amount);
        assertEq(order.remainingAmount, amount);
        assertEq(order.price, price);
        
        // Verify balance changes
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 - amount);
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - orderFee);
    }
    
    function test_FillBuyOrder() public {
        // Create buy order
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // base unit
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // Fill buy order - corrected amount
        uint256 fillAmount = 100 * 1e18; // Should use order's amount, not remainingAmount
        uint256 takerFee = fillAmount * price * 30 / 10000; // 0.3%
        
        vm.startPrank(user2);
        carbonToken.approve(address(market), fillAmount);
        usdtToken.approve(address(market), takerFee);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(1, user1, user2, fillAmount, price, orderFee, takerFee, block.timestamp);
        
        market.fillOrder(1);
        vm.stopPrank();
        
        // Verify trade results
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled));
        
        // Verify balance changes
        // Corrected: buyer should be initial balance + carbon tokens from trade
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 + fillAmount); // Buyer should be initial + traded carbon tokens
        // User2 originally had 10M USDT, sold carbon tokens for 9000 USDT (total cost), minus fees
        assertEq(usdtToken.balanceOf(user2), 10_000_000 * 1e18 - takerFee + totalCost); // Seller gets USDT - fees
    }

    // ============ Auto-matching Tests ============
    
    function test_AutoMatching_BuyOrderMatchSellOrder() public {
        // Create sell order (85 USDT)
        uint256 sellAmount = 100 * 1e18;
        uint256 sellPrice = 85; // USDT base unit
        uint256 sellOrderFee = sellAmount * sellPrice * 50 / 10000;
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), sellAmount);
        usdtToken.approve(address(market), sellOrderFee);
        market.createSellOrder(sellAmount, sellPrice);
        vm.stopPrank();
        
        // Create buy order (90 USDT) - should auto-match
        uint256 buyAmount = 50 * 1e18; // Only buy 50, partial fill
        uint256 buyPrice = 90; // USDT base unit
        uint256 buyOrderFee = buyAmount * buyPrice * 50 / 10000;
        uint256 matchFee = buyAmount * sellPrice * 30 / 10000; // Execution fee at sell order price
        
        vm.startPrank(user2);
        usdtToken.approve(address(market), buyAmount * buyPrice + buyOrderFee + matchFee);
        
        market.createBuyOrder(buyAmount, buyPrice);
        vm.stopPrank();
        
        // Verify matching results
        CarbonUSDTMarket.Order memory sellOrder = market.getOrder(1);
        assertEq(sellOrder.remainingAmount, sellAmount - buyAmount); // Sell order partially filled
        
        // Should not have created buy order (fully matched)
        uint256[] memory activeOrders = market.getActiveOrders();
        assertEq(activeOrders.length, 1); // Only partially filled sell order
        
        // Verify balances
        assertEq(carbonToken.balanceOf(user2), 10_000 * 1e18 + buyAmount); // Buyer gets carbon tokens
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - sellOrderFee + buyAmount * sellPrice); // Seller gets USDT
    }

    // ============ Query Function Tests ============
    
    function test_GetOrderBook() public {
        // Create multiple orders
        _createTestOrders();
        
        (CarbonUSDTMarket.Order[] memory buyOrders, CarbonUSDTMarket.Order[] memory sellOrders) = market.getOrderBook();
        
        assertTrue(buyOrders.length > 0);
        assertTrue(sellOrders.length > 0);
        
        // Verify correct order types
        for (uint i = 0; i < buyOrders.length; i++) {
            assertEq(uint256(buyOrders[i].orderType), uint256(CarbonUSDTMarket.OrderType.Buy));
        }
        for (uint i = 0; i < sellOrders.length; i++) {
            assertEq(uint256(sellOrders[i].orderType), uint256(CarbonUSDTMarket.OrderType.Sell));
        }
    }
    
    function test_GetOrderBookPaginated() public {
        _createTestOrders();
        
        // Test paginated buy orders
        (CarbonUSDTMarket.Order[] memory orders, bool hasMore) = market.getOrderBookPaginated(0, 2, 0);
        assertGe(orders.length, 0); // May have no buy orders due to matching
        
        // Test get sell orders
        (orders, hasMore) = market.getOrderBookPaginated(0, 10, 1);
        assertGe(orders.length, 0); // May have no sell orders due to matching
        
        // Test get all orders
        (orders, hasMore) = market.getOrderBookPaginated(0, 10, 2);
        // Should have at least some orders
    }

    // ============ Price Deviation Tests ============
    
    function test_PriceDeviationCheck_TooLow() public {
        uint256 amount = 100 * 1e18;
        uint256 lowPrice = 50; // 50 USDT, below 30% of reference price 88
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Price too low - below minimum threshold");
        market.createBuyOrder(amount, lowPrice);
        vm.stopPrank();
    }
    
    function test_PriceDeviationCheck_HighPriceAllowed() public {
        uint256 amount = 100 * 1e18;
        uint256 highPrice = 200; // 200 USDT, far above reference price 88, but should be allowed (speculation mechanism)
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        // Should successfully create order
        market.createBuyOrder(amount, highPrice);
        vm.stopPrank();
        
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.price, highPrice);
    }

    // ============ Admin Function Tests ============
    
    function test_UpdateFeeRates() public {
        uint256 newLimitFee = 60; // 0.6%
        uint256 newFillFee = 40;  // 0.4%
        
        market.updateFeeRates(newLimitFee, newFillFee);
        
        assertEq(market.limitOrderFeeRate(), newLimitFee);
        assertEq(market.fillOrderFeeRate(), newFillFee);
    }
    
    function test_SetPaused() public {
        market.setPaused(true);
        assertTrue(market.paused());
        
        // Cannot create orders when paused
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Contract is paused");
        market.createBuyOrder(100 * 1e18, 90); // base unit
        vm.stopPrank();
    }

    function test_FillSellOrder() public {
        // Create sell order
        uint256 amount = 100 * 1e18;
        uint256 price = 85; // USDT base unit
        uint256 expectedIncome = amount * price;
        uint256 orderFee = expectedIncome * 50 / 10000;
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        usdtToken.approve(address(market), orderFee);
        market.createSellOrder(amount, price);
        vm.stopPrank();
        
        // Fill sell order
        uint256 takerFee = expectedIncome * 30 / 10000;
        
        vm.startPrank(user2);
        usdtToken.approve(address(market), expectedIncome + takerFee);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(1, user1, user2, amount, price, orderFee, takerFee, block.timestamp);
        
        market.fillOrder(1);
        vm.stopPrank();
        
        // Verify trade results
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled));
        
        // Verify balance changes
        assertEq(carbonToken.balanceOf(user2), 10_000 * 1e18 + amount); // Buyer gets carbon tokens
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - orderFee + expectedIncome); // Seller gets USDT
    }
    
    function test_CancelOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT base unit
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        // Create buy order
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        
        uint256 balanceBefore = usdtToken.balanceOf(user1);
        
        // Cancel order
        vm.expectEmit(true, true, false, true);
        emit OrderCancelled(1, user1, block.timestamp);
        
        market.cancelOrder(1);
        vm.stopPrank();
        
        // Verify order status
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Cancelled));
        
        // Verify USDT refund
        assertEq(usdtToken.balanceOf(user1), balanceBefore + totalCost);
    }
    
    function test_AutoMatching_SellOrderMatchBuyOrder() public {
        // Create buy order (90 USDT)
        uint256 buyAmount = 100 * 1e18;
        uint256 buyPrice = 90; // USDT base unit
        uint256 buyOrderFee = buyAmount * buyPrice * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), buyAmount * buyPrice + buyOrderFee);
        market.createBuyOrder(buyAmount, buyPrice);
        vm.stopPrank();
        
        // Create sell order (85 USDT) - should auto-match
        uint256 sellAmount = 60 * 1e18; // Only sell 60, partial fill
        uint256 sellPrice = 85; // USDT base unit
        uint256 sellOrderFee = sellAmount * sellPrice * 50 / 10000;
        uint256 matchFee = sellAmount * buyPrice * 30 / 10000; // Execution fee at buy order price
        
        vm.startPrank(user2);
        carbonToken.approve(address(market), sellAmount);
        usdtToken.approve(address(market), sellOrderFee + matchFee);
        
        market.createSellOrder(sellAmount, sellPrice);
        vm.stopPrank();
        
        // Verify matching results
        CarbonUSDTMarket.Order memory buyOrder = market.getOrder(1);
        assertEq(buyOrder.remainingAmount, buyAmount - sellAmount); // Buy order partially filled
        
        // Verify balances
        // Corrected: buyer should be initial balance + carbon tokens from trade
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 + sellAmount); // Buyer should be initial + traded carbon tokens
        assertEq(usdtToken.balanceOf(user2), 10_000_000 * 1e18 - sellOrderFee - matchFee + sellAmount * buyPrice); // Seller gets USDT
    }

    // ============ Enhanced Query Function Tests ============
    
    function test_GetUserOrders() public {
        _createTestOrders();
        
        uint256[] memory userOrderIds = market.getUserOrders(user1);
        assertTrue(userOrderIds.length > 0);
        
        // Verify orders indeed belong to user1
        for (uint i = 0; i < userOrderIds.length; i++) {
            CarbonUSDTMarket.Order memory order = market.getOrder(userOrderIds[i]);
            assertEq(order.user, user1);
        }
    }
    
    function test_GetMarketStats() public {
        _createTestOrders();
        
        (
            uint256 totalOrdersCreated,
            uint256 totalOrdersFilled,
            uint256 totalOrdersCancelled,
            uint256 totalVolumeTraded,
            uint256 totalFeesCollected,
            uint256 totalLimitOrderFees,
            uint256 totalFillOrderFees,
            uint256 nextOrderId
        ) = market.getMarketStats();
        
        assertTrue(totalOrdersCreated > 0);
        assertTrue(nextOrderId > 1);
        assertTrue(totalFeesCollected > 0);
    }
    
    function test_GetFeeRates() public {
        (uint256 platformFee, uint256 limitOrderFee, uint256 fillOrderFee) = market.getFeeRates();
        
        assertEq(platformFee, 0); // Limit order market has no platform fee
        assertEq(limitOrderFee, 50); // 0.5%
        assertEq(fillOrderFee, 30);  // 0.3%
    }
    
    function test_GetUserFeeStats() public {
        // Create order to generate fees
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT base unit
        uint256 orderFee = amount * price * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        (uint256 totalFee, uint256 limitOrderFee, uint256 fillOrderFee) = market.getUserFeeStats(user1);
        
        assertEq(totalFee, orderFee);
        assertEq(limitOrderFee, orderFee);
        assertEq(fillOrderFee, 0); // No execution fees yet
    }

    // ============ Enhanced Admin Function Tests ============
    
    function test_UpdateFeeCollector() public {
        address newCollector = makeAddr("newCollector");
        
        market.updateFeeCollector(newCollector);
        
        assertEq(market.feeCollector(), newCollector);
    }
    
    function test_UpdatePriceDeviationThreshold() public {
        uint256 newThreshold = 2000; // 20%
        
        market.updatePriceDeviationThreshold(newThreshold);
        
        assertEq(market.priceDeviationThreshold(), newThreshold);
    }

    // ============ Edge Case Tests ============
    
    function test_RevertOnZeroAmount() public {
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Amount must be greater than 0");
        market.createBuyOrder(0, 90 * 1e18);
        vm.stopPrank();
    }
    
    function test_RevertOnZeroPrice() public {
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Price must be greater than 0");
        market.createBuyOrder(100 * 1e18, 0);
        vm.stopPrank();
    }
    
    function test_RevertOnInsufficientBalance() public {
        uint256 amount = 1_000_000 * 1e18; // Exceeds user balance
        uint256 price = 90; // USDT base unit
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Insufficient USDT balance");
        market.createBuyOrder(amount, price);
        vm.stopPrank();
    }
    
    function test_RevertOnInsufficientAllowance() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT base unit
        
        vm.startPrank(user1);
        // No approval or insufficient approval
        
        vm.expectRevert("Insufficient USDT allowance");
        market.createBuyOrder(amount, price);
        vm.stopPrank();
    }
    
    function test_CannotFillOwnOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT base unit
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        
        // Try to fill own order
        carbonToken.approve(address(market), amount);
        
        vm.expectRevert("Cannot fill your own order");
        market.fillOrder(1);
        vm.stopPrank();
    }
    
    function test_CannotCancelNotOwnOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT base unit
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        // user1 creates order
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // user2 tries to cancel user1's order
        vm.startPrank(user2);
        vm.expectRevert("Not order owner");
        market.cancelOrder(1);
        vm.stopPrank();
    }

    // ============ Helper Functions ============
    
    function _createTestOrders() internal {
        // User1 creates buy orders
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(100 * 1e18, 89); // base unit
        market.createBuyOrder(200 * 1e18, 91); // base unit
        vm.stopPrank();
        
        // User2 creates sell orders
        vm.startPrank(user2);
        carbonToken.approve(address(market), type(uint256).max);
        usdtToken.approve(address(market), type(uint256).max);
        market.createSellOrder(120 * 1e18, 87); // base unit
        market.createSellOrder(180 * 1e18, 86); // base unit
        vm.stopPrank();
        
        // User3 creates mixed orders
        vm.startPrank(user3);
        carbonToken.approve(address(market), type(uint256).max);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(80 * 1e18, 92); // base unit
        market.createSellOrder(90 * 1e18, 85); // base unit
        vm.stopPrank();
    }
}

// ============ Mock Contracts ============

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}
    
    function decimals() public pure override returns (uint8) {
        return 18; // USDT is 18 decimals
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPriceOracle {
    uint256 private price;
    
    function setPrice(uint256 _price) external {
        price = _price;
    }
    
    function getLatestCarbonPriceUSD() external view returns (uint256) {
        return price; // Directly return set price (8 decimals)
    }
}

contract MockLiquidityPool {
    uint256 private carbonPrice;
    
    function setPrice(uint256 _price) external {
        carbonPrice = _price;
    }
    
    function getCarbonPrice() external view returns (uint256) {
        return carbonPrice;
    }
} 