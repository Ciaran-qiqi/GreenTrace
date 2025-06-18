// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IUSDT.sol";

/**
 * @title CarbonUSDTMarket
 * @dev 碳币和USDT的交易市场合约
 * @notice 支持碳币和USDT之间的双向交易,包括限价单和市价单
 * 
 * 主要功能：
 * 1. 限价单交易：用户可以设置特定价格进行交易
 * 2. 市价单交易：用户可以按照当前最优价格立即成交
 * 3. 订单管理：支持创建、取消、查询订单
 * 4. 价格管理：维护碳币/USDT的实时价格
 * 5. 流动性管理：支持添加和移除流动性
 * 6. 手续费管理：支持设置和收取交易手续费
 */
contract CarbonUSDTMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    using SafeERC20 for IUSDT;

    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    IUSDT public usdtToken;           // USDT合约
    uint256 public platformFeeRate;    // 平台手续费率（基点，1基点 = 0.01%）
    address public feeCollector;       // 手续费接收地址

    // 订单类型枚举
    enum OrderType { Buy, Sell }       // 买单、卖单

    // 订单状态枚举
    enum OrderStatus { Active, Filled, Cancelled }  // 活跃、已成交、已取消

    // 订单结构体
    struct Order {
        address user;          // 用户地址
        OrderType orderType;   // 订单类型
        uint256 amount;        // 订单数量
        uint256 price;         // 订单价格
        uint256 timestamp;     // 创建时间
        OrderStatus status;    // 订单状态
    }

    // 映射关系
    mapping(uint256 => Order) public orders;        // 订单ID => 订单信息
    uint256 public nextOrderId;                     // 下一个订单ID

    // 事件定义
    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        OrderType orderType,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );
    event OrderFilled(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 price,
        uint256 platformFee,
        uint256 timestamp
    );
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed user,
        uint256 timestamp
    );
    event PlatformFeeRateUpdated(uint256 newRate);
    event FeeCollectorUpdated(address newCollector);

    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _usdtToken USDT合约地址
     * @param _platformFeeRate 平台手续费率（基点）
     * @param _feeCollector 手续费接收地址
     */
    constructor(
        address _carbonToken,
        address _usdtToken,
        uint256 _platformFeeRate,
        address _feeCollector
    ) Ownable() {
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IUSDT(_usdtToken);
        platformFeeRate = _platformFeeRate;
        feeCollector = _feeCollector;
    }

    /**
     * @dev 更新平台手续费率
     * @param _newRate 新的手续费率（基点）
     * @notice 只有合约所有者可以调用此函数
     * @notice 手续费率最高为10%（1000基点）
     */
    function updatePlatformFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 1000, "Fee rate too high"); // 最高10%
        platformFeeRate = _newRate;
        emit PlatformFeeRateUpdated(_newRate);
    }

    /**
     * @dev 更新手续费接收地址
     * @param _newCollector 新的接收地址
     * @notice 只有合约所有者可以调用此函数
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(_newCollector);
    }

    /**
     * @dev 创建买单
     * @param _amount 购买数量（碳币）
     * @param _price 购买价格（USDT）
     * @return orderId 订单ID
     * @notice 用户需要授权足够的USDT给合约
     */
    function createBuyOrder(uint256 _amount, uint256 _price) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");

        uint256 orderId = nextOrderId++;
        uint256 totalUSDT = _amount * _price;

        // 转移USDT到合约
        usdtToken.safeTransferFrom(msg.sender, address(this), totalUSDT);   

        // 创建订单
        orders[orderId] = Order({
            user: msg.sender,
            orderType: OrderType.Buy,
            amount: _amount,
            price: _price,
            timestamp: block.timestamp,
            status: OrderStatus.Active
        });

        emit OrderCreated(orderId, msg.sender, OrderType.Buy, _amount, _price, block.timestamp);
        return orderId;
    }

    /**
     * @dev 创建卖单
     * @param _amount 出售数量（碳币）
     * @param _price 出售价格（USDT）
     * @return orderId 订单ID
     * @notice 用户需要授权足够的碳币给合约
     */
    function createSellOrder(uint256 _amount, uint256 _price) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");

        uint256 orderId = nextOrderId++;

        // 转移碳币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), _amount);

        // 创建订单
        orders[orderId] = Order({
            user: msg.sender,
            orderType: OrderType.Sell,
            amount: _amount,
            price: _price,
            timestamp: block.timestamp,
            status: OrderStatus.Active
        });

        emit OrderCreated(orderId, msg.sender, OrderType.Sell, _amount, _price, block.timestamp);
        return orderId;
    }

    /**
     * @dev 成交订单
     * @param _orderId 订单ID
     * @notice 买单需要提供足够的碳币，卖单需要提供足够的USDT
     */
    function fillOrder(uint256 _orderId) external nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user != msg.sender, "Cannot fill your own order");

        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;
        uint256 platformFee = (totalUSDT * platformFeeRate) / 10000;
        uint256 sellerAmount = totalUSDT - platformFee;

        if (order.orderType == OrderType.Buy) {
            // 买单成交：卖家提供碳币，获得USDT
            carbonToken.safeTransferFrom(msg.sender, order.user, amount);
            usdtToken.safeTransfer(msg.sender, sellerAmount);
            usdtToken.safeTransfer(feeCollector, platformFee);
        } else {
            // 卖单成交：买家提供USDT，获得碳币
            usdtToken.safeTransferFrom(msg.sender, address(this), totalUSDT);
            carbonToken.safeTransfer(msg.sender, amount);
            usdtToken.safeTransfer(order.user, sellerAmount);
            usdtToken.safeTransfer(feeCollector, platformFee);
        }

        order.status = OrderStatus.Filled;

        emit OrderFilled(
            _orderId,
            order.orderType == OrderType.Buy ? order.user : msg.sender,
            order.orderType == OrderType.Buy ? msg.sender : order.user,
            amount,
            price,
            platformFee,
            block.timestamp
        );
    }

    /**
     * @dev 取消订单
     * @param _orderId 订单ID
     * @notice 只有订单创建者可以取消订单
     */
    function cancelOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user == msg.sender, "Not order owner");

        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;

        if (order.orderType == OrderType.Buy) {
            // 返还USDT给买家
            usdtToken.safeTransfer(msg.sender, totalUSDT);
        } else {
            // 返还碳币给卖家
            carbonToken.safeTransfer(msg.sender, amount);
        }

        order.status = OrderStatus.Cancelled;

        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    /**
     * @dev 获取订单信息
     * @param _orderId 订单ID
     * @return 订单信息
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }
} 