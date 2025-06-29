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
 * @dev Carbon token and USDT limit order trading market contract
 * @notice Handles limit order book functionality, for market orders use GreenTalesLiquidityPool directly
 * 
 * Main features:
 * 1. Limit order creation: Users can create buy and sell orders
 * 2. Order execution: Users can fill other users' orders
 * 3. Order cancellation: Users can cancel their own orders
 * 4. Price protection: Oracle integration for price deviation checks
 * 5. Fee collection: Order placement and execution fees
 */
contract CarbonUSDTMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for CarbonToken;
    using SafeERC20 for IERC20;

    // Constants
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_FEE_RATE = 1000; // 10%
    uint256 private constant PRICE_PRECISION = 1e18;

    // Contract state variables
    CarbonToken public immutable carbonToken;
    IERC20 public immutable usdtToken;
    GreenTalesLiquidityPool public immutable ammPool;
    ICarbonPriceOracle public immutable priceOracle;
    
    // Fee configuration
    uint256 public limitOrderFeeRate = 50;  // Limit order placement fee rate (basis points) 0.5%
    uint256 public fillOrderFeeRate = 30;   // Limit order execution fee rate (basis points) 0.3%
    address public feeCollector;

    // Price deviation threshold configuration (speculation-friendly mechanism)
    uint256 public priceDeviationThreshold = 3000; // 30% lower threshold (no limit on upper bound)
    
    // Emergency pause state
    bool public paused;

    // Statistics
    struct MarketStats {
        uint256 totalOrdersCreated;
        uint256 totalOrdersFilled;
        uint256 totalOrdersCancelled;
        uint256 totalVolumeTraded;
        uint256 totalFeesCollected;      // Total fees (backward compatibility)
        uint256 totalLimitOrderFees;     // Total placement fees
        uint256 totalFillOrderFees;      // Total execution fees
        uint256 nextOrderId;
    }
    MarketStats public marketStats;

    // Fee record mappings
    mapping(address => uint256) public userTotalFeePaid;        // User total fees paid
    mapping(address => uint256) public userLimitOrderFeePaid;   // User placement fees
    mapping(address => uint256) public userFillOrderFeePaid;    // User execution fees
    
    // Daily fee statistics (optional: daily tracking)
    mapping(uint256 => uint256) public dailyFeesCollected;     // Date => daily fee total

    // Order type enums
    enum OrderType { Buy, Sell }
    enum OrderStatus { Active, Filled, Cancelled }

    // Order struct
    struct Order {
        address user;           // Order creator
        OrderType orderType;    // Order type: buy/sell
        uint256 amount;         // Carbon token amount (original total)
        uint256 remainingAmount; // Remaining unfilled amount
        uint256 price;          // Price (USDT, base unit)
        uint256 timestamp;      // Creation time
        OrderStatus status;     // Order status
        uint256 orderFee;       // Placement fee
    }

    // Mappings
    mapping(uint256 => Order) public orders;           // Order ID => Order info
    mapping(address => uint256[]) public userOrders;   // User => Order ID list
    uint256[] public activeOrderIds;                   // Active order ID list
    mapping(uint256 => uint256) public orderIndex;     // Order ID => Index in active list

    // Events
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
     * @dev Constructor
     * @param _carbonToken Carbon token contract address
     * @param _usdtToken USDT contract address
     * @param _ammPool AMM liquidity pool address (for market price)
     * @param _priceOracle Price oracle address
     * @param _feeCollector Fee collector address
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
        
        // Initialize statistics
        marketStats.nextOrderId = 1;
    }

    /**
     * @dev Create buy order (with auto-matching)
     * @param _amount Carbon token amount to buy (18 decimals)
     * @param _price Bid price (USDT base unit, e.g., 88 means 88 USDT)
     */
    function createBuyOrder(uint256 _amount, uint256 _price) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");
        
        // Price deviation check
        _checkPriceDeviation(_price);
        
        // Calculate required USDT total
        uint256 totalUSDT = _amount * _price;
        uint256 orderFee = (totalUSDT * limitOrderFeeRate) / BASIS_POINTS;
        uint256 totalRequired = totalUSDT + orderFee;
        
        // Check user USDT balance and allowance
        require(usdtToken.balanceOf(msg.sender) >= totalRequired, "Insufficient USDT balance");
        require(usdtToken.allowance(msg.sender, address(this)) >= totalRequired, "Insufficient USDT allowance");
        
        // Transfer USDT to contract (including fees)
        usdtToken.safeTransferFrom(msg.sender, address(this), totalUSDT);
        usdtToken.safeTransferFrom(msg.sender, feeCollector, orderFee);
        
        // Core functionality: Auto-match existing sell orders
        (uint256 remainingAmount, uint256 usdtSpent) = _tryMatchSellOrders(_amount, _price, msg.sender);
        
        // Refund excess USDT (if matching price is lower than buy order price)
        uint256 expectedUsdtCost = (_amount - remainingAmount) * _price;
        if (expectedUsdtCost > usdtSpent) {
            uint256 refund = expectedUsdtCost - usdtSpent;
            usdtToken.safeTransfer(msg.sender, refund);
        }
        
        // If there's remaining amount, create buy order
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
            
            // Update indices
            userOrders[msg.sender].push(orderId);
            activeOrderIds.push(orderId);
            orderIndex[orderId] = activeOrderIds.length - 1;
            
            emit OrderCreated(orderId, msg.sender, OrderType.Buy, _amount, _price, orderFee, block.timestamp);
        }
        
        // Update statistics
        marketStats.nextOrderId++;
        marketStats.totalOrdersCreated++;
        marketStats.totalFeesCollected += orderFee;
        marketStats.totalLimitOrderFees += orderFee;
        
        // Update user fee records
        userTotalFeePaid[msg.sender] += orderFee;
        userLimitOrderFeePaid[msg.sender] += orderFee;
        
        // Update daily fee statistics
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += orderFee;
    }

    /**
     * @dev Create sell order (with auto-matching)
     * @param _amount Carbon token amount to sell (18 decimals)
     * @param _price Ask price (USDT base unit, e.g., 88 means 88 USDT)
     */
    function createSellOrder(uint256 _amount, uint256 _price) external whenNotPaused nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_price > 0, "Price must be greater than 0");
        
        // Price deviation check
        _checkPriceDeviation(_price);
        
        // Check user carbon token balance and allowance
        require(carbonToken.balanceOf(msg.sender) >= _amount, "Insufficient carbon token balance");
        require(carbonToken.allowance(msg.sender, address(this)) >= _amount, "Insufficient carbon token allowance");
        
        // Calculate placement fee (based on expected income)
        uint256 expectedUSDT = _amount * _price;
        uint256 orderFee = (expectedUSDT * limitOrderFeeRate) / BASIS_POINTS;
        
        // Check user USDT balance and allowance for fee payment
        require(usdtToken.balanceOf(msg.sender) >= orderFee, "Insufficient USDT for order fee");
        require(usdtToken.allowance(msg.sender, address(this)) >= orderFee, "Insufficient USDT allowance for order fee");
        
        // Transfer carbon tokens to contract
        carbonToken.safeTransferFrom(msg.sender, address(this), _amount);
        // Collect placement fee
        usdtToken.safeTransferFrom(msg.sender, feeCollector, orderFee);
        
        // Core functionality: Auto-match existing buy orders
        uint256 remainingAmount = _tryMatchBuyOrders(_amount, _price, msg.sender);
        
        // If there's remaining amount, create sell order
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
            
            // Update indices
            userOrders[msg.sender].push(orderId);
            activeOrderIds.push(orderId);
            orderIndex[orderId] = activeOrderIds.length - 1;
            
            emit OrderCreated(orderId, msg.sender, OrderType.Sell, _amount, _price, orderFee, block.timestamp);
        }
        
        // Update statistics
        marketStats.nextOrderId++;
        marketStats.totalOrdersCreated++;
        marketStats.totalFeesCollected += orderFee;
        marketStats.totalLimitOrderFees += orderFee;
        
        // Update user fee records
        userTotalFeePaid[msg.sender] += orderFee;
        userLimitOrderFeePaid[msg.sender] += orderFee;
        
        // Update daily fee statistics
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += orderFee;
    }

    /**
     * @dev Fill order
     * @param _orderId Order ID to fill
     */
    function fillOrder(uint256 _orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user != msg.sender, "Cannot fill your own order");
        
        uint256 amount = order.amount;
        uint256 price = order.price;
        uint256 totalUSDT = amount * price;
        
        // Calculate execution fee
        uint256 takerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        
        if (order.orderType == OrderType.Buy) {
            // Fill buy order: taker sells carbon tokens, receives USDT
            require(carbonToken.balanceOf(msg.sender) >= amount, "Insufficient carbon tokens");
            require(carbonToken.allowance(msg.sender, address(this)) >= amount, "Insufficient carbon token allowance");
            require(usdtToken.balanceOf(msg.sender) >= takerFee, "Insufficient USDT for taker fee");
            require(usdtToken.allowance(msg.sender, address(this)) >= takerFee, "Insufficient USDT allowance for taker fee");
            
            // Transfer assets
            carbonToken.safeTransferFrom(msg.sender, order.user, amount);  // Carbon tokens to buyer
            usdtToken.safeTransfer(msg.sender, totalUSDT);                 // USDT to seller
            usdtToken.safeTransferFrom(msg.sender, feeCollector, takerFee); // Execution fee
            
        } else {
            // Fill sell order: taker buys carbon tokens, pays USDT
            uint256 totalRequired = totalUSDT + takerFee;
            require(usdtToken.balanceOf(msg.sender) >= totalRequired, "Insufficient USDT");
            require(usdtToken.allowance(msg.sender, address(this)) >= totalRequired, "Insufficient USDT allowance");
            
            // Transfer assets
            usdtToken.safeTransferFrom(msg.sender, order.user, totalUSDT);  // USDT to seller
            usdtToken.safeTransferFrom(msg.sender, feeCollector, takerFee); // Execution fee
            carbonToken.safeTransfer(msg.sender, amount);                   // Carbon tokens to buyer
        }
        
        // Update order status
        order.status = OrderStatus.Filled;
        _removeFromActiveOrders(_orderId);
        
        // Update statistics
        marketStats.totalOrdersFilled++;
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += takerFee;
        marketStats.totalFillOrderFees += takerFee;
        
        // Update taker fee records
        userTotalFeePaid[msg.sender] += takerFee;
        userFillOrderFeePaid[msg.sender] += takerFee;
        
        // Update daily fee statistics
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
     * @dev Cancel order (supports partial fill cancellation)
     * @param _orderId Order ID to cancel
     */
    function cancelOrder(uint256 _orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[_orderId];
        require(order.status == OrderStatus.Active, "Order not active");
        require(order.user == msg.sender, "Not order owner");
        
        // Return locked remaining assets
        if (order.orderType == OrderType.Buy) {
            // Return remaining USDT (calculated based on remaining amount)
            uint256 remainingUSDT = order.remainingAmount * order.price;
            usdtToken.safeTransfer(msg.sender, remainingUSDT);
        } else {
            // Return remaining carbon tokens
            carbonToken.safeTransfer(msg.sender, order.remainingAmount);
        }
        
        // Update order status
        order.status = OrderStatus.Cancelled;
        _removeFromActiveOrders(_orderId);
        
        // Update statistics
        marketStats.totalOrdersCancelled++;
        
        emit OrderCancelled(_orderId, msg.sender, block.timestamp);
    }

    /**
     * @dev Price deviation check - speculation-friendly mechanism
     * @param _price Order price (base unit)
     * @notice Only checks lower bound (prevents too low prices), no upper limit (allows speculation)
     */
    function _checkPriceDeviation(uint256 _price) internal {
        // Prioritize Chainlink oracle price as reference
        uint256 oraclePrice = priceOracle.getLatestCarbonPriceUSD(); // 8 decimals, USD/carbon
        
        // If oracle price unavailable, use AMM pool price as fallback
        uint256 referencePrice;
        if (oraclePrice > 0) {
            // Convert oracle price from 8 decimals to 18 decimals
            referencePrice = oraclePrice * 1e10; // 8 -> 18
        } else {
            // Fallback: use AMM pool current price (18 decimals)
            referencePrice = ammPool.getCarbonPrice();
            if (referencePrice == 0) return; // If both unavailable, skip check
        }
        
        // Convert order price to 18 decimals for comparison
        uint256 orderPriceWei = _price * 1e18;
        
        // Speculation mechanism: only check lower bound, no upper limit
        // Calculate if price is too low (below reference price by certain percentage)
        if (orderPriceWei < referencePrice) {
            uint256 downwardDeviation = ((referencePrice - orderPriceWei) * BASIS_POINTS) / referencePrice;
            
            // Check if below lower threshold
            if (downwardDeviation > priceDeviationThreshold) {
                emit PriceDeviationBlocked(0, orderPriceWei, referencePrice, downwardDeviation);
                revert("Price too low - below minimum threshold");
            }
        }
        
        // Important: No limit when price is above reference price! Allow speculation to any high price
        // No check here, allowing users to speculate on price
    }

    /**
     * @dev Try to match existing sell orders (called when creating buy order)
     * @param _amount Buy order amount
     * @param _price Buy order price
     * @param _buyer Buyer address
     * @return remainingAmount Remaining unfilled amount
     * @return usdtSpent USDT spent (for refunding excess)
     */
    function _tryMatchSellOrders(uint256 _amount, uint256 _price, address _buyer) internal returns (uint256 remainingAmount, uint256 usdtSpent) {
        remainingAmount = _amount;
        usdtSpent = 0;
        
        // Iterate through active orders, find fillable sell orders
        for (uint256 i = 0; i < activeOrderIds.length && remainingAmount > 0; ) {
            uint256 orderId = activeOrderIds[i];
            Order storage sellOrder = orders[orderId];
            
            // Check if it's a fillable sell order
            if (sellOrder.orderType == OrderType.Sell && 
                sellOrder.status == OrderStatus.Active && 
                sellOrder.price <= _price &&
                sellOrder.user != _buyer) {
                
                // Calculate this trade amount
                uint256 tradeAmount = remainingAmount <= sellOrder.remainingAmount ? 
                    remainingAmount : sellOrder.remainingAmount;
                
                // Execute buyer matching sell order
                uint256 tradeCost = _executeBuyerMatchSell(orderId, _buyer, tradeAmount);
                usdtSpent += tradeCost;
                
                // Update remaining amount
                remainingAmount -= tradeAmount;
                
                // If sell order fully filled, continue to next; otherwise current order still has remaining
                if (sellOrder.remainingAmount == 0) {
                    // Don't increment i, as array will be compressed
                    continue;
                }
            }
            
            i++;
        }
        
        return (remainingAmount, usdtSpent);
    }

    /**
     * @dev Try to match existing buy orders (called when creating sell order)
     * @param _amount Sell order amount
     * @param _price Sell order price
     * @param _seller Seller address
     * @return remainingAmount Remaining unfilled amount
     */
    function _tryMatchBuyOrders(uint256 _amount, uint256 _price, address _seller) internal returns (uint256 remainingAmount) {
        remainingAmount = _amount;
        
        // Iterate through active orders, find fillable buy orders
        for (uint256 i = 0; i < activeOrderIds.length && remainingAmount > 0; ) {
            uint256 orderId = activeOrderIds[i];
            Order storage buyOrder = orders[orderId];
            
            // Check if it's a fillable buy order
            if (buyOrder.orderType == OrderType.Buy && 
                buyOrder.status == OrderStatus.Active && 
                buyOrder.price >= _price &&
                buyOrder.user != _seller) {
                
                // Calculate this trade amount
                uint256 tradeAmount = remainingAmount <= buyOrder.remainingAmount ? 
                    remainingAmount : buyOrder.remainingAmount;
                
                // Execute seller matching buy order
                _executeSellerMatchBuy(orderId, _seller, tradeAmount);
                
                // Update remaining amount
                remainingAmount -= tradeAmount;
                
                // If buy order fully filled, continue to next; otherwise current order still has remaining
                if (buyOrder.remainingAmount == 0) {
                    // Don't increment i, as array will be compressed
                    continue;
                }
            }
            
            i++;
        }
        
        return remainingAmount;
    }

    /**
     * @dev Execute buyer matching sell order (auto-matching when creating buy order)
     * @param _orderId Sell order ID being filled
     * @param _buyer Buyer address
     * @param _tradeAmount Trade amount
     * @return tradeCost USDT cost for this trade
     */
    function _executeBuyerMatchSell(uint256 _orderId, address _buyer, uint256 _tradeAmount) internal returns (uint256 tradeCost) {
        Order storage sellOrder = orders[_orderId];
        uint256 totalUSDT = _tradeAmount * sellOrder.price;
        
        // Calculate buyer execution fee
        uint256 buyerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        tradeCost = totalUSDT + buyerFee;
        
        // Check if buyer has enough USDT for fee (trade USDT already collected in createBuyOrder)
        require(usdtToken.balanceOf(_buyer) >= buyerFee, "Insufficient USDT for buyer fee");
        require(usdtToken.allowance(_buyer, address(this)) >= buyerFee, "Insufficient USDT allowance for buyer fee");
        
        // Transfer assets
        usdtToken.safeTransfer(sellOrder.user, totalUSDT);                    // USDT from contract to seller
        usdtToken.safeTransferFrom(_buyer, feeCollector, buyerFee);           // Buyer pays execution fee
        carbonToken.safeTransfer(_buyer, _tradeAmount);                       // Carbon tokens from contract to buyer
        
        // Update sell order remaining amount
        sellOrder.remainingAmount -= _tradeAmount;
        
        // Update statistics
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += buyerFee;
        marketStats.totalFillOrderFees += buyerFee;
        
        // Update buyer fee records
        userTotalFeePaid[_buyer] += buyerFee;
        userFillOrderFeePaid[_buyer] += buyerFee;
        
        // Update daily fee statistics
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += buyerFee;
        
        // Check if sell order fully filled
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
            // Partial fill event
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
     * @dev Execute seller matching buy order (auto-matching when creating sell order)
     * @param _orderId Buy order ID being filled
     * @param _seller Seller address
     * @param _tradeAmount Trade amount
     */
    function _executeSellerMatchBuy(uint256 _orderId, address _seller, uint256 _tradeAmount) internal {
        Order storage buyOrder = orders[_orderId];
        uint256 totalUSDT = _tradeAmount * buyOrder.price;
        
        // Calculate seller execution fee
        uint256 sellerFee = (totalUSDT * fillOrderFeeRate) / BASIS_POINTS;
        
        // Check if seller has enough USDT for fee
        require(usdtToken.balanceOf(_seller) >= sellerFee, "Insufficient USDT for seller fee");
        require(usdtToken.allowance(_seller, address(this)) >= sellerFee, "Insufficient USDT allowance for seller fee");
        
        // Transfer assets
        usdtToken.safeTransfer(_seller, totalUSDT);                           // USDT from contract to seller
        usdtToken.safeTransferFrom(_seller, feeCollector, sellerFee);         // Seller pays execution fee
        carbonToken.safeTransfer(buyOrder.user, _tradeAmount);                // Carbon tokens from contract to buyer
        
        // Update buy order remaining amount
        buyOrder.remainingAmount -= _tradeAmount;
        
        // Update statistics
        marketStats.totalVolumeTraded += totalUSDT;
        marketStats.totalFeesCollected += sellerFee;
        marketStats.totalFillOrderFees += sellerFee;
        
        // Update seller fee records
        userTotalFeePaid[_seller] += sellerFee;
        userFillOrderFeePaid[_seller] += sellerFee;
        
        // Update daily fee statistics
        uint256 today = block.timestamp / 86400;
        dailyFeesCollected[today] += sellerFee;
        
        // Check if buy order fully filled
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
            // Partial fill event
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
     * @dev Remove order from active order list
     * @param _orderId Order ID
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

    // ========== Admin functions ==========

    /**
     * @dev Update fee rates
     * @param _limitOrderFeeRate New placement fee rate
     * @param _fillOrderFeeRate New execution fee rate
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
     * @dev Update fee collector
     * @param _newCollector New fee collector address
     */
    function updateFeeCollector(address _newCollector) external onlyOwner {
        require(_newCollector != address(0), "Invalid fee collector");
        address oldCollector = feeCollector;
        feeCollector = _newCollector;
        emit FeeCollectorUpdated(oldCollector, _newCollector);
    }

    /**
     * @dev Update price deviation threshold
     * @param _newThreshold New price deviation threshold (basis points)
     * @notice No maximum limit, you can set any lower threshold
     */
    function updatePriceDeviationThreshold(uint256 _newThreshold) external onlyOwner {
        uint256 oldThreshold = priceDeviationThreshold;
        priceDeviationThreshold = _newThreshold;
        emit PriceDeviationThresholdUpdated(oldThreshold, _newThreshold);
    }

    /**
     * @dev Emergency pause/resume contract
     * @param _paused Whether to pause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // ========== Query functions ==========

    /**
     * @dev Get order information
     * @param _orderId Order ID
     * @return Order detailed information
     */
    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    /**
     * @dev Get user order list
     * @param _user User address
     * @return User's order ID array
     */
    function getUserOrders(address _user) external view returns (uint256[] memory) {
        return userOrders[_user];
    }

    /**
     * @dev Get active order list
     * @return Active order ID array
     */
    function getActiveOrders() external view returns (uint256[] memory) {
        return activeOrderIds;
    }

    /**
     * @dev Get paginated active orders
     * @param _offset Starting position
     * @param _limit Quantity limit
     * @return orderIds Order ID array
     * @return orderInfos Order information array
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
     * @dev Get market statistics
     * @return totalOrdersCreated Total orders created
     * @return totalOrdersFilled Total orders completed
     * @return totalOrdersCancelled Total orders cancelled
     * @return totalVolumeTraded Total trading volume
     * @return totalFeesCollected Total fee income
     * @return totalLimitOrderFees Total placement fees
     * @return totalFillOrderFees Total execution fees
     * @return nextOrderId Next order ID
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
     * @dev Get fee rate information
     * @return platformFee Platform fee (returns 0 here, as only limit order fees)
     * @return limitOrderFee Limit order placement fee rate
     * @return fillOrderFee Limit order execution fee rate
     */
    function getFeeRates() external view returns (
        uint256 platformFee,
        uint256 limitOrderFee,
        uint256 fillOrderFee
    ) {
        return (0, limitOrderFeeRate, fillOrderFeeRate);
    }

    /**
     * @dev Get order book information (raw data, not sorted)
     * @return buyOrders Buy order array (not sorted, frontend can sort as needed)
     * @return sellOrders Sell order array (not sorted, frontend can sort as needed)
     * @notice To save gas, this function doesn't sort. Frontend can sort by price field:
     *         - Buy orders usually sorted by price high to low (price DESC)
     *         - Sell orders usually sorted by price low to high (price ASC)
     */
    function getOrderBook() external view returns (
        Order[] memory buyOrders,
        Order[] memory sellOrders
    ) {
        uint256 totalActive = activeOrderIds.length;
        uint256 buyCount = 0;
        uint256 sellCount = 0;
        
        // Count buy and sell orders
        for (uint256 i = 0; i < totalActive; i++) {
            uint256 orderId = activeOrderIds[i];
            if (orders[orderId].orderType == OrderType.Buy) {
                buyCount++;
            } else {
                sellCount++;
            }
        }
        
        // Create arrays
        buyOrders = new Order[](buyCount);
        sellOrders = new Order[](sellCount);
        
        uint256 buyIndex = 0;
        uint256 sellIndex = 0;
        
        // Fill arrays (not sorted, handled by frontend)
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
        
        // Sorting logic removed - frontend responsible for sorting, significantly saves gas
    }

    /**
     * @dev Get order book information (paginated version, more gas efficient)
     * @param _offset Starting position
     * @param _limit Quantity limit
     * @param _orderType Order type filter (0=Buy, 1=Sell, 2=All)
     * @return orderList Order array (not sorted)
     * @return hasMore Whether there's more data
     * @notice Recommended to use this function instead of getOrderBook(), especially when order volume is large
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
        
        // First pass: count matching orders and find starting position
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
        
        // Create result array
        orderList = new Order[](matchedCount);
        uint256 resultIndex = 0;
        currentIndex = 0;
        
        // Second pass: fill results
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
        
        // Check if there's more data
        hasMore = (currentIndex > _offset + matchedCount);
    }

    /**
     * @dev Get user fee statistics
     * @param _user User address
     * @return totalFee User's total fees paid
     * @return limitOrderFee User's placement fees paid
     * @return fillOrderFee User's execution fees paid
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
     * @dev Get daily fee statistics
     * @param _day Date (timestamp/86400)
     * @return dayFees Daily fee total
     */
    function getDailyFeeStats(uint256 _day) external view returns (uint256 dayFees) {
        return dailyFeesCollected[_day];
    }

    /**
     * @dev Get current date's daily fees
     * @return todayFees Today's fee total
     * @return today Today's date identifier
     */
    function getTodayFeeStats() external view returns (uint256 todayFees, uint256 today) {
        today = block.timestamp / 86400;
        todayFees = dailyFeesCollected[today];
        return (todayFees, today);
    }

    /**
     * @dev Get detailed market statistics (including fee categories)
     * @return totalOrdersCreated Total orders created
     * @return totalOrdersFilled Total orders completed
     * @return totalOrdersCancelled Total orders cancelled
     * @return totalVolumeTraded Total trading volume
     * @return totalFeesCollected Total fee income
     * @return totalLimitOrderFees Total placement fees
     * @return totalFillOrderFees Total execution fees
     * @return nextOrderId Next order ID
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
     * @dev Check if price would be blocked by deviation protection (speculation-friendly version)
     * @param _price Price to check
     * @return isBlocked Whether it would be blocked
     * @return deviation Deviation percentage (only calculates downward deviation)
     * @return referencePrice Reference price
     */
    function checkPriceDeviation(uint256 _price) external view returns (
        bool isBlocked,
        uint256 deviation,
        uint256 referencePrice
    ) {
        // Prioritize Chainlink oracle price as reference
        uint256 oraclePrice = priceOracle.getLatestCarbonPriceUSD(); // 8 decimals, USD/carbon
        
        if (oraclePrice > 0) {
            // Convert oracle price from 8 decimals to 18 decimals
            referencePrice = oraclePrice * 1e10; // 8 -> 18
        } else {
            // Fallback: use AMM pool current price (18 decimals)
            referencePrice = ammPool.getCarbonPrice();
            if (referencePrice == 0) {
                return (false, 0, 0);
            }
        }
        
        uint256 orderPriceWei = _price * 1e18;
        
        // Speculation mechanism: only check downward deviation, no upper limit
        if (orderPriceWei < referencePrice) {
            // Calculate downward deviation percentage
            deviation = ((referencePrice - orderPriceWei) * BASIS_POINTS) / referencePrice;
            isBlocked = deviation > priceDeviationThreshold;
        } else {
            // Price above or equal to reference price: allowed, not blocked
            deviation = 0; // Upward deviation not calculated/displayed
            isBlocked = false;
        }
    }

    // ========== Modifiers ==========

    /**
     * @dev Not paused modifier
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
} 