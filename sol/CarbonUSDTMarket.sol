// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesLiquidityPool.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CarbonUSDTMarket
 * @dev 碳币和USDT的交易市场合约，与AMM池集成
 * 
 * 手续费结构：
 * 1. 市价单：只收平台手续费，Pool收0.3%手续费
 * 2. 限价单：收挂单费、成交费、平台手续费
 */
contract CarbonUSDTMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    using SafeERC20 for IERC20;

    // 常量定义 - 优化Gas使用
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant POOL_FEE_RATE = 30; // 0.3%
    uint256 private constant MAX_FEE_RATE = 1000; // 10%
    uint256 private constant PRICE_PRECISION = 1e18;

    // 合约状态变量 - 优化存储布局
    CarbonToken public immutable carbonToken;
    IERC20 public immutable usdtToken;
    GreenTalesLiquidityPool public immutable ammPool;
    
    // 手续费配置
    uint256 public platformFeeRate;    // 平台手续费率（基点）
    uint256 public limitOrderFeeRate;  // 限价单挂单手续费率（基点）
    uint256 public fillOrderFeeRate;   // 限价单成交手续费率（基点）
    address public feeCollector;

    // 限价单价格限制参数
    uint256 public limitOrderPriceDeviationMultiplier = 2;
    uint256 public maxLimitOrderDeviation = 50;

    // 紧急暂停状态
    bool public paused;

    // 统计信息 - 打包到结构体中以节省Gas
    struct MarketStats {
        uint256 totalOrdersCreated;
        uint256 totalOrdersFilled;
        uint256 totalOrdersCancelled;
        uint256 totalVolumeTraded;
        uint256 totalFeesCollected;
        uint256 nextOrderId;
    }
    MarketStats public marketStats;

    // 订单类型枚举
    enum OrderType { Buy, Sell }
    enum OrderStatus { Active, Filled, Cancelled }

    // 订单结构体 - 优化存储布局
    struct Order {
        address user;
        OrderType orderType;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
        OrderStatus status;
        uint256 orderFee;
    }

    // 映射关系
    mapping(uint256 => Order) public orders;

    // 事件定义
    event OrderCreated(uint256 indexed orderId, address indexed user, OrderType orderType, uint256 amount, uint256 price, uint256 timestamp);
    event OrderFilled(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount, uint256 price, uint256 platformFee, uint256 timestamp);
    event OrderCancelled(uint256 indexed orderId, address indexed user, uint256 timestamp);
    event MarketOrderExecuted(address indexed user, OrderType orderType, uint256 amount, uint256 price, uint256 timestamp);
    event PlatformFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event LimitOrderFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FillOrderFeeRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /**
     * @dev 构造函数
     */
    constructor(
        address _carbonToken,
        address _usdtToken,
        address _ammPool,
        uint256 _platformFeeRate,
        uint256 _limitOrderFeeRate,
        uint256 _fillOrderFeeRate,
        address _feeCollector
    ) Ownable() {
        require(_carbonToken != address(0), "Invalid carbon token");
        require(_usdtToken != address(0), "Invalid USDT token");
        require(_ammPool != address(0), "Invalid AMM pool");
        require(_feeCollector != address(0), "Invalid fee collector");
        require(_platformFeeRate <= MAX_FEE_RATE, "Platform fee too high");
        require(_limitOrderFeeRate <= MAX_FEE_RATE, "Limit order fee too high");
        require(_fillOrderFeeRate <= MAX_FEE_RATE, "Fill order fee too high");
        
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IERC20(_usdtToken);
        ammPool = GreenTalesLiquidityPool(_ammPool);
        platformFeeRate = _platformFeeRate;
        limitOrderFeeRate = _limitOrderFeeRate;
        fillOrderFeeRate = _fillOrderFeeRate;
        feeCollector = _feeCollector;
    }

    /**
     * @dev 市价买单 - 直接调用AMM池，不额外收平台手续费
     */
    function marketBuy(uint256 _amount) external whenNotPaused returns (uint256 usdtSpent) {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 ammPrice = ammPool.getCarbonPrice();
        require(ammPrice > 0, "AMM pool price not available");
        
        // 计算需要的USDT数量（考虑Pool的0.3%手续费）
        uint256 adjustedAmount = (_amount * (BASIS_POINTS + POOL_FEE_RATE)) / BASIS_POINTS;
        uint256 estimatedUSDT = (adjustedAmount * ammPrice) / PRICE_PRECISION;
        
        // 转移USDT到合约
        usdtToken.safeTransferFrom(msg.sender, address(this), estimatedUSDT);
        
        // 调用AMM池进行兑换（添加失败处理）
        uint256 actualCarbonReceived;
        try ammPool.swapUsdtToCarbon(estimatedUSDT) returns (uint256 received) {
            actualCarbonReceived = received;
        } catch {
            // 兑换失败，返还所有USDT给用户
            usdtToken.safeTransfer(msg.sender, estimatedUSDT);
            revert("AMM swap failed");
        }
        
        // 转移实际获得的碳币给用户
        carbonToken.safeTransfer(msg.sender, actualCarbonReceived);
        
        marketStats.totalVolumeTraded += estimatedUSDT;
        emit MarketOrderExecuted(msg.sender, OrderType.Buy, actualCarbonReceived, ammPrice, block.timestamp);
        return estimatedUSDT;
    }

    /**
     * @dev 市价卖单 - 直接调用AMM池，不额外收平台手续费
     */
    function marketSell(uint256 _amount) external whenNotPaused returns (uint256 usdtReceived) {
        require(_amount > 0, "Amount must be greater than 0");
        
        // 转移碳币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), _amount);
        
        // 调用AMM池进行兑换（添加失败处理）
        uint256 received;
        try ammPool.swapCarbonToUsdt(_amount) returns (uint256 result) {
            received = result;
        } catch {
            // 兑换失败，返还碳币给用户
            carbonToken.safeTransfer(msg.sender, _amount);
            revert("AMM swap failed");
        }
        usdtReceived = received;
        
        // 转移USDT给用户（AMM池已扣除手续费）
        usdtToken.safeTransfer(msg.sender, usdtReceived);
        
        uint256 ammPrice = ammPool.getCarbonPrice();
        marketStats.totalVolumeTraded += usdtReceived;
        emit MarketOrderExecuted(msg.sender, OrderType.Sell, _amount, ammPrice, block.timestamp);
        return usdtReceived;
    }

    /**
     * @dev 创建买单
     */
    function createBuyOrder(uint256 _amount, uint256 _price) external whenNotPaused returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");

        uint256 orderId = marketStats.nextOrderId++;
        
        uint256 totalUSDT = _amount * _price;
        uint256 orderFee = (totalUSDT * limitOrderFeeRate) / BASIS_POINTS;
        uint256 totalRequired = totalUSDT + orderFee;

        // 转移USDT到合约（包含挂单手续费）
        usdtToken.safeTransferFrom(msg.sender, address(this), totalRequired);   

        // 转移挂单手续费给收集者
        if (orderFee > 0) {
            usdtToken.safeTransfer(feeCollector, orderFee);
            marketStats.totalFeesCollected += orderFee;
        }

        // 创建订单
        orders[orderId] = Order({
            user: msg.sender,
            orderType: OrderType.Buy,
            amount: _amount,
            price: _price,
            timestamp: block.timestamp,
            status: OrderStatus.Active,
            orderFee: orderFee
        });

        marketStats.totalOrdersCreated++;
        emit OrderCreated(orderId, msg.sender, OrderType.Buy, _amount, _price, block.timestamp);
        return orderId;
    }

    /**
     * @dev 创建卖单
     */
    function createSellOrder(uint256 _amount, uint256 _price) external whenNotPaused returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");

        uint256 orderId = marketStats.nextOrderId++;

        uint256 totalUSDT = _amount * _price;
        uint256 orderFee = (totalUSDT * limitOrderFeeRate) / BASIS_POINTS;

        // 转移碳币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), _amount);

        // 转移挂单手续费（USDT）给收集者
        if (orderFee > 0) {
            usdtToken.safeTransferFrom(msg.sender, address(this), orderFee);
            usdtToken.safeTransfer(feeCollector, orderFee);
            marketStats.totalFeesCollected += orderFee;
        }

        // 创建订单
        orders[orderId] = Order({
            user: msg.sender,
            orderType: OrderType.Sell,
            amount: _amount,
            price: _price,
            timestamp: block.timestamp,
            status: OrderStatus.Active,
            orderFee: orderFee
        });

        marketStats.totalOrdersCreated++;
        emit OrderCreated(orderId, msg.sender, OrderType.Sell, _amount, _price, block.timestamp);
        return orderId;
    }

    /**
     * @dev 成交订单
     */
    function fillOrder(uint256 _orderId) external nonReentrant whenNotPaused {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user != msg.sender, "Cannot fill your own order");

        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;
        
        // 计算成交手续费（成交手续费 + 平台手续费）
        uint256 fillFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        uint256 platformFee = (totalUSDT * platformFeeRate) / BASIS_POINTS;
        uint256 totalFee = fillFee + platformFee;
        uint256 sellerAmount = totalUSDT - totalFee;

        if (order.orderType == OrderType.Buy) {
            // 买单成交：卖家提供碳币，获得USDT
            carbonToken.safeTransferFrom(msg.sender, order.user, amount);
            usdtToken.safeTransfer(msg.sender, sellerAmount);
            usdtToken.safeTransfer(feeCollector, totalFee);
        } else {
            // 卖单成交：买家提供USDT，获得碳币
            usdtToken.safeTransferFrom(msg.sender, address(this), totalUSDT);
            carbonToken.safeTransfer(msg.sender, amount);
            usdtToken.safeTransfer(order.user, sellerAmount);
            usdtToken.safeTransfer(feeCollector, totalFee);
        }

        order.status = OrderStatus.Filled;

        marketStats.totalOrdersFilled++;
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += totalFee;

        emit OrderFilled(
            _orderId,
            order.orderType == OrderType.Buy ? order.user : msg.sender,
            order.orderType == OrderType.Buy ? msg.sender : order.user,
            amount,
            price,
            totalFee,
            block.timestamp
        );
    }

    /**
     * @dev 取消订单
     */
    function cancelOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user == msg.sender, "Not order owner");

        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;

        if (order.orderType == OrderType.Buy) {
            // 返还USDT给买家（不包含挂单手续费）
            usdtToken.safeTransfer(msg.sender, totalUSDT);
        } else {
            // 返还碳币给卖家
            carbonToken.safeTransfer(msg.sender, amount);
        }

        order.status = OrderStatus.Cancelled;
        marketStats.totalOrdersCancelled++;

        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    /**
     * @dev 获取订单信息
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    /**
     * @dev 获取市价单费用估算
     */
    function getMarketOrderEstimate(uint256 _amount, bool _isBuy) external view returns (
        uint256 estimatedAmount,
        uint256 platformFee,
        uint256 totalAmount
    ) {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 ammPrice = ammPool.getCarbonPrice();
        require(ammPrice > 0, "AMM pool price not available");
        
        if (_isBuy) {
            // 买单：用USDT买碳币
            uint256 adjustedAmount = (_amount * (BASIS_POINTS + POOL_FEE_RATE)) / BASIS_POINTS;
            estimatedAmount = (adjustedAmount * ammPrice) / PRICE_PRECISION;
            
            // 只收AMM池手续费，不额外收Market平台手续费
            platformFee = 0;
            totalAmount = estimatedAmount;
        } else {
            // 卖单：卖碳币得USDT
            estimatedAmount = (_amount * ammPrice) / PRICE_PRECISION;
            // 只扣除Pool手续费，不额外收Market平台手续费
            uint256 afterPoolFee = estimatedAmount * (BASIS_POINTS - POOL_FEE_RATE) / BASIS_POINTS;
            platformFee = 0;
            totalAmount = afterPoolFee;
        }
        
        return (estimatedAmount, platformFee, totalAmount);
    }

    /**
     * @dev 获取所有手续费率信息
     */
    function getFeeRates() external view returns (
        uint256 platformFee,
        uint256 limitOrderFee,
        uint256 fillOrderFee
    ) {
        return (
            platformFeeRate,
            limitOrderFeeRate,
            fillOrderFeeRate
        );
    }

    /**
     * @dev 紧急暂停修饰器
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev 紧急暂停/恢复合约
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev 更新平台手续费率
     * @param _newRate 新的平台手续费率（基点）
     * @notice 只有合约所有者可以调用此函数
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= MAX_FEE_RATE, "Fee rate too high"); // 最高10%
        uint256 oldRate = platformFeeRate;
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(oldRate, _newRate);
    }

    /**
     * @dev 更新限价单挂单手续费率
     * @param _newRate 新的限价单挂单手续费率（基点）
     * @notice 只有合约所有者可以调用此函数
     */
    function updateLimitOrderFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= MAX_FEE_RATE, "Fee rate too high"); // 最高10%
        uint256 oldRate = limitOrderFeeRate;
        limitOrderFeeRate = _newRate;
        emit LimitOrderFeeRateUpdated(oldRate, _newRate);
    }

    /**
     * @dev 更新限价单成交手续费率
     * @param _newRate 新的限价单成交手续费率（基点）
     * @notice 只有合约所有者可以调用此函数
     */
    function updateFillOrderFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= MAX_FEE_RATE, "Fee rate too high"); // 最高10%
        uint256 oldRate = fillOrderFeeRate;
        fillOrderFeeRate = _newRate;
        emit FillOrderFeeRateUpdated(oldRate, _newRate);
    }

    /**
     * @dev 更新手续费收集者地址
     * @param _newCollector 新的手续费收集者地址
     * @notice 只有合约所有者可以调用此函数
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        address oldCollector = feeCollector;
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(oldCollector, _newCollector);
    }

    /**
     * @dev 获取市场统计信息
     */
    function getMarketStats() external view returns (
        uint256 totalOrdersCreated,
        uint256 totalOrdersFilled,
        uint256 totalOrdersCancelled,
        uint256 totalVolumeTraded,
        uint256 totalFeesCollected,
        uint256 nextOrderId
    ) {
        return (
            marketStats.totalOrdersCreated,
            marketStats.totalOrdersFilled,
            marketStats.totalOrdersCancelled,
            marketStats.totalVolumeTraded,
            marketStats.totalFeesCollected,
            marketStats.nextOrderId
        );
    }
} 