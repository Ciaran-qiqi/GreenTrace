// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./interfaces/AggregatorV3Interface.sol";
import "./CarbonToken.sol";
import "./interfaces/IUSDT.sol";

/**
 * @title GreenTalesLiquidityPool
 * @dev NFT流动性池合约，支持USDT和碳币的兑换
 * @notice 用于提供NFT的USDT流动性，实现碳币和USDT的双向兑换
 * 
 * 主要功能：
 * 1. 提供流动性：用户可以存入USDT和碳币
 * 2. 移除流动性：用户可以取出USDT和碳币
 * 3. 价格兑换：支持USDT和碳币的双向兑换
 * 4. 价格预言：使用Chainlink获取实时价格
 * 5. 手续费：收取交易手续费
 */
contract GreenTalesLiquidityPool is Ownable {
    using SafeERC20 for IUSDT;
    using SafeERC20 for CarbonToken;

    // 合约状态变量
    CarbonToken public carbonToken;        // 碳币合约
    IUSDT public usdtToken;              // USDT合约
    AggregatorV3Interface public priceFeed; // Chainlink价格预言机
    
    uint256 public constant FEE_RATE = 30;  // 0.3%的手续费
    uint256 public constant BASE_RATE = 10000; // 100%
    
    // 流动性池状态
    uint256 public totalCarbonTokens;     // 池中碳币总量
    uint256 public totalUsdtTokens;       // 池中USDT总量
    uint256 public totalLPTokens;         // LP代币总量
    
    // 用户流动性信息
    mapping(address => uint256) public userLPTokens;  // 用户LP代币数量
    
    // 事件定义
    event LiquidityAdded(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event LiquidityRemoved(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event TokensSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event PriceUpdated(uint256 carbonPrice, uint256 timestamp);

    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _usdtToken USDT合约地址
     * @param _priceFeed Chainlink价格预言机地址
     */
    constructor(
        address _carbonToken,
        address _usdtToken,
        address _priceFeed
    ) {
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IUSDT(_usdtToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    /**
     * @dev 获取USDT的实时价格（以USD计价）
     * @return 价格（以USD计价，8位小数）
     */
    function getUsdtPrice() public view returns (uint256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }

    /**
     * @dev 获取碳币的实时价格（以USDT计价）
     * @return 价格（以USDT计价，18位小数）
     */
    function getCarbonPrice() public view returns (uint256) {
        if (totalCarbonTokens == 0 || totalUsdtTokens == 0) {
            return 0;
        }
        return (totalUsdtTokens * 1e18) / totalCarbonTokens;
    }

    /**
     * @dev 添加流动性
     * @param carbonAmount 碳币数量
     * @param usdtAmount USDT数量
     * @return lpTokens 获得的LP代币数量
     */
    function addLiquidity(uint256 carbonAmount, uint256 usdtAmount) external returns (uint256 lpTokens) {
        require(carbonAmount > 0 && usdtAmount > 0, "Amounts must be greater than 0");
        
        // 转移代币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        
        // 计算LP代币数量
        if (totalLPTokens == 0) {
            lpTokens = sqrt(carbonAmount * usdtAmount);
        } else {
            uint256 carbonShare = (carbonAmount * totalLPTokens) / totalCarbonTokens;
            uint256 usdtShare = (usdtAmount * totalLPTokens) / totalUsdtTokens;
            lpTokens = carbonShare < usdtShare ? carbonShare : usdtShare;
        }
        
        // 更新状态
        totalCarbonTokens += carbonAmount;
        totalUsdtTokens += usdtAmount;
        totalLPTokens += lpTokens;
        userLPTokens[msg.sender] += lpTokens;
        
        emit LiquidityAdded(msg.sender, carbonAmount, usdtAmount, lpTokens);
        return lpTokens;
    }

    /**
     * @dev 移除流动性
     * @param lpTokens LP代币数量
     * @return carbonAmount 返还的碳币数量
     * @return usdtAmount 返还的USDT数量
     */
    function removeLiquidity(uint256 lpTokens) external returns (uint256 carbonAmount, uint256 usdtAmount) {
        require(lpTokens > 0, "Amount must be greater than 0");
        require(userLPTokens[msg.sender] >= lpTokens, "Insufficient LP tokens");
        
        // 计算返还数量
        carbonAmount = (lpTokens * totalCarbonTokens) / totalLPTokens;
        usdtAmount = (lpTokens * totalUsdtTokens) / totalLPTokens;
        
        // 更新状态
        totalCarbonTokens -= carbonAmount;
        totalUsdtTokens -= usdtAmount;
        totalLPTokens -= lpTokens;
        userLPTokens[msg.sender] -= lpTokens;
        
        // 转移代币
        carbonToken.safeTransfer(msg.sender, carbonAmount);
        usdtToken.safeTransfer(msg.sender, usdtAmount);
        
        emit LiquidityRemoved(msg.sender, carbonAmount, usdtAmount, lpTokens);
        return (carbonAmount, usdtAmount);
    }

    /**
     * @dev 碳币兑换USDT
     * @param carbonAmount 碳币数量
     * @return usdtAmount 获得的USDT数量
     */
    function swapCarbonToUsdt(uint256 carbonAmount) external returns (uint256 usdtAmount) {
        require(carbonAmount > 0, "Amount must be greater than 0");
        
        // 计算兑换数量（考虑手续费）
        usdtAmount = (carbonAmount * totalUsdtTokens) / totalCarbonTokens;
        uint256 fee = (usdtAmount * FEE_RATE) / BASE_RATE;
        usdtAmount -= fee;
        
        // 转移代币
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransfer(msg.sender, usdtAmount);
        
        // 更新状态
        totalCarbonTokens += carbonAmount;
        totalUsdtTokens -= usdtAmount;
        
        emit TokensSwapped(msg.sender, address(carbonToken), address(usdtToken), carbonAmount, usdtAmount);
        return usdtAmount;
    }

    /**
     * @dev USDT兑换碳币
     * @param usdtAmount USDT数量
     * @return carbonAmount 获得的碳币数量
     */
    function swapUsdtToCarbon(uint256 usdtAmount) external returns (uint256 carbonAmount) {
        require(usdtAmount > 0, "Amount must be greater than 0");
        
        // 计算兑换数量（考虑手续费）
        carbonAmount = (usdtAmount * totalCarbonTokens) / totalUsdtTokens;
        uint256 fee = (carbonAmount * FEE_RATE) / BASE_RATE;
        carbonAmount -= fee;
        
        // 转移代币
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        carbonToken.safeTransfer(msg.sender, carbonAmount);
        
        // 更新状态
        totalUsdtTokens += usdtAmount;
        totalCarbonTokens -= carbonAmount;
        
        emit TokensSwapped(msg.sender, address(usdtToken), address(carbonToken), usdtAmount, carbonAmount);
        return carbonAmount;
    }

    /**
     * @dev 计算平方根
     * @param x 输入数字
     * @return 平方根
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
} 