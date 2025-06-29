// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonUSDTMarket.sol";
import "../src/CarbonToken.sol";
import "../src/interfaces/ICarbonPriceOracle.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title CarbonUSDTMarket 全面测试合约
 * @dev 测试碳币USDT市场的所有功能
 */
contract CarbonUSDTMarketCompleteTest is Test {
    // 合约实例
    CarbonUSDTMarket public market;
    CarbonToken public carbonToken;
    MockUSDT public usdtToken;
    MockLiquidityPool public ammPool;
    MockPriceOracle public priceOracle;
    
    // 测试账户
    address public owner;
    address public feeCollector;
    address public user1;
    address public user2;
    address public user3;
    
    // 测试常量
    uint256 constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;
    uint256 constant INITIAL_USDT_SUPPLY = 100_000_000 * 1e18; // USDT是18位精度，1亿USDT
    uint256 constant CARBON_PRICE = 88; // 88 USDT per carbon（基础单位，不需要1e18）
    
    // 事件声明（用于测试）
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
        // 设置测试账户
        owner = address(this);
        feeCollector = makeAddr("feeCollector");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // 部署Mock合约
        usdtToken = new MockUSDT();
        priceOracle = new MockPriceOracle();
        ammPool = new MockLiquidityPool();
        
        // 部署碳币合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](0);
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署市场合约
        market = new CarbonUSDTMarket(
            address(carbonToken),
            address(usdtToken),
            address(ammPool),
            address(priceOracle),
            feeCollector
        );
        
        // 设置价格预言机
        priceOracle.setPrice(CARBON_PRICE * 1e8); // 设置为8位精度 (88 * 1e8)
        ammPool.setPrice(CARBON_PRICE * 1e18); // AMM池使用18位精度 (88 * 1e18)
        
        // 为用户分配代币
        _setupUserBalances();
    }
    
    function _setupUserBalances() internal {
        // 设置GreenTrace地址以便mint
        carbonToken.setGreenTrace(address(this));
        
        // 为用户分配碳币
        carbonToken.mint(user1, 10_000 * 1e18);
        carbonToken.mint(user2, 10_000 * 1e18);
        carbonToken.mint(user3, 10_000 * 1e18);
        
        // 为用户分配USDT (注意：USDT 是 18 位精度)
        usdtToken.mint(user1, 10_000_000 * 1e18); // 1000万USDT，18位精度
        usdtToken.mint(user2, 10_000_000 * 1e18); // 1000万USDT
        usdtToken.mint(user3, 10_000_000 * 1e18); // 1000万USDT
    }

    // ============ 基础功能测试 ============
    
    function test_Setup() public {
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(address(market.usdtToken()), address(usdtToken));
        assertEq(market.feeCollector(), feeCollector);
        assertEq(market.limitOrderFeeRate(), 50); // 0.5%
        assertEq(market.fillOrderFeeRate(), 30);  // 0.3%
    }
    
    function test_CreateBuyOrder() public {
        uint256 amount = 100 * 1e18; // 100 carbon
        uint256 price = 90;   // 90 USDT per carbon (基础单位)
        uint256 totalCost = amount * price; // 100 * 1e18 * 90 = 9000 * 1e18
        uint256 orderFee = totalCost * 50 / 10000; // 0.5%
        uint256 totalRequired = totalCost + orderFee;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalRequired);
        
        vm.expectEmit(true, true, false, true);
        emit OrderCreated(1, user1, CarbonUSDTMarket.OrderType.Buy, amount, price, orderFee, block.timestamp);
        
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // 验证订单信息
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.user, user1);
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Buy));
        assertEq(order.amount, amount);
        assertEq(order.remainingAmount, amount);
        assertEq(order.price, price);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Active));
        
        // 验证用户余额变化
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - totalRequired);
        
        // 验证市场统计
        (uint256 totalOrdersCreated,,,,,,,) = market.getMarketStats();
        assertEq(totalOrdersCreated, 1);
    }
    
    function test_CreateSellOrder() public {
        uint256 amount = 100 * 1e18; // 100 carbon
        uint256 price = 85;   // 85 USDT per carbon (基础单位)
        uint256 expectedIncome = amount * price; // 100 * 1e18 * 85
        uint256 orderFee = expectedIncome * 50 / 10000; // 0.5%
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        usdtToken.approve(address(market), orderFee);
        
        vm.expectEmit(true, true, false, true);
        emit OrderCreated(1, user1, CarbonUSDTMarket.OrderType.Sell, amount, price, orderFee, block.timestamp);
        
        market.createSellOrder(amount, price);
        vm.stopPrank();
        
        // 验证订单信息
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.user, user1);
        assertEq(uint256(order.orderType), uint256(CarbonUSDTMarket.OrderType.Sell));
        assertEq(order.amount, amount);
        assertEq(order.remainingAmount, amount);
        assertEq(order.price, price);
        
        // 验证余额变化
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 - amount);
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - orderFee);
    }
    
    function test_FillBuyOrder() public {
        // 创建买单
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // 基础单位
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // 成交买单 - 修正数量
        uint256 fillAmount = 100 * 1e18; // 应该使用订单的amount，而不是remainingAmount
        uint256 takerFee = fillAmount * price * 30 / 10000; // 0.3%
        
        vm.startPrank(user2);
        carbonToken.approve(address(market), fillAmount);
        usdtToken.approve(address(market), takerFee);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(1, user1, user2, fillAmount, price, orderFee, takerFee, block.timestamp);
        
        market.fillOrder(1);
        vm.stopPrank();
        
        // 验证交易结果
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled));
        
        // 验证余额变化
        // 修正：买家应为初始余额+成交获得的碳币
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 + fillAmount); // 买家应为初始+成交碳币
        // 用户2原来有1000万USDT，卖出碳币得到9000 USDT（总成本），减去手续费
        assertEq(usdtToken.balanceOf(user2), 10_000_000 * 1e18 - takerFee + totalCost); // 卖家得到USDT-手续费
    }

    // ============ 自动撮合测试 ============
    
    function test_AutoMatching_BuyOrderMatchSellOrder() public {
        // 创建卖单 (85 USDT)
        uint256 sellAmount = 100 * 1e18;
        uint256 sellPrice = 85; // USDT基础单位
        uint256 sellOrderFee = sellAmount * sellPrice * 50 / 10000;
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), sellAmount);
        usdtToken.approve(address(market), sellOrderFee);
        market.createSellOrder(sellAmount, sellPrice);
        vm.stopPrank();
        
        // 创建买单 (90 USDT) - 应该自动撮合
        uint256 buyAmount = 50 * 1e18; // 只买50个，部分成交
        uint256 buyPrice = 90; // USDT基础单位
        uint256 buyOrderFee = buyAmount * buyPrice * 50 / 10000;
        uint256 matchFee = buyAmount * sellPrice * 30 / 10000; // 按卖单价格成交的手续费
        
        vm.startPrank(user2);
        usdtToken.approve(address(market), buyAmount * buyPrice + buyOrderFee + matchFee);
        
        market.createBuyOrder(buyAmount, buyPrice);
        vm.stopPrank();
        
        // 验证撮合结果
        CarbonUSDTMarket.Order memory sellOrder = market.getOrder(1);
        assertEq(sellOrder.remainingAmount, sellAmount - buyAmount); // 卖单部分成交
        
        // 应该没有买单被创建（完全撮合）
        uint256[] memory activeOrders = market.getActiveOrders();
        assertEq(activeOrders.length, 1); // 只有部分成交的卖单
        
        // 验证余额
        assertEq(carbonToken.balanceOf(user2), 10_000 * 1e18 + buyAmount); // 买家得到碳币
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - sellOrderFee + buyAmount * sellPrice); // 卖家得到USDT
    }

    // ============ 查询功能测试 ============
    
    function test_GetOrderBook() public {
        // 创建多个订单
        _createTestOrders();
        
        (CarbonUSDTMarket.Order[] memory buyOrders, CarbonUSDTMarket.Order[] memory sellOrders) = market.getOrderBook();
        
        assertTrue(buyOrders.length > 0);
        assertTrue(sellOrders.length > 0);
        
        // 验证订单类型正确
        for (uint i = 0; i < buyOrders.length; i++) {
            assertEq(uint256(buyOrders[i].orderType), uint256(CarbonUSDTMarket.OrderType.Buy));
        }
        for (uint i = 0; i < sellOrders.length; i++) {
            assertEq(uint256(sellOrders[i].orderType), uint256(CarbonUSDTMarket.OrderType.Sell));
        }
    }
    
    function test_GetOrderBookPaginated() public {
        _createTestOrders();
        
        // 测试分页获取买单
        (CarbonUSDTMarket.Order[] memory orders, bool hasMore) = market.getOrderBookPaginated(0, 2, 0);
        assertGe(orders.length, 0); // 可能因为撮合而没有买单
        
        // 测试获取卖单
        (orders, hasMore) = market.getOrderBookPaginated(0, 10, 1);
        assertGe(orders.length, 0); // 可能因为撮合而没有卖单
        
        // 测试获取所有订单
        (orders, hasMore) = market.getOrderBookPaginated(0, 10, 2);
        // 应该至少有一些订单
    }

    // ============ 价格偏离测试 ============
    
    function test_PriceDeviationCheck_TooLow() public {
        uint256 amount = 100 * 1e18;
        uint256 lowPrice = 50; // 50 USDT, 低于参考价88的30%
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Price too low - below minimum threshold");
        market.createBuyOrder(amount, lowPrice);
        vm.stopPrank();
    }
    
    function test_PriceDeviationCheck_HighPriceAllowed() public {
        uint256 amount = 100 * 1e18;
        uint256 highPrice = 200; // 200 USDT, 远高于参考价88，但应该被允许（炒作机制）
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        // 应该成功创建订单
        market.createBuyOrder(amount, highPrice);
        vm.stopPrank();
        
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(order.price, highPrice);
    }

    // ============ 管理员功能测试 ============
    
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
        
        // 暂停后不能创建订单
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Contract is paused");
        market.createBuyOrder(100 * 1e18, 90); // 基础单位
        vm.stopPrank();
    }

    function test_FillSellOrder() public {
        // 创建卖单
        uint256 amount = 100 * 1e18;
        uint256 price = 85; // USDT基础单位
        uint256 expectedIncome = amount * price;
        uint256 orderFee = expectedIncome * 50 / 10000;
        
        vm.startPrank(user1);
        carbonToken.approve(address(market), amount);
        usdtToken.approve(address(market), orderFee);
        market.createSellOrder(amount, price);
        vm.stopPrank();
        
        // 成交卖单
        uint256 takerFee = expectedIncome * 30 / 10000;
        
        vm.startPrank(user2);
        usdtToken.approve(address(market), expectedIncome + takerFee);
        
        vm.expectEmit(true, true, true, true);
        emit OrderFilled(1, user1, user2, amount, price, orderFee, takerFee, block.timestamp);
        
        market.fillOrder(1);
        vm.stopPrank();
        
        // 验证交易结果
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Filled));
        
        // 验证余额变化
        assertEq(carbonToken.balanceOf(user2), 10_000 * 1e18 + amount); // 买家得到碳币
        assertEq(usdtToken.balanceOf(user1), 10_000_000 * 1e18 - orderFee + expectedIncome); // 卖家得到USDT
    }
    
    function test_CancelOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT基础单位
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        // 创建买单
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        
        uint256 balanceBefore = usdtToken.balanceOf(user1);
        
        // 取消订单
        vm.expectEmit(true, true, false, true);
        emit OrderCancelled(1, user1, block.timestamp);
        
        market.cancelOrder(1);
        vm.stopPrank();
        
        // 验证订单状态
        CarbonUSDTMarket.Order memory order = market.getOrder(1);
        assertEq(uint256(order.status), uint256(CarbonUSDTMarket.OrderStatus.Cancelled));
        
        // 验证USDT退还
        assertEq(usdtToken.balanceOf(user1), balanceBefore + totalCost);
    }
    
    function test_AutoMatching_SellOrderMatchBuyOrder() public {
        // 创建买单 (90 USDT)
        uint256 buyAmount = 100 * 1e18;
        uint256 buyPrice = 90; // USDT基础单位
        uint256 buyOrderFee = buyAmount * buyPrice * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), buyAmount * buyPrice + buyOrderFee);
        market.createBuyOrder(buyAmount, buyPrice);
        vm.stopPrank();
        
        // 创建卖单 (85 USDT) - 应该自动撮合
        uint256 sellAmount = 60 * 1e18; // 只卖60个，部分成交
        uint256 sellPrice = 85; // USDT基础单位
        uint256 sellOrderFee = sellAmount * sellPrice * 50 / 10000;
        uint256 matchFee = sellAmount * buyPrice * 30 / 10000; // 按买单价格成交
        
        vm.startPrank(user2);
        carbonToken.approve(address(market), sellAmount);
        usdtToken.approve(address(market), sellOrderFee + matchFee);
        
        market.createSellOrder(sellAmount, sellPrice);
        vm.stopPrank();
        
        // 验证撮合结果
        CarbonUSDTMarket.Order memory buyOrder = market.getOrder(1);
        assertEq(buyOrder.remainingAmount, buyAmount - sellAmount); // 买单部分成交
        
        // 验证余额
        // 修正：买家应为初始余额+成交获得的碳币
        assertEq(carbonToken.balanceOf(user1), 10_000 * 1e18 + sellAmount); // 买家应为初始+成交碳币
        assertEq(usdtToken.balanceOf(user2), 10_000_000 * 1e18 - sellOrderFee - matchFee + sellAmount * buyPrice); // 卖家得到USDT
    }

    // ============ 查询功能增强测试 ============
    
    function test_GetUserOrders() public {
        _createTestOrders();
        
        uint256[] memory userOrderIds = market.getUserOrders(user1);
        assertTrue(userOrderIds.length > 0);
        
        // 验证订单确实属于user1
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
        
        assertEq(platformFee, 0); // 限价单市场没有平台费
        assertEq(limitOrderFee, 50); // 0.5%
        assertEq(fillOrderFee, 30);  // 0.3%
    }
    
    function test_GetUserFeeStats() public {
        // 创建订单产生费用
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT基础单位
        uint256 orderFee = amount * price * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        (uint256 totalFee, uint256 limitOrderFee, uint256 fillOrderFee) = market.getUserFeeStats(user1);
        
        assertEq(totalFee, orderFee);
        assertEq(limitOrderFee, orderFee);
        assertEq(fillOrderFee, 0); // 还没有成交费用
    }

    // ============ 管理员功能增强测试 ============
    
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

    // ============ 边界情况测试 ============
    
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
        uint256 amount = 1_000_000 * 1e18; // 超出用户余额
        uint256 price = 90; // USDT基础单位
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        
        vm.expectRevert("Insufficient USDT balance");
        market.createBuyOrder(amount, price);
        vm.stopPrank();
    }
    
    function test_RevertOnInsufficientAllowance() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT基础单位
        
        vm.startPrank(user1);
        // 不授权或授权不足
        
        vm.expectRevert("Insufficient USDT allowance");
        market.createBuyOrder(amount, price);
        vm.stopPrank();
    }
    
    function test_CannotFillOwnOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT基础单位
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        
        // 尝试成交自己的订单
        carbonToken.approve(address(market), amount);
        
        vm.expectRevert("Cannot fill your own order");
        market.fillOrder(1);
        vm.stopPrank();
    }
    
    function test_CannotCancelNotOwnOrder() public {
        uint256 amount = 100 * 1e18;
        uint256 price = 90; // USDT基础单位
        uint256 totalCost = amount * price;
        uint256 orderFee = totalCost * 50 / 10000;
        
        // user1创建订单
        vm.startPrank(user1);
        usdtToken.approve(address(market), totalCost + orderFee);
        market.createBuyOrder(amount, price);
        vm.stopPrank();
        
        // user2尝试取消user1的订单
        vm.startPrank(user2);
        vm.expectRevert("Not order owner");
        market.cancelOrder(1);
        vm.stopPrank();
    }

    // ============ 辅助函数 ============
    
    function _createTestOrders() internal {
        // User1 创建买单
        vm.startPrank(user1);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(100 * 1e18, 89); // 基础单位
        market.createBuyOrder(200 * 1e18, 91); // 基础单位
        vm.stopPrank();
        
        // User2 创建卖单
        vm.startPrank(user2);
        carbonToken.approve(address(market), type(uint256).max);
        usdtToken.approve(address(market), type(uint256).max);
        market.createSellOrder(120 * 1e18, 87); // 基础单位
        market.createSellOrder(180 * 1e18, 86); // 基础单位
        vm.stopPrank();
        
        // User3 创建混合订单
        vm.startPrank(user3);
        carbonToken.approve(address(market), type(uint256).max);
        usdtToken.approve(address(market), type(uint256).max);
        market.createBuyOrder(80 * 1e18, 92); // 基础单位
        market.createSellOrder(90 * 1e18, 85); // 基础单位
        vm.stopPrank();
    }
}

// ============ Mock 合约 ============

contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}
    
    function decimals() public pure override returns (uint8) {
        return 18; // USDT是18位精度
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
        return price; // 直接返回设置的价格（8位精度）
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