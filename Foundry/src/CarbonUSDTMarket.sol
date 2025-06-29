// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesLiquidityPool.sol";
import "./interfaces/ICarbonPriceOracle.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title CarbonUSDTMarket
 * @dev 碳币和USDT的限价单交易市场合约
 * @notice 专门处理限价单订单簿功能，市价单请直接使用GreenTalesLiquidityPool
 * 
 * 主要功能：
 * 1. 限价单创建：用户可以创建买单和卖单
 * 2. 订单成交：用户可以成交其他用户的订单
 * 3. 订单取消：用户可以取消自己的订单
 * 4. 价格保护：集成预言机进行价格偏离检查
 * 5. 手续费收取：收取挂单费和成交费
 */
contract CarbonUSDTMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    using SafeERC20 for IERC20;

    // 常量定义
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_FEE_RATE = 1000; // 10%
    uint256 private constant PRICE_PRECISION = 1e18;

    // 合约状态变量
    CarbonToken public immutable carbonToken;
    IERC20 public immutable usdtToken;
    GreenTalesLiquidityPool public immutable ammPool;
    ICarbonPriceOracle public immutable priceOracle;
    
    // 手续费配置
    uint256 public limitOrderFeeRate = 50;  // 限价单挂单手续费率（基点）0.5%
    uint256 public fillOrderFeeRate = 30;   // 限价单成交手续费率（基点）0.3%
    address public feeCollector;

    // 价格偏离阈值的配置（炒作友好机制）
    uint256 public priceDeviationThreshold = 3000; // 30%下限阈值（不允许低于参考价30%，上限无限制）
    
    // 紧急暂停状态
    bool public paused;

    // 统计信息
    struct MarketStats {
        uint256 totalOrdersCreated;
        uint256 totalOrdersFilled;
        uint256 totalOrdersCancelled;
        uint256 totalVolumeTraded;
        uint256 totalFeesCollected;      // 总手续费（保持向后兼容）
        uint256 totalLimitOrderFees;     // 总挂单手续费
        uint256 totalFillOrderFees;      // 总成交手续费
        uint256 nextOrderId;
    }
    MarketStats public marketStats;

    // 手续费记录映射
    mapping(address => uint256) public userTotalFeePaid;        // 用户总支付手续费
    mapping(address => uint256) public userLimitOrderFeePaid;   // 用户挂单手续费
    mapping(address => uint256) public userFillOrderFeePaid;    // 用户成交手续费
    
    // 每日手续费统计（可选：按天统计）
    mapping(uint256 => uint256) public dailyFeesCollected;     // 日期 => 当日手续费总额

    // 订单类型枚举
    enum OrderType { Buy, Sell }
    enum OrderStatus { Active, Filled, Cancelled }

    // 订单结构体
    struct Order {
        address user;           // 订单创建者
        OrderType orderType;    // 订单类型：买单/卖单
        uint256 amount;         // 碳币数量（原始总量）
        uint256 remainingAmount; // 剩余未成交数量
        uint256 price;          // 价格（USDT，基础单位）
        uint256 timestamp;      // 创建时间
        OrderStatus status;     // 订单状态
        uint256 orderFee;       // 挂单手续费
    }

    // 映射关系
    mapping(uint256 => Order) public orders;           // 订单ID => 订单信息
    mapping(address => uint256[]) public userOrders;   // 用户 => 订单ID列表
    uint256[] public activeOrderIds;                   // 活跃订单ID列表
    mapping(uint256 => uint256) public orderIndex;     // 订单ID => 在活跃列表中的索引

    // 事件定义
    event OrderCreated(
        uint256 indexed orderId,
        address indexed user,
        OrderType orderType,
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
    
    event PriceDeviationBlocked(
        uint256 orderId,
        uint256 orderPrice,
        uint256 referencePrice,
        uint256 deviation
    );

    event FeeRatesUpdated(
        uint256 oldLimitOrderFee,
        uint256 oldFillOrderFee,
        uint256 newLimitOrderFee,
        uint256 newFillOrderFee
    );

    event FeeCollectorUpdated(address oldCollector, address newCollector);
    event PriceDeviationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _usdtToken USDT合约地址
     * @param _ammPool AMM流动性池地址（用于获取市场价格）
     * @param _priceOracle 价格预言机地址
     * @param _feeCollector 手续费收集者地址
     */
    constructor(
        address _carbonToken,
        address _usdtToken,
        address _ammPool,
        address _priceOracle,
        address _feeCollector
    ) {
        require(_carbonToken != address(0), "Invalid carbon token");
        require(_usdtToken != address(0), "Invalid USDT token");
        require(_ammPool != address(0), "Invalid AMM pool");
        require(_priceOracle != address(0), "Invalid price oracle");
        require(_feeCollector != address(0), "Invalid fee collector");
        
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IERC20(_usdtToken);
        ammPool = GreenTalesLiquidityPool(_ammPool);
        priceOracle = ICarbonPriceOracle(_priceOracle);
        feeCollector = _feeCollector;
        
        // 初始化统计信息
        marketStats.nextOrderId = 1;
    }

    /**
     * @dev 创建买单（支持自动撮合）
     * @param _amount 要购买的碳币数量（18位精度）
     * @param _price 出价（USDT基础单位，例如：88表示88 USDT）
     */
    function createBuyOrder(uint256 _amount, uint256 _price) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");
        
        // 价格偏离检查
        _checkPriceDeviation(_price);
        
        // 计算所需的USDT总量
        uint256 totalUSDT = _amount * _price;
        uint256 orderFee = (totalUSDT * limitOrderFeeRate) / BASIS_POINTS;
        uint256 totalRequired = totalUSDT + orderFee;
        
        // 检查用户USDT余额和授权
        require(usdtToken.balanceOf(msg.sender) >= totalRequired, "Insufficient USDT balance");
        require(usdtToken.allowance(msg.sender, address(this)) >= totalRequired, "Insufficient USDT allowance");
        
        // 转移USDT到合约（包括手续费）
        usdtToken.safeTransferFrom(msg.sender, address(this), totalUSDT);
        usdtToken.safeTransferFrom(msg.sender, feeCollector, orderFee);
        
        // 【核心功能】：自动撮合现有卖单
        (uint256 remainingAmount, uint256 usdtSpent) = _tryMatchSellOrders(_amount, _price, msg.sender);
        
        // 返还多余的USDT（如果撮合成交的价格低于买单价格）
        uint256 expectedUsdtCost = (_amount - remainingAmount) * _price;
        if (expectedUsdtCost > usdtSpent) {
            uint256 refund = expectedUsdtCost - usdtSpent;
            usdtToken.safeTransfer(msg.sender, refund);
        }
        
        // 如果还有剩余数量，创建买单
        if (remainingAmount > 0) {
            uint256 orderId = marketStats.nextOrderId;
            orders[orderId] = Order({
                user: msg.sender,
                orderType: OrderType.Buy,
                amount: _amount,
                remainingAmount: remainingAmount,
                price: _price,
                timestamp: block.timestamp,
                status: OrderStatus.Active,
                orderFee: orderFee
            });
            
            // 更新索引
            userOrders[msg.sender].push(orderId);
            activeOrderIds.push(orderId);
            orderIndex[orderId] = activeOrderIds.length - 1;
            
            emit OrderCreated(orderId, msg.sender, OrderType.Buy, _amount, _price, orderFee, block.timestamp);
        }
        
        // 更新统计
        marketStats.nextOrderId++;
        marketStats.totalOrdersCreated++;
        marketStats.totalFeesCollected += orderFee;
        marketStats.totalLimitOrderFees += orderFee;
        
        // 更新用户手续费记录
        userTotalFeePaid[msg.sender] += orderFee;
        userLimitOrderFeePaid[msg.sender] += orderFee;
        
        // 更新每日手续费统计
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += orderFee;
    }

    /**
     * @dev 创建卖单（支持自动撮合）
     * @param _amount 要出售的碳币数量（18位精度）
     * @param _price 出价（USDT基础单位，例如：88表示88 USDT）
     */
    function createSellOrder(uint256 _amount, uint256 _price) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");
        
        // 价格偏离检查
        _checkPriceDeviation(_price);
        
        // 检查用户碳币余额和授权
        require(carbonToken.balanceOf(msg.sender) >= _amount, "Insufficient carbon token balance");
        require(carbonToken.allowance(msg.sender, address(this)) >= _amount, "Insufficient carbon token allowance");
        
        // 计算挂单手续费（基于预期收入）
        uint256 expectedUSDT = _amount * _price;
        uint256 orderFee = (expectedUSDT * limitOrderFeeRate) / BASIS_POINTS;
        
        // 检查用户USDT余额和授权用于支付手续费
        require(usdtToken.balanceOf(msg.sender) >= orderFee, "Insufficient USDT for order fee");
        require(usdtToken.allowance(msg.sender, address(this)) >= orderFee, "Insufficient USDT allowance for order fee");
        
        // 转移碳币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), _amount);
        // 收取挂单手续费
        usdtToken.safeTransferFrom(msg.sender, feeCollector, orderFee);
        
        // 【核心功能】：自动撮合现有买单
        uint256 remainingAmount = _tryMatchBuyOrders(_amount, _price, msg.sender);
        
        // 如果还有剩余数量，创建卖单
        if (remainingAmount > 0) {
            uint256 orderId = marketStats.nextOrderId;
            orders[orderId] = Order({
                user: msg.sender,
                orderType: OrderType.Sell,
                amount: _amount,
                remainingAmount: remainingAmount,
                price: _price,
                timestamp: block.timestamp,
                status: OrderStatus.Active,
                orderFee: orderFee
            });
            
            // 更新索引
            userOrders[msg.sender].push(orderId);
            activeOrderIds.push(orderId);
            orderIndex[orderId] = activeOrderIds.length - 1;
            
            emit OrderCreated(orderId, msg.sender, OrderType.Sell, _amount, _price, orderFee, block.timestamp);
        }
        
        // 更新统计
        marketStats.nextOrderId++;
        marketStats.totalOrdersCreated++;
        marketStats.totalFeesCollected += orderFee;
        marketStats.totalLimitOrderFees += orderFee;
        
        // 更新用户手续费记录
        userTotalFeePaid[msg.sender] += orderFee;
        userLimitOrderFeePaid[msg.sender] += orderFee;
        
        // 更新每日手续费统计
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += orderFee;
    }

    /**
     * @dev 成交订单
     * @param _orderId 要成交的订单ID
     */
    function fillOrder(uint256 _orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user != msg.sender, "Cannot fill your own order");
        
        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;
        
        // 计算成交手续费
        uint256 takerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        
        if (order.orderType == OrderType.Buy) {
            // 成交买单：taker卖出碳币，获得USDT
            require(carbonToken.balanceOf(msg.sender) >= amount, "Insufficient carbon tokens");
            require(carbonToken.allowance(msg.sender, address(this)) >= amount, "Insufficient carbon token allowance");
            require(usdtToken.balanceOf(msg.sender) >= takerFee, "Insufficient USDT for taker fee");
            require(usdtToken.allowance(msg.sender, address(this)) >= takerFee, "Insufficient USDT allowance for taker fee");
            
            // 转移资产
            carbonToken.safeTransferFrom(msg.sender, order.user, amount);  // 碳币给买家
            usdtToken.safeTransfer(msg.sender, totalUSDT);                 // USDT给卖家
            usdtToken.safeTransferFrom(msg.sender, feeCollector, takerFee); // 成交手续费
            
        } else {
            // 成交卖单：taker买入碳币，支付USDT
            uint256 totalRequired = totalUSDT + takerFee;
            require(usdtToken.balanceOf(msg.sender) >= totalRequired, "Insufficient USDT");
            require(usdtToken.allowance(msg.sender, address(this)) >= totalRequired, "Insufficient USDT allowance");
            
            // 转移资产
            usdtToken.safeTransferFrom(msg.sender, order.user, totalUSDT);  // USDT给卖家
            usdtToken.safeTransferFrom(msg.sender, feeCollector, takerFee); // 成交手续费
            carbonToken.safeTransfer(msg.sender, amount);                   // 碳币给买家
        }
        
        // 更新订单状态
        order.status = OrderStatus.Filled;
        _removeFromActiveOrders(_orderId);
        
        // 更新统计
        marketStats.totalOrdersFilled++;
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += takerFee;
        marketStats.totalFillOrderFees += takerFee;
        
        // 更新taker手续费记录
        userTotalFeePaid[msg.sender] += takerFee;
        userFillOrderFeePaid[msg.sender] += takerFee;
        
        // 更新每日手续费统计
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += takerFee;
        
        emit OrderFilled(
            _orderId,
            order.user,
            msg.sender,
            amount,
            price,
            order.orderFee,
            takerFee,
            block.timestamp
        );
    }

    /**
     * @dev 取消订单（支持部分成交后取消）
     * @param _orderId 要取消的订单ID
     */
    function cancelOrder(uint256 _orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user == msg.sender, "Not order owner");
        
        // 返还锁定的剩余资产
        if (order.orderType == OrderType.Buy) {
            // 返还剩余的USDT（基于剩余数量计算）
            uint256 remainingUSDT = order.remainingAmount * order.price;
            usdtToken.safeTransfer(msg.sender, remainingUSDT);
        } else {
            // 返还剩余的碳币
            carbonToken.safeTransfer(msg.sender, order.remainingAmount);
        }
        
        // 更新订单状态
        order.status = OrderStatus.Cancelled;
        _removeFromActiveOrders(_orderId);
        
        // 更新统计
        marketStats.totalOrdersCancelled++;
        
        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    /**
     * @dev 价格偏离检查 - 支持炒作机制
     * @param _price 订单价格（基础单位）
     * @notice 只检查下限（防止价格过低），上限不限制（允许炒作）
     */
    function _checkPriceDeviation(uint256 _price) internal {
        // 优先使用Chainlink预言机价格作为参考
        uint256 oraclePrice = priceOracle.getLatestCarbonPriceUSD(); // 8位精度，USD/碳币
        
        // 如果预言机价格不可用，使用AMM池价格作为备选
        uint256 referencePrice;
        if (oraclePrice > 0) {
            // 将预言机价格从8位精度转换为18位精度
            referencePrice = oraclePrice * 1e10; // 8位 -> 18位
        } else {
            // 备选：使用AMM池当前价格（18位精度）
            referencePrice = ammPool.getCarbonPrice();
            if (referencePrice == 0) return; // 如果都不可用，跳过检查
        }
        
        // 将订单价格转换为18位精度进行比较
        uint256 orderPriceWei = _price * 1e18;
        
        // 【炒作机制】：只检查下限，不检查上限
        // 计算价格是否过低（低于参考价的一定百分比）
        if (orderPriceWei < referencePrice) {
            uint256 downwardDeviation = ((referencePrice - orderPriceWei) * BASIS_POINTS) / referencePrice;
            
            // 检查是否低于下限阈值
            if (downwardDeviation > priceDeviationThreshold) {
                emit PriceDeviationBlocked(0, orderPriceWei, referencePrice, downwardDeviation);
                revert("Price too low - below minimum threshold");
            }
        }
        
        // 【重要】：价格高于参考价时，无限制！允许炒作到任意高价
        // 这里不做任何检查，允许用户炒作价格
    }

    /**
     * @dev 尝试撮合现有卖单（买单创建时调用）
     * @param _amount 买单数量
     * @param _price 买单价格
     * @param _buyer 买家地址
     * @return remainingAmount 剩余未成交数量
     * @return usdtSpent 已花费的USDT数量（用于返还多余部分）
     */
    function _tryMatchSellOrders(uint256 _amount, uint256 _price, address _buyer) internal returns (uint256 remainingAmount, uint256 usdtSpent) {
        remainingAmount = _amount;
        usdtSpent = 0;
        
        // 遍历活跃订单，寻找可成交的卖单
        for (uint256 i = 0; i < activeOrderIds.length && remainingAmount > 0; ) {
            uint256 orderId = activeOrderIds[i];
            Order storage sellOrder = orders[orderId];
            
            // 检查是否为可成交的卖单
            if (sellOrder.orderType == OrderType.Sell && 
                sellOrder.status == OrderStatus.Active && 
                sellOrder.price <= _price &&
                sellOrder.user != _buyer) {
                
                // 计算本次成交数量
                uint256 tradeAmount = remainingAmount <= sellOrder.remainingAmount ? 
                    remainingAmount : sellOrder.remainingAmount;
                
                // 执行买家撮合卖单的成交
                uint256 tradeCost = _executeBuyerMatchSell(orderId, _buyer, tradeAmount);
                usdtSpent += tradeCost;
                
                // 更新剩余数量
                remainingAmount -= tradeAmount;
                
                // 如果卖单完全成交，继续下一个；否则当前订单还有剩余
                if (sellOrder.remainingAmount == 0) {
                    // 不增加i，因为数组会被压缩
                    continue;
                }
            }
            
            i++;
        }
        
        return (remainingAmount, usdtSpent);
    }

    /**
     * @dev 尝试撮合现有买单（卖单创建时调用）
     * @param _amount 卖单数量
     * @param _price 卖单价格
     * @param _seller 卖家地址
     * @return remainingAmount 剩余未成交数量
     */
    function _tryMatchBuyOrders(uint256 _amount, uint256 _price, address _seller) internal returns (uint256 remainingAmount) {
        remainingAmount = _amount;
        
        // 遍历活跃订单，寻找可成交的买单
        for (uint256 i = 0; i < activeOrderIds.length && remainingAmount > 0; ) {
            uint256 orderId = activeOrderIds[i];
            Order storage buyOrder = orders[orderId];
            
            // 检查是否为可成交的买单
            if (buyOrder.orderType == OrderType.Buy && 
                buyOrder.status == OrderStatus.Active && 
                buyOrder.price >= _price &&
                buyOrder.user != _seller) {
                
                // 计算本次成交数量
                uint256 tradeAmount = remainingAmount <= buyOrder.remainingAmount ? 
                    remainingAmount : buyOrder.remainingAmount;
                
                // 执行卖家撮合买单的成交
                _executeSellerMatchBuy(orderId, _seller, tradeAmount);
                
                // 更新剩余数量
                remainingAmount -= tradeAmount;
                
                // 如果买单完全成交，继续下一个；否则当前订单还有剩余
                if (buyOrder.remainingAmount == 0) {
                    // 不增加i，因为数组会被压缩
                    continue;
                }
            }
            
            i++;
        }
        
        return remainingAmount;
    }

    /**
     * @dev 执行买家撮合卖单的成交（买单创建时自动撮合）
     * @param _orderId 被成交的卖单ID
     * @param _buyer 买家地址
     * @param _tradeAmount 成交数量
     * @return tradeCost 本次交易花费的USDT
     */
    function _executeBuyerMatchSell(uint256 _orderId, address _buyer, uint256 _tradeAmount) internal returns (uint256 tradeCost) {
        Order storage sellOrder = orders[_orderId];
        uint256 totalUSDT = _tradeAmount * sellOrder.price;
        
        // 计算买家的成交手续费
        uint256 buyerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        tradeCost = totalUSDT + buyerFee;
        
        // 检查买家是否有足够的USDT支付手续费（交易本身的USDT已在createBuyOrder中收取）
        require(usdtToken.balanceOf(_buyer) >= buyerFee, "Insufficient USDT for buyer fee");
        require(usdtToken.allowance(_buyer, address(this)) >= buyerFee, "Insufficient USDT allowance for buyer fee");
        
        // 转移资产
        usdtToken.safeTransfer(sellOrder.user, totalUSDT);                    // 从合约给卖家USDT
        usdtToken.safeTransferFrom(_buyer, feeCollector, buyerFee);           // 买家支付成交手续费
        carbonToken.safeTransfer(_buyer, _tradeAmount);                       // 从合约给买家碳币
        
        // 更新卖单剩余数量
        sellOrder.remainingAmount -= _tradeAmount;
        
        // 更新统计
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += buyerFee;
        marketStats.totalFillOrderFees += buyerFee;
        
        // 更新买家手续费记录
        userTotalFeePaid[_buyer] += buyerFee;
        userFillOrderFeePaid[_buyer] += buyerFee;
        
        // 更新每日手续费统计
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += buyerFee;
        
        // 检查卖单是否完全成交
        if (sellOrder.remainingAmount == 0) {
            sellOrder.status = OrderStatus.Filled;
            _removeFromActiveOrders(_orderId);
            marketStats.totalOrdersFilled++;
            
            emit OrderFilled(
                _orderId,
                sellOrder.user,
                _buyer,
                sellOrder.amount,
                sellOrder.price,
                sellOrder.orderFee,
                buyerFee,
                block.timestamp
            );
        } else {
            // 部分成交事件
            emit PartialOrderFilled(
                _orderId,
                sellOrder.user,
                _buyer,
                _tradeAmount,
                sellOrder.remainingAmount,
                sellOrder.price,
                sellOrder.orderFee,
                buyerFee,
                block.timestamp
            );
        }
        
        return tradeCost;
    }

    /**
     * @dev 执行卖家撮合买单的成交（卖单创建时自动撮合）
     * @param _orderId 被成交的买单ID
     * @param _seller 卖家地址
     * @param _tradeAmount 成交数量
     */
    function _executeSellerMatchBuy(uint256 _orderId, address _seller, uint256 _tradeAmount) internal {
        Order storage buyOrder = orders[_orderId];
        uint256 totalUSDT = _tradeAmount * buyOrder.price;
        
        // 计算卖家的成交手续费
        uint256 sellerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        
        // 检查卖家是否有足够的USDT支付手续费
        require(usdtToken.balanceOf(_seller) >= sellerFee, "Insufficient USDT for seller fee");
        require(usdtToken.allowance(_seller, address(this)) >= sellerFee, "Insufficient USDT allowance for seller fee");
        
        // 转移资产
        usdtToken.safeTransfer(_seller, totalUSDT);                           // 从合约给卖家USDT
        usdtToken.safeTransferFrom(_seller, feeCollector, sellerFee);         // 卖家支付成交手续费
        carbonToken.safeTransfer(buyOrder.user, _tradeAmount);                // 从合约给买家碳币
        
        // 更新买单剩余数量
        buyOrder.remainingAmount -= _tradeAmount;
        
        // 更新统计
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += sellerFee;
        marketStats.totalFillOrderFees += sellerFee;
        
        // 更新卖家手续费记录
        userTotalFeePaid[_seller] += sellerFee;
        userFillOrderFeePaid[_seller] += sellerFee;
        
        // 更新每日手续费统计
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += sellerFee;
        
        // 检查买单是否完全成交
        if (buyOrder.remainingAmount == 0) {
            buyOrder.status = OrderStatus.Filled;
            _removeFromActiveOrders(_orderId);
            marketStats.totalOrdersFilled++;
            
            emit OrderFilled(
                _orderId,
                buyOrder.user,
                _seller,
                buyOrder.amount,
                buyOrder.price,
                buyOrder.orderFee,
                sellerFee,
                block.timestamp
            );
        } else {
            // 部分成交事件
            emit PartialOrderFilled(
                _orderId,
                buyOrder.user,
                _seller,
                _tradeAmount,
                buyOrder.remainingAmount,
                buyOrder.price,
                buyOrder.orderFee,
                sellerFee,
                block.timestamp
            );
        }
    }

    /**
     * @dev 从活跃订单列表中移除订单
     * @param _orderId 订单ID
     */
    function _removeFromActiveOrders(uint256 _orderId) internal {
        uint256 index = orderIndex[_orderId];
        uint256 lastIndex = activeOrderIds.length - 1;
        
        if (index != lastIndex) {
            uint256 lastOrderId = activeOrderIds[lastIndex];
            activeOrderIds[index] = lastOrderId;
            orderIndex[lastOrderId] = index;
        }
        
        activeOrderIds.pop();
        delete orderIndex[_orderId];
    }

    // ========== 管理员函数 ==========

    /**
     * @dev 更新手续费率
     * @param _limitOrderFeeRate 新的挂单手续费率
     * @param _fillOrderFeeRate 新的成交手续费率
     */
    function updateFeeRates(uint256 _limitOrderFeeRate, uint256 _fillOrderFeeRate) external onlyOwner {
        require(_limitOrderFeeRate <= MAX_FEE_RATE, "Limit order fee too high");
        require(_fillOrderFeeRate <= MAX_FEE_RATE, "Fill order fee too high");
        
        uint256 oldLimitOrderFee = limitOrderFeeRate;
        uint256 oldFillOrderFee = fillOrderFeeRate;
        
        limitOrderFeeRate = _limitOrderFeeRate;
        fillOrderFeeRate = _fillOrderFeeRate;
        
        emit FeeRatesUpdated(oldLimitOrderFee, oldFillOrderFee, _limitOrderFeeRate, _fillOrderFeeRate);
    }

    /**
     * @dev 更新手续费收集者
     * @param _newCollector 新的手续费收集者地址
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        address oldCollector = feeCollector;
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(oldCollector, _newCollector);
    }

    /**
     * @dev 更新价格偏离阈值
     * @param _newThreshold 新的价格偏离阈值（基点）
     * @notice 没有最大限制，你可以设置任意的下限阈值
     */
    function updatePriceDeviationThreshold(uint256 _newThreshold) external onlyOwner {
        uint256 oldThreshold = priceDeviationThreshold;
        priceDeviationThreshold = _newThreshold;
        emit PriceDeviationThresholdUpdated(oldThreshold, _newThreshold);
    }

    /**
     * @dev 紧急暂停/恢复合约
     * @param _paused 是否暂停
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // ========== 查询函数 ==========

    /**
     * @dev 获取订单信息
     * @param _orderId 订单ID
     * @return 订单详细信息
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    /**
     * @dev 获取用户订单列表
     * @param _user 用户地址
     * @return 用户的订单ID数组
     */
    function getUserOrders(address _user) external view returns (uint256[] memory) {
        return userOrders[_user];
    }

    /**
     * @dev 获取活跃订单列表
     * @return 活跃订单ID数组
     */
    function getActiveOrders() external view returns (uint256[] memory) {
        return activeOrderIds;
    }

    /**
     * @dev 分页获取活跃订单
     * @param _offset 起始位置
     * @param _limit 数量限制
     * @return orderIds 订单ID数组
     * @return orderInfos 订单信息数组
     */
    function getActiveOrdersPaginated(uint256 _offset, uint256 _limit) 
        external 
        view 
        returns (uint256[] memory orderIds, Order[] memory orderInfos) 
    {
        uint256 totalActive = activeOrderIds.length;
        uint256 end = _offset + _limit;
        if (end > totalActive) {
            end = totalActive;
        }
        
        uint256 length = end > _offset ? end - _offset : 0;
        orderIds = new uint256[](length);
        orderInfos = new Order[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 orderId = activeOrderIds[_offset + i];
            orderIds[i] = orderId;
            orderInfos[i] = orders[orderId];
        }
    }

    /**
     * @dev 获取市场统计信息
     * @return totalOrdersCreated 总创建订单数
     * @return totalOrdersFilled 总完成订单数
     * @return totalOrdersCancelled 总取消订单数
     * @return totalVolumeTraded 总交易量
     * @return totalFeesCollected 总手续费收入
     * @return totalLimitOrderFees 总挂单手续费
     * @return totalFillOrderFees 总成交手续费
     * @return nextOrderId 下一个订单ID
     */
    function getMarketStats() external view returns (
        uint256 totalOrdersCreated,
        uint256 totalOrdersFilled,
        uint256 totalOrdersCancelled,
        uint256 totalVolumeTraded,
        uint256 totalFeesCollected,
        uint256 totalLimitOrderFees,
        uint256 totalFillOrderFees,
        uint256 nextOrderId
    ) {
        return (
            marketStats.totalOrdersCreated,
            marketStats.totalOrdersFilled,
            marketStats.totalOrdersCancelled,
            marketStats.totalVolumeTraded,
            marketStats.totalFeesCollected,
            marketStats.totalLimitOrderFees,
            marketStats.totalFillOrderFees,
            marketStats.nextOrderId
        );
    }

    /**
     * @dev 获取手续费率信息
     * @return platformFee 平台手续费（这里返回0，因为只有限价单手续费）
     * @return limitOrderFee 限价单挂单手续费率
     * @return fillOrderFee 限价单成交手续费率
     */
    function getFeeRates() external view returns (
        uint256 platformFee,
        uint256 limitOrderFee,
        uint256 fillOrderFee
    ) {
        return (0, limitOrderFeeRate, fillOrderFeeRate);
    }

    /**
     * @dev 获取订单簿信息（原始数据，不排序）
     * @return buyOrders 买单数组（未排序，前端可根据需要排序）
     * @return sellOrders 卖单数组（未排序，前端可根据需要排序）
     * @notice 为节省gas费用，此函数不进行排序。前端可根据price字段自行排序：
     *         - 买单通常按价格从高到低排序 (price DESC)
     *         - 卖单通常按价格从低到高排序 (price ASC)
     */
    function getOrderBook() external view returns (
        Order[] memory buyOrders,
        Order[] memory sellOrders
    ) {
        uint256 totalActive = activeOrderIds.length;
        uint256 buyCount = 0;
        uint256 sellCount = 0;
        
        // 统计买单和卖单数量
        for (uint256 i = 0; i < totalActive; i++) {
            uint256 orderId = activeOrderIds[i];
            if (orders[orderId].orderType == OrderType.Buy) {
                buyCount++;
            } else {
                sellCount++;
            }
        }
        
        // 创建数组
        buyOrders = new Order[](buyCount);
        sellOrders = new Order[](sellCount);
        
        uint256 buyIndex = 0;
        uint256 sellIndex = 0;
        
        // 填充数组（不排序，由前端处理）
        for (uint256 i = 0; i < totalActive; i++) {
            uint256 orderId = activeOrderIds[i];
            Order memory order = orders[orderId];
            
            if (order.orderType == OrderType.Buy) {
                buyOrders[buyIndex] = order;
                buyIndex++;
            } else {
                sellOrders[sellIndex] = order;
                sellIndex++;
            }
        }
        
        // 🚀 排序逻辑已移除 - 前端负责排序，大幅节省gas费用
    }

    /**
     * @dev 获取订单簿信息（分页版本，更节省gas）
     * @param _offset 起始位置
     * @param _limit 数量限制
     * @param _orderType 订单类型过滤（0=买单，1=卖单，2=全部）
     * @return orderList 订单数组（未排序）
     * @return hasMore 是否还有更多数据
     * @notice 推荐使用此函数替代getOrderBook()，特别是订单量大时
     */
    function getOrderBookPaginated(
        uint256 _offset, 
        uint256 _limit, 
        uint8 _orderType  // 0=Buy, 1=Sell, 2=All
    ) external view returns (
        Order[] memory orderList,
        bool hasMore
    ) {
        require(_limit > 0 && _limit <= 100, "Invalid limit: 1-100");
        
        uint256 totalActive = activeOrderIds.length;
        uint256 matchedCount = 0;
        uint256 currentIndex = 0;
        
        // 第一遍：计算匹配的订单数量并找到起始位置
        for (uint256 i = 0; i < totalActive; i++) {
            uint256 orderId = activeOrderIds[i];
            Order memory order = orders[orderId];
            
            bool matches = (_orderType == 2) || 
                          (_orderType == 0 && order.orderType == OrderType.Buy) ||
                          (_orderType == 1 && order.orderType == OrderType.Sell);
            
            if (matches) {
                if (currentIndex >= _offset) {
                    matchedCount++;
                    if (matchedCount >= _limit) break;
                }
                currentIndex++;
            }
        }
        
        // 创建结果数组
        orderList = new Order[](matchedCount);
        uint256 resultIndex = 0;
        currentIndex = 0;
        
        // 第二遍：填充结果
        for (uint256 i = 0; i < totalActive && resultIndex < matchedCount; i++) {
            uint256 orderId = activeOrderIds[i];
            Order memory order = orders[orderId];
            
            bool matches = (_orderType == 2) || 
                          (_orderType == 0 && order.orderType == OrderType.Buy) ||
                          (_orderType == 1 && order.orderType == OrderType.Sell);
            
            if (matches) {
                if (currentIndex >= _offset) {
                    orderList[resultIndex] = order;
                    resultIndex++;
                }
                currentIndex++;
            }
        }
        
        // 检查是否还有更多数据
        hasMore = (currentIndex > _offset + matchedCount);
    }

    /**
     * @dev 获取用户手续费统计
     * @param _user 用户地址
     * @return totalFee 用户支付的总手续费
     * @return limitOrderFee 用户支付的挂单手续费
     * @return fillOrderFee 用户支付的成交手续费
     */
    function getUserFeeStats(address _user) external view returns (
        uint256 totalFee,
        uint256 limitOrderFee,
        uint256 fillOrderFee
    ) {
        return (
            userTotalFeePaid[_user],
            userLimitOrderFeePaid[_user],
            userFillOrderFeePaid[_user]
        );
    }

    /**
     * @dev 获取每日手续费统计
     * @param _day 日期（时间戳/86400）
     * @return dayFees 当日手续费总额
     */
    function getDailyFeeStats(uint256 _day) external view returns (uint256 dayFees) {
        return dailyFeesCollected[_day];
    }

    /**
     * @dev 获取当前日期的每日手续费
     * @return todayFees 今日手续费总额
     * @return today 今日日期标识
     */
    function getTodayFeeStats() external view returns (uint256 todayFees, uint256 today) {
        today = block.timestamp / 86400;
        todayFees = dailyFeesCollected[today];
        return (todayFees, today);
    }

    /**
     * @dev 获取详细市场统计（包含手续费分类）
     * @return totalOrdersCreated 总创建订单数
     * @return totalOrdersFilled 总完成订单数
     * @return totalOrdersCancelled 总取消订单数
     * @return totalVolumeTraded 总交易量
     * @return totalFeesCollected 总手续费收入
     * @return totalLimitOrderFees 总挂单手续费
     * @return totalFillOrderFees 总成交手续费
     * @return nextOrderId 下一个订单ID
     */
    function getDetailedMarketStats() external view returns (
        uint256 totalOrdersCreated,
        uint256 totalOrdersFilled,
        uint256 totalOrdersCancelled,
        uint256 totalVolumeTraded,
        uint256 totalFeesCollected,
        uint256 totalLimitOrderFees,
        uint256 totalFillOrderFees,
        uint256 nextOrderId
    ) {
        return (
            marketStats.totalOrdersCreated,
            marketStats.totalOrdersFilled,
            marketStats.totalOrdersCancelled,
            marketStats.totalVolumeTraded,
            marketStats.totalFeesCollected,
            marketStats.totalLimitOrderFees,
            marketStats.totalFillOrderFees,
            marketStats.nextOrderId
        );
    }

    /**
     * @dev 检查价格是否会被偏离保护阻止（炒作友好版本）
     * @param _price 要检查的价格
     * @return isBlocked 是否会被阻止
     * @return deviation 偏离百分比（只计算下行偏离）
     * @return referencePrice 参考价格
     */
    function checkPriceDeviation(uint256 _price) external view returns (
        bool isBlocked,
        uint256 deviation,
        uint256 referencePrice
    ) {
        // 优先使用Chainlink预言机价格作为参考
        uint256 oraclePrice = priceOracle.getLatestCarbonPriceUSD(); // 8位精度，USD/碳币
        
        if (oraclePrice > 0) {
            // 将预言机价格从8位精度转换为18位精度
            referencePrice = oraclePrice * 1e10; // 8位 -> 18位
        } else {
            // 备选：使用AMM池当前价格（18位精度）
            referencePrice = ammPool.getCarbonPrice();
            if (referencePrice == 0) {
                return (false, 0, 0);
            }
        }
        
        uint256 orderPriceWei = _price * 1e18;
        
        // 【炒作机制】：只检查下行偏离，上行无限制
        if (orderPriceWei < referencePrice) {
            // 计算下行偏离百分比
            deviation = ((referencePrice - orderPriceWei) * BASIS_POINTS) / referencePrice;
            isBlocked = deviation > priceDeviationThreshold;
        } else {
            // 价格高于或等于参考价：允许，不阻止
            deviation = 0; // 上行偏离不计算/显示
            isBlocked = false;
        }
    }

    // ========== 修饰器 ==========

    /**
     * @dev 未暂停修饰器
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
} 