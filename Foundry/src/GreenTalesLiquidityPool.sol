// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./CarbonToken.sol";
import "./interfaces/ICarbonPriceOracle.sol";

/**
 * @title GreenTalesLiquidityPool
 * @dev 碳币流动性池合约，支持USDT和碳币的兑换
 * @notice 用于提供碳币的USDT流动性，实现碳币和USDT的双向兑换
 * 
 * 主要功能：
 * 1. 提供流动性：用户可以存入USDT和碳币
 * 2. 移除流动性：用户可以取出USDT和碳币
 * 3. 价格兑换：支持USDT和碳币的双向兑换
 * 4. 价格预言：使用碳价预言机获取实时价格
 * 5. 手续费：收取交易手续费并自动分配
 * 6. 手续费分成：平台70%，流动性提供者30%
 */
contract GreenTalesLiquidityPool is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for CarbonToken;

    // 合约状态变量
    CarbonToken public carbonToken;        // 碳币合约
    IERC20 public usdtToken;              // USDT合约（使用标准ERC20接口）
    ICarbonPriceOracle public carbonPriceOracle; // 碳价预言机
    
    // 手续费配置 - 改为可修改
    uint256 public feeRate = 30;  // 0.3%的手续费
    uint256 public constant BASE_RATE = 10000; // 100%
    uint256 public platformFeeShare = 7000;  // 70%平台手续费
    uint256 public lpFeeShare = 3000;        // 30%流动性提供者手续费
    uint256 public priceDeviationThreshold; // 价格偏离阈值（百分比）
    
    // 流动性池状态
    uint256 public totalCarbonTokens;     // 池中碳币总量
    uint256 public totalUsdtTokens;       // 池中USDT总量
    uint256 public totalLPTokens;         // LP代币总量
    
    // 用户流动性信息
    mapping(address => uint256) public userLPTokens;  // 用户LP代币数量
    
    // 手续费分配相关
    uint256 public platformFeesCarbon;    // 平台累积的碳币手续费
    uint256 public platformFeesUsdt;      // 平台累积的USDT手续费
    uint256 public totalLpFeesCarbon;     // 流动性提供者累积的碳币手续费
    uint256 public totalLpFeesUsdt;       // 流动性提供者累积的USDT手续费
    
    // 用户手续费收益记录
    mapping(address => uint256) public userClaimedCarbonFees;  // 用户已提取的碳币手续费
    mapping(address => uint256) public userClaimedUsdtFees;    // 用户已提取的USDT手续费
    mapping(address => uint256) public userLastLpTokens;       // 用户上次计算手续费时的LP代币数量
    
    // 事件定义
    event LiquidityAdded(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event LiquidityRemoved(address indexed user, uint256 carbonAmount, uint256 usdtAmount, uint256 lpTokens);
    event TokensSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event PriceUpdated(uint256 carbonPrice, uint256 timestamp);
    event PriceDeviationThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event CarbonPriceOracleUpdated(address oldOracle, address newOracle);
    event PriceDeviationChecked(uint256 referencePrice, uint256 marketPrice, uint256 deviation, bool isDeviated);
    event SwapBlockedByPriceDeviation(uint256 referencePrice, uint256 marketPrice, uint256 deviation);
    event FeesWithdrawn(address indexed user, address indexed token, uint256 amount);
    event PlatformFeesWithdrawn(address indexed token, uint256 amount);
    event UserFeesClaimed(address indexed user, address indexed token, uint256 amount);
    event EmergencyPaused(address indexed by, bool paused);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    event PoolStatsUpdated(uint256 totalCarbon, uint256 totalUsdt, uint256 totalLP, uint256 currentPrice);
    event FeeRateUpdated(uint256 oldFeeRate, uint256 newFeeRate);
    event FeeSharesUpdated(uint256 oldPlatformShare, uint256 oldLpShare, uint256 newPlatformShare, uint256 newLpShare);

    // 紧急暂停状态
    bool public paused;

    // 统计信息
    uint256 public totalSwaps;
    uint256 public totalVolumeTraded;
    uint256 public totalFeesCollected;
    uint256 public totalLiquidityProviders;

    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _usdtToken USDT合约地址
     */
    constructor(
        address _carbonToken,
        address _usdtToken
    ) {
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IERC20(_usdtToken);  // 使用标准ERC20接口
        priceDeviationThreshold = 10; // 默认10%的偏离阈值
    }

    /**
     * @dev 设置碳价预言机
     * @param _carbonPriceOracle 碳价预言机地址
     */
    function setCarbonPriceOracle(address _carbonPriceOracle) external onlyOwner {
        address oldOracle = address(carbonPriceOracle);
        carbonPriceOracle = ICarbonPriceOracle(_carbonPriceOracle);
        emit CarbonPriceOracleUpdated(oldOracle, _carbonPriceOracle);
    }

    /**
     * @dev 设置价格偏离阈值
     * @param _threshold 阈值（百分比，例如：10表示10%）
     */
    function setPriceDeviationThreshold(uint256 _threshold) external onlyOwner {
        uint256 oldThreshold = priceDeviationThreshold;
        priceDeviationThreshold = _threshold;
        emit PriceDeviationThresholdUpdated(oldThreshold, _threshold);
    }

    /**
     * @dev 设置手续费率
     * @param _feeRate 手续费率（基点，例如：30表示0.3%）
     */
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate too high"); // 最高10%
        uint256 oldFeeRate = feeRate;
        feeRate = _feeRate;
        emit FeeRateUpdated(oldFeeRate, _feeRate);
    }

    /**
     * @dev 设置手续费分配比例
     * @param _platformShare 平台手续费比例（基点，例如：7000表示70%）
     * @param _lpShare 流动性提供者手续费比例（基点，例如：3000表示30%）
     */
    function setFeeShares(uint256 _platformShare, uint256 _lpShare) external onlyOwner {
        require(_platformShare + _lpShare == 10000, "Total share must be 100%");
        require(_platformShare > 0 && _lpShare > 0, "Shares must be greater than 0");
        
        uint256 oldPlatformShare = platformFeeShare;
        uint256 oldLpShare = lpFeeShare;
        
        platformFeeShare = _platformShare;
        lpFeeShare = _lpShare;
        
        emit FeeSharesUpdated(oldPlatformShare, oldLpShare, _platformShare, _lpShare);
    }

    /**
     * @dev 获取预言机碳价参考价（美元计价，18位精度）
     * @return 预言机参考价（18位精度，USD/碳币 可视为USDT/碳币）
     */
    function getOracleReferencePrice() public view returns (uint256) {
        if (address(carbonPriceOracle) == address(0)) {
            return 0;
        }
        
        uint256 oraclePrice8 = carbonPriceOracle.getLatestCarbonPriceUSD(); // 8位精度，USD/碳币
        if (oraclePrice8 == 0) {
            return 0;
        }
        
        // 将预言机价格从8位精度转换为18位精度
        return oraclePrice8 * 1e10; // 8位 -> 18位
    }

    /**
     * @dev 检查价格是否偏离过大
     * @param marketPrice 市场价格（18位精度，USDT/碳币）
     * @return bool 是否偏离过大
     */
    function isPriceDeviated(uint256 marketPrice) public view returns (bool) {
        uint256 referencePrice = getOracleReferencePrice();
        if (referencePrice == 0) return false;
        
        // 计算价格偏离百分比
        uint256 deviation;
        if (marketPrice > referencePrice) {
            deviation = ((marketPrice - referencePrice) * 100) / referencePrice;
        } else {
            deviation = ((referencePrice - marketPrice) * 100) / referencePrice;
        }
            
        return deviation > priceDeviationThreshold;
    }

    /**
     * @dev 获取价格偏离详细信息
     * @return referencePrice 预言机参考价（18位精度）
     * @return marketPrice 市场价格（18位精度）
     * @return deviation 偏离百分比
     * @return threshold 偏离阈值
     * @return isDeviated 是否偏离过大
     */
    function getPriceDeviationDetails() public view returns (
        uint256 referencePrice,
        uint256 marketPrice,
        uint256 deviation,
        uint256 threshold,
        bool isDeviated
    ) {
        referencePrice = getOracleReferencePrice();
        marketPrice = getCarbonPrice();
        threshold = priceDeviationThreshold;
        
        if (referencePrice == 0) {
            return (0, marketPrice, 0, threshold, false);
        }
        
        if (marketPrice > referencePrice) {
            deviation = ((marketPrice - referencePrice) * 100) / referencePrice;
        } else {
            deviation = ((referencePrice - marketPrice) * 100) / referencePrice;
        }
        
        isDeviated = deviation > threshold;
        
        return (referencePrice, marketPrice, deviation, threshold, isDeviated);
    }

    /**
     * @dev 获取碳币的实时价格（以USDT计价）
     * @return 价格（以USDT计价，18位小数）
     * @notice 基于AMM公式计算：USDT总量 / 碳币总量
     */
    function getCarbonPrice() public view returns (uint256) {
        if (totalCarbonTokens == 0 || totalUsdtTokens == 0) {
            return 0;
        }
        return (totalUsdtTokens * 1e18) / totalCarbonTokens;
    }

    /**
     * @dev 获取碳币的USD价格（通过预言机直接获取）
     * @return 价格（以USD计价，18位小数）
     * @notice 直接使用碳价预言机的USD价格，无需USDT转换
     */
    function getCarbonPriceUSD() public view returns (uint256) {
        return getOracleReferencePrice();
    }

    /**
     * @dev 计算用户可提取的手续费收益
     * @param _user 用户地址
     * @return carbonFees 可提取的碳币手续费
     * @return usdtFees 可提取的USDT手续费
     */
    function calculateUserFees(address _user) public view returns (uint256 carbonFees, uint256 usdtFees) {
        uint256 userLP = userLPTokens[_user];
        if (userLP == 0 || totalLPTokens == 0) {
            return (0, 0);
        }
        
        // 计算用户应得的碳币手续费
        uint256 userCarbonFees = (userLP * totalLpFeesCarbon) / totalLPTokens;
        carbonFees = userCarbonFees > userClaimedCarbonFees[_user] ? 
                    userCarbonFees - userClaimedCarbonFees[_user] : 0;
        
        // 计算用户应得的USDT手续费
        uint256 userUsdtFees = (userLP * totalLpFeesUsdt) / totalLPTokens;
        usdtFees = userUsdtFees > userClaimedUsdtFees[_user] ? 
                  userUsdtFees - userClaimedUsdtFees[_user] : 0;
        
        return (carbonFees, usdtFees);
    }

    /**
     * @dev 用户提取累积的手续费收益
     * @return carbonFees 提取的碳币手续费
     * @return usdtFees 提取的USDT手续费
     */
    function claimFees() external returns (uint256 carbonFees, uint256 usdtFees) {
        (carbonFees, usdtFees) = calculateUserFees(msg.sender);
        
        require(carbonFees > 0 || usdtFees > 0, "No fees to claim");
        
        // 更新已提取记录
        if (carbonFees > 0) {
            userClaimedCarbonFees[msg.sender] += carbonFees;
            carbonToken.safeTransfer(msg.sender, carbonFees);
        }
        
        if (usdtFees > 0) {
            userClaimedUsdtFees[msg.sender] += usdtFees;
            usdtToken.safeTransfer(msg.sender, usdtFees);
        }
        
        emit UserFeesClaimed(msg.sender, address(carbonToken), carbonFees);
        emit UserFeesClaimed(msg.sender, address(usdtToken), usdtFees);
        
        return (carbonFees, usdtFees);
    }

    /**
     * @dev 添加流动性
     * @param carbonAmount 碳币数量
     * @param usdtAmount USDT数量
     * @return lpTokens 获得的LP代币数量
     */
    function addLiquidity(uint256 carbonAmount, uint256 usdtAmount) external whenNotPaused returns (uint256 lpTokens) {
        require(carbonAmount > 0 && usdtAmount > 0, "Amounts must be greater than 0");
        
        // 转移代币到合约
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        
        // 计算LP代币数量
        if (totalLPTokens == 0) {
            lpTokens = sqrt(carbonAmount * usdtAmount);
            totalLiquidityProviders++;
        } else {
            uint256 carbonShare = (carbonAmount * totalLPTokens) / totalCarbonTokens;
            uint256 usdtShare = (usdtAmount * totalLPTokens) / totalUsdtTokens;
            lpTokens = carbonShare < usdtShare ? carbonShare : usdtShare;
            
            // 如果是新用户，增加提供者计数
            if (userLPTokens[msg.sender] == 0) {
                totalLiquidityProviders++;
            }
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
    function removeLiquidity(uint256 lpTokens) external whenNotPaused returns (uint256 carbonAmount, uint256 usdtAmount) {
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
        
        // 如果用户移除所有LP代币，减少提供者计数
        if (userLPTokens[msg.sender] == 0) {
            totalLiquidityProviders--;
        }
        
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
    function swapCarbonToUsdt(uint256 carbonAmount) external whenNotPaused returns (uint256 usdtAmount) {
        require(carbonAmount > 0, "Amount must be greater than 0");
        
        // 检查价格偏离 - 使用当前池子价格进行检查
        uint256 currentPrice = getCarbonPrice();
        (uint256 referencePrice, , uint256 deviation, , bool isDeviated) = getPriceDeviationDetails();
        
        // 发出价格偏离检查事件
        emit PriceDeviationChecked(referencePrice, currentPrice, deviation, isDeviated);
        
        if (isDeviated) {
            emit SwapBlockedByPriceDeviation(referencePrice, currentPrice, deviation);
            revert("Price deviation too large");
        }
        
        // 计算兑换数量（考虑手续费）
        usdtAmount = (carbonAmount * totalUsdtTokens) / totalCarbonTokens;
        uint256 totalFee = (usdtAmount * feeRate) / BASE_RATE;
        usdtAmount -= totalFee;
        
        // 分配手续费
        uint256 platformFee = (totalFee * platformFeeShare) / 10000;  // 70%平台手续费
        uint256 lpFee = (totalFee * lpFeeShare) / 10000;              // 30%流动性提供者手续费
        
        // 转移代币
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransfer(msg.sender, usdtAmount);
        
        // 更新状态
        totalCarbonTokens += carbonAmount;
        totalUsdtTokens -= usdtAmount;
        
        // 累积手续费
        platformFeesUsdt += platformFee;
        totalLpFeesUsdt += lpFee;
        
        // 更新统计信息
        totalSwaps++;
        totalVolumeTraded += carbonAmount;
        totalFeesCollected += totalFee;
        
        emit TokensSwapped(msg.sender, address(carbonToken), address(usdtToken), carbonAmount, usdtAmount);
        return usdtAmount;
    }

    /**
     * @dev USDT兑换碳币
     * @param usdtAmount USDT数量
     * @return carbonAmount 获得的碳币数量
     */
    function swapUsdtToCarbon(uint256 usdtAmount) external whenNotPaused returns (uint256 carbonAmount) {
        require(usdtAmount > 0, "Amount must be greater than 0");
        
        // 检查价格偏离 - 使用当前池子价格进行检查
        uint256 currentPrice = getCarbonPrice();
        (uint256 referencePrice, , uint256 deviation, , bool isDeviated) = getPriceDeviationDetails();
        
        // 发出价格偏离检查事件
        emit PriceDeviationChecked(referencePrice, currentPrice, deviation, isDeviated);
        
        if (isDeviated) {
            emit SwapBlockedByPriceDeviation(referencePrice, currentPrice, deviation);
            revert("Price deviation too large");
        }
        
        // 计算兑换数量（考虑手续费）
        carbonAmount = (usdtAmount * totalCarbonTokens) / totalUsdtTokens;
        uint256 totalFee = (carbonAmount * feeRate) / BASE_RATE;
        carbonAmount -= totalFee;
        
        // 分配手续费
        uint256 platformFee = (totalFee * platformFeeShare) / 10000;  // 70%平台手续费
        uint256 lpFee = (totalFee * lpFeeShare) / 10000;              // 30%流动性提供者手续费
        
        // 转移代币
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        carbonToken.safeTransfer(msg.sender, carbonAmount);
        
        // 更新状态
        totalUsdtTokens += usdtAmount;
        totalCarbonTokens -= carbonAmount;
        
        // 累积手续费
        platformFeesCarbon += platformFee;
        totalLpFeesCarbon += lpFee;
        
        // 更新统计信息
        totalSwaps++;
        totalVolumeTraded += usdtAmount;
        totalFeesCollected += totalFee;
        
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

    /**
     * @dev 提取平台累积的手续费
     * @param token 要提取的代币地址（碳币或USDT）
     * @param amount 提取数量
     * @notice 只有合约所有者可以调用此函数
     */
    function withdrawPlatformFees(address token, uint256 amount) external onlyOwner {
        require(token == address(carbonToken) || token == address(usdtToken), "Invalid token");
        require(amount > 0, "Amount must be greater than 0");
        
        if (token == address(carbonToken)) {
            require(amount <= platformFeesCarbon, "Insufficient platform carbon fees");
            platformFeesCarbon -= amount;
            carbonToken.safeTransfer(msg.sender, amount);
        } else {
            require(amount <= platformFeesUsdt, "Insufficient platform USDT fees");
            platformFeesUsdt -= amount;
            usdtToken.safeTransfer(msg.sender, amount);
        }
        
        emit PlatformFeesWithdrawn(token, amount);
    }

    /**
     * @dev 获取合约中的代币余额
     * @return carbonBalance 碳币余额
     * @return usdtBalance USDT余额
     */
    function getContractBalances() external view returns (uint256 carbonBalance, uint256 usdtBalance) {
        carbonBalance = carbonToken.balanceOf(address(this));
        usdtBalance = usdtToken.balanceOf(address(this));
        return (carbonBalance, usdtBalance);
    }

    /**
     * @dev 获取手续费统计信息
     * @return platformCarbonFees 平台碳币手续费
     * @return platformUsdtFees 平台USDT手续费
     * @return totalLpCarbonFees 流动性提供者碳币手续费
     * @return totalLpUsdtFees 流动性提供者USDT手续费
     */
    function getFeeStats() external view returns (
        uint256 platformCarbonFees,
        uint256 platformUsdtFees,
        uint256 totalLpCarbonFees,
        uint256 totalLpUsdtFees
    ) {
        return (platformFeesCarbon, platformFeesUsdt, totalLpFeesCarbon, totalLpFeesUsdt);
    }

    // 紧急暂停功能
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender, true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyPaused(msg.sender, false);
    }

    // 统计信息更新
    function updatePoolStats() external onlyOwner {
        uint256 currentPrice = getCarbonPrice();
        emit PoolStatsUpdated(totalCarbonTokens, totalUsdtTokens, totalLPTokens, currentPrice);
    }

    /**
     * @dev 紧急暂停修饰器
     * @notice 当合约暂停时，只有所有者可以执行关键操作
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev 紧急提取代币
     * @param _token 代币地址
     * @param _to 接收地址
     * @param _amount 提取数量
     * @notice 只有合约所有者可以调用此函数
     */
    function emergencyWithdraw(address _token, address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be greater than 0");
        
        if (_token == address(carbonToken)) {
            require(_amount <= carbonToken.balanceOf(address(this)), "Insufficient carbon balance");
            carbonToken.safeTransfer(_to, _amount);
        } else if (_token == address(usdtToken)) {
            require(_amount <= usdtToken.balanceOf(address(this)), "Insufficient USDT balance");
            usdtToken.safeTransfer(_to, _amount);
        } else {
            revert("Unsupported token");
        }
        
        emit EmergencyWithdraw(_token, _to, _amount);
    }

    /**
     * @dev 获取池子统计信息
     * @return totalCarbon 池中碳币总量
     * @return totalUsdt 池中USDT总量
     * @return totalLP LP代币总量
     * @return currentPrice 当前价格
     * @return swapCount 总交易次数
     * @return totalVolume 总交易量
     * @return totalFees 总手续费
     * @return totalProviders 流动性提供者数量
     */
    function getPoolStats() external view returns (
        uint256 totalCarbon,
        uint256 totalUsdt,
        uint256 totalLP,
        uint256 currentPrice,
        uint256 swapCount,
        uint256 totalVolume,
        uint256 totalFees,
        uint256 totalProviders
    ) {
        return (
            totalCarbonTokens,
            totalUsdtTokens,
            totalLPTokens,
            getCarbonPrice(),
            totalSwaps,
            totalVolumeTraded,
            totalFeesCollected,
            totalLiquidityProviders
        );
    }

    /**
     * @dev 获取流动性提供者信息
     * @param _user 用户地址
     * @return lpTokens LP代币数量
     * @return carbonShare 碳币份额
     * @return usdtShare USDT份额
     * @return sharePercentage 份额百分比
     */
    function getLiquidityProviderInfo(address _user) external view returns (
        uint256 lpTokens,
        uint256 carbonShare,
        uint256 usdtShare,
        uint256 sharePercentage
    ) {
        lpTokens = userLPTokens[_user];
        if (lpTokens == 0 || totalLPTokens == 0) {
            return (0, 0, 0, 0);
        }
        
        carbonShare = (lpTokens * totalCarbonTokens) / totalLPTokens;
        usdtShare = (lpTokens * totalUsdtTokens) / totalLPTokens;
        sharePercentage = (lpTokens * 10000) / totalLPTokens; // 基点表示
        
        return (lpTokens, carbonShare, usdtShare, sharePercentage);
    }

    /**
     * @dev 获取兑换估算信息
     * @param _amountIn 输入数量
     * @param _isCarbonToUsdt 是否为碳币兑换USDT
     * @return amountOut 输出数量
     * @return fee 手续费
     * @return priceImpact 价格影响
     */
    function getSwapEstimate(uint256 _amountIn, bool _isCarbonToUsdt) external view returns (
        uint256 amountOut,
        uint256 fee,
        uint256 priceImpact
    ) {
        require(_amountIn > 0, "Amount must be greater than 0");
        
        if (_isCarbonToUsdt) {
            // 碳币兑换USDT
            amountOut = (_amountIn * totalUsdtTokens) / totalCarbonTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // 计算价格影响
            uint256 newCarbonTotal = totalCarbonTokens + _amountIn;
            uint256 newUsdtTotal = totalUsdtTokens - amountOut;
            uint256 newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
            uint256 currentPrice = getCarbonPrice();
            
            if (currentPrice > newPrice) {
                priceImpact = ((currentPrice - newPrice) * 10000) / currentPrice;
            } else {
                priceImpact = ((newPrice - currentPrice) * 10000) / currentPrice;
            }
        } else {
            // USDT兑换碳币
            amountOut = (_amountIn * totalCarbonTokens) / totalUsdtTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // 计算价格影响
            uint256 newUsdtTotal = totalUsdtTokens + _amountIn;
            uint256 newCarbonTotal = totalCarbonTokens - amountOut;
            uint256 newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
            uint256 currentPrice = getCarbonPrice();
            
            if (currentPrice > newPrice) {
                priceImpact = ((currentPrice - newPrice) * 10000) / currentPrice;
            } else {
                priceImpact = ((newPrice - currentPrice) * 10000) / currentPrice;
            }
        }
        
        return (amountOut, fee, priceImpact);
    }

    /**
     * @dev 获取流动性添加估算
     * @param _carbonAmount 碳币数量
     * @param _usdtAmount USDT数量
     * @return lpTokens LP代币数量
     * @return carbonShare 碳币份额
     * @return usdtShare USDT份额
     */
    function getAddLiquidityEstimate(uint256 _carbonAmount, uint256 _usdtAmount) external view returns (
        uint256 lpTokens,
        uint256 carbonShare,
        uint256 usdtShare
    ) {
        require(_carbonAmount > 0 && _usdtAmount > 0, "Amounts must be greater than 0");
        
        if (totalLPTokens == 0) {
            lpTokens = sqrt(_carbonAmount * _usdtAmount);
            carbonShare = _carbonAmount;
            usdtShare = _usdtAmount;
        } else {
            carbonShare = (_carbonAmount * totalLPTokens) / totalCarbonTokens;
            usdtShare = (_usdtAmount * totalLPTokens) / totalUsdtTokens;
            lpTokens = carbonShare < usdtShare ? carbonShare : usdtShare;
        }
        
        return (lpTokens, carbonShare, usdtShare);
    }

    /**
     * @dev 获取流动性移除估算
     * @param _lpTokens LP代币数量
     * @return carbonAmount 返还的碳币数量
     * @return usdtAmount 返还的USDT数量
     * @return sharePercentage 份额百分比
     */
    function getRemoveLiquidityEstimate(uint256 _lpTokens) external view returns (
        uint256 carbonAmount,
        uint256 usdtAmount,
        uint256 sharePercentage
    ) {
        require(_lpTokens > 0, "Amount must be greater than 0");
        require(_lpTokens <= totalLPTokens, "Insufficient LP tokens");
        
        carbonAmount = (_lpTokens * totalCarbonTokens) / totalLPTokens;
        usdtAmount = (_lpTokens * totalUsdtTokens) / totalLPTokens;
        sharePercentage = (_lpTokens * 10000) / totalLPTokens; // 基点表示
        
        return (carbonAmount, usdtAmount, sharePercentage);
    }

    /**
     * @dev 获取池子详细信息（包含价格信息）
     * @return totalCarbon 池中碳币总量
     * @return totalUsdt 池中USDT总量
     * @return totalLP LP代币总量
     * @return currentPrice 当前价格
     * @return oraclePrice 预言机价格
     * @return priceDeviated 是否价格偏离
     * @return deviationPercent 偏离百分比
     * @return currentFeeRate 手续费率
     * @return isPaused 是否暂停
     */
    function getPoolInfo() external view returns (
        uint256 totalCarbon,
        uint256 totalUsdt,
        uint256 totalLP,
        uint256 currentPrice,
        uint256 oraclePrice,
        bool priceDeviated,
        uint256 deviationPercent,
        uint256 currentFeeRate,
        bool isPaused
    ) {
        totalCarbon = totalCarbonTokens;
        totalUsdt = totalUsdtTokens;
        totalLP = totalLPTokens;
        currentPrice = getCarbonPrice();
        oraclePrice = getOracleReferencePrice();
        priceDeviated = isPriceDeviated(currentPrice);
        currentFeeRate = feeRate;
        isPaused = paused;
        
        // 计算偏离百分比
        if (oraclePrice > 0) {
            if (currentPrice > oraclePrice) {
                deviationPercent = ((currentPrice - oraclePrice) * 100) / oraclePrice;
            } else {
                deviationPercent = ((oraclePrice - currentPrice) * 100) / oraclePrice;
            }
        }
        
        return (totalCarbon, totalUsdt, totalLP, currentPrice, oraclePrice, priceDeviated, deviationPercent, currentFeeRate, isPaused);
    }


    /**
     * @dev 获取兑换历史统计
     * @return totalCarbonSwapped 总碳币兑换量
     * @return totalUsdtSwapped 总USDT兑换量
     * @return averageSwapSize 平均兑换大小
     * @return largestSwap 最大单笔兑换
     */
    function getSwapHistory() external view returns (
        uint256 totalCarbonSwapped,
        uint256 totalUsdtSwapped,
        uint256 averageSwapSize,
        uint256 largestSwap
    ) {
        // 这里返回基础统计信息
        // 实际实现中可能需要存储更详细的历史数据
        totalCarbonSwapped = totalVolumeTraded; // 简化处理
        totalUsdtSwapped = totalVolumeTraded;   // 简化处理
        averageSwapSize = totalSwaps > 0 ? totalVolumeTraded / totalSwaps : 0;
        largestSwap = 0; // 需要额外存储
        
        return (totalCarbonSwapped, totalUsdtSwapped, averageSwapSize, largestSwap);
    }

    /**
     * @dev 获取价格影响估算（更精确的版本）
     * @param _amountIn 输入数量
     * @param _isCarbonToUsdt 是否为碳币兑换USDT
     * @return amountOut 输出数量
     * @return fee 手续费
     * @return priceImpact 价格影响（基点）
     * @return newPrice 交易后新价格
     */
    function getDetailedSwapEstimate(uint256 _amountIn, bool _isCarbonToUsdt) external view returns (
        uint256 amountOut,
        uint256 fee,
        uint256 priceImpact,
        uint256 newPrice
    ) {
        require(_amountIn > 0, "Amount must be greater than 0");
        
        uint256 currentPrice = getCarbonPrice();
        
        if (_isCarbonToUsdt) {
            // 碳币兑换USDT
            amountOut = (_amountIn * totalUsdtTokens) / totalCarbonTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // 计算新价格
            uint256 newCarbonTotal = totalCarbonTokens + _amountIn;
            uint256 newUsdtTotal = totalUsdtTokens - amountOut;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        } else {
            // USDT兑换碳币
            amountOut = (_amountIn * totalCarbonTokens) / totalUsdtTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // 计算新价格
            uint256 newUsdtTotal = totalUsdtTokens + _amountIn;
            uint256 newCarbonTotal = totalCarbonTokens - amountOut;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        }
        
        // 计算价格影响（基点）
        if (currentPrice > 0) {
            if (newPrice > currentPrice) {
                priceImpact = ((newPrice - currentPrice) * 10000) / currentPrice;
            } else {
                priceImpact = ((currentPrice - newPrice) * 10000) / currentPrice;
            }
        }
        
        return (amountOut, fee, priceImpact, newPrice);
    }

    /**
     * @dev 获取流动性添加的精确估算
     * @param _carbonAmount 碳币数量
     * @param _usdtAmount USDT数量
     * @return lpTokens LP代币数量
     * @return carbonShare 碳币份额
     * @return usdtShare USDT份额
     * @return priceImpact 价格影响
     * @return newPrice 添加流动性后的价格
     */
    function getDetailedAddLiquidityEstimate(uint256 _carbonAmount, uint256 _usdtAmount) external view returns (
        uint256 lpTokens,
        uint256 carbonShare,
        uint256 usdtShare,
        uint256 priceImpact,
        uint256 newPrice
    ) {
        require(_carbonAmount > 0 && _usdtAmount > 0, "Amounts must be greater than 0");
        
        uint256 currentPrice = getCarbonPrice();
        
        if (totalLPTokens == 0) {
            lpTokens = sqrt(_carbonAmount * _usdtAmount);
            carbonShare = _carbonAmount;
            usdtShare = _usdtAmount;
            newPrice = (_usdtAmount * 1e18) / _carbonAmount;
        } else {
            carbonShare = (_carbonAmount * totalLPTokens) / totalCarbonTokens;
            usdtShare = (_usdtAmount * totalLPTokens) / totalUsdtTokens;
            lpTokens = carbonShare < usdtShare ? carbonShare : usdtShare;
            
            // 计算新价格
            uint256 newCarbonTotal = totalCarbonTokens + _carbonAmount;
            uint256 newUsdtTotal = totalUsdtTokens + _usdtAmount;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        }
        
        // 计算价格影响
        if (currentPrice > 0) {
            if (newPrice > currentPrice) {
                priceImpact = ((newPrice - currentPrice) * 10000) / currentPrice;
            } else {
                priceImpact = ((currentPrice - newPrice) * 10000) / currentPrice;
            }
        }
        
        return (lpTokens, carbonShare, usdtShare, priceImpact, newPrice);
    }

    /**
     * @dev 检查用户是否有足够的流动性
     * @param _user 用户地址
     * @param _lpTokens LP代币数量
     * @return hasEnough 是否有足够流动性
     * @return currentLP 当前LP代币数量
     * @return requiredLP 需要的LP代币数量
     */
    function checkLiquiditySufficiency(address _user, uint256 _lpTokens) external view returns (
        bool hasEnough,
        uint256 currentLP,
        uint256 requiredLP
    ) {
        currentLP = userLPTokens[_user];
        requiredLP = _lpTokens;
        hasEnough = currentLP >= requiredLP;
        
        return (hasEnough, currentLP, requiredLP);
    }
} 