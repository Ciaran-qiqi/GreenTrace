// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./CarbonToken.sol";
import "./interfaces/ICarbonPriceOracle.sol";

/**
 * @title GreenTalesLiquidityPool
 * @dev Carbon token liquidity pool contract, supports USDT and carbon token swaps
 * @notice Provides USDT liquidity for carbon tokens, enables bidirectional swaps between carbon tokens and USDT
 * 
 * Main features:
 * 1. Add liquidity: Users can deposit USDT and carbon tokens
 * 2. Remove liquidity: Users can withdraw USDT and carbon tokens
 * 3. Token swaps: Supports bidirectional swaps between USDT and carbon tokens
 * 4. Price oracle: Uses carbon price oracle for real-time pricing
 * 5. Fee collection: Collects trading fees and automatically distributes them
 * 6. Fee sharing: Platform 70%, liquidity providers 30%
 */
contract GreenTalesLiquidityPool is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for CarbonToken;

    // Contract state variables
    CarbonToken public carbonToken;        // Carbon token contract
    IERC20 public usdtToken;              // USDT contract (uses standard ERC20 interface)
    ICarbonPriceOracle public carbonPriceOracle; // Carbon price oracle
    
    // Fee configuration - made modifiable
    uint256 public feeRate = 30;  // 0.3% fee
    uint256 public constant BASE_RATE = 10000; // 100%
    uint256 public platformFeeShare = 7000;  // 70% platform fee
    uint256 public lpFeeShare = 3000;        // 30% liquidity provider fee
    uint256 public priceDeviationThreshold; // Price deviation threshold (percentage)
    
    // Liquidity pool state
    uint256 public totalCarbonTokens;     // Total carbon tokens in pool
    uint256 public totalUsdtTokens;       // Total USDT in pool
    uint256 public totalLPTokens;         // Total LP tokens
    
    // User liquidity information
    mapping(address => uint256) public userLPTokens;  // User LP token amount
    
    // Fee distribution related
    uint256 public platformFeesCarbon;    // Platform accumulated carbon token fees
    uint256 public platformFeesUsdt;      // Platform accumulated USDT fees
    uint256 public totalLpFeesCarbon;     // Liquidity providers accumulated carbon token fees
    uint256 public totalLpFeesUsdt;       // Liquidity providers accumulated USDT fees
    
    // User fee earnings records
    mapping(address => uint256) public userClaimedCarbonFees;  // User claimed carbon token fees
    mapping(address => uint256) public userClaimedUsdtFees;    // User claimed USDT fees
    mapping(address => uint256) public userLastLpTokens;       // User LP token amount at last fee calculation
    
    // Events
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

    // Emergency pause state
    bool public paused;

    // Statistics
    uint256 public totalSwaps;
    uint256 public totalVolumeTraded;
    uint256 public totalFeesCollected;
    uint256 public totalLiquidityProviders;

    /**
     * @dev Constructor
     * @param _carbonToken Carbon token contract address
     * @param _usdtToken USDT contract address
     */
    constructor(
        address _carbonToken,
        address _usdtToken
    ) {
        carbonToken = CarbonToken(_carbonToken);
        usdtToken = IERC20(_usdtToken);  // Use standard ERC20 interface
        priceDeviationThreshold = 10; // Default 10% deviation threshold
    }

    /**
     * @dev Set carbon price oracle
     * @param _carbonPriceOracle Carbon price oracle address
     */
    function setCarbonPriceOracle(address _carbonPriceOracle) external onlyOwner {
        address oldOracle = address(carbonPriceOracle);
        carbonPriceOracle = ICarbonPriceOracle(_carbonPriceOracle);
        emit CarbonPriceOracleUpdated(oldOracle, _carbonPriceOracle);
    }

    /**
     * @dev Set price deviation threshold
     * @param _threshold Threshold (percentage, e.g., 10 means 10%)
     */
    function setPriceDeviationThreshold(uint256 _threshold) external onlyOwner {
        uint256 oldThreshold = priceDeviationThreshold;
        priceDeviationThreshold = _threshold;
        emit PriceDeviationThresholdUpdated(oldThreshold, _threshold);
    }

    /**
     * @dev Set fee rate
     * @param _feeRate Fee rate (basis points, e.g., 30 means 0.3%)
     */
    function setFeeRate(uint256 _feeRate) external onlyOwner {
        require(_feeRate <= 1000, "Fee rate too high"); // Maximum 10%
        uint256 oldFeeRate = feeRate;
        feeRate = _feeRate;
        emit FeeRateUpdated(oldFeeRate, _feeRate);
    }

    /**
     * @dev Set fee distribution shares
     * @param _platformShare Platform fee share (basis points, e.g., 7000 means 70%)
     * @param _lpShare Liquidity provider fee share (basis points, e.g., 3000 means 30%)
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
     * @dev Get oracle carbon price reference (USD denominated, 18 decimals)
     * @return Oracle reference price (18 decimals, USD/carbon can be considered USDT/carbon)
     */
    function getOracleReferencePrice() public view returns (uint256) {
        if (address(carbonPriceOracle) == address(0)) {
            return 0;
        }
        
        uint256 oraclePrice8 = carbonPriceOracle.getLatestCarbonPriceUSD(); // 8 decimals, USD/carbon
        if (oraclePrice8 == 0) {
            return 0;
        }
        
        // Convert oracle price from 8 decimals to 18 decimals
        return oraclePrice8 * 1e10; // 8 -> 18
    }

    /**
     * @dev Check if price deviation is too large
     * @param marketPrice Market price (18 decimals, USDT/carbon)
     * @return bool Whether deviation is too large
     */
    function isPriceDeviated(uint256 marketPrice) public view returns (bool) {
        uint256 referencePrice = getOracleReferencePrice();
        if (referencePrice == 0) return false;
        
        // Calculate price deviation percentage
        uint256 deviation;
        if (marketPrice > referencePrice) {
            deviation = ((marketPrice - referencePrice) * 100) / referencePrice;
        } else {
            deviation = ((referencePrice - marketPrice) * 100) / referencePrice;
        }
            
        return deviation > priceDeviationThreshold;
    }

    /**
     * @dev Get detailed price deviation information
     * @return referencePrice Oracle reference price (18 decimals)
     * @return marketPrice Market price (18 decimals)
     * @return deviation Deviation percentage
     * @return threshold Deviation threshold
     * @return isDeviated Whether deviation is too large
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
        
        if (referencePrice == 0 || marketPrice == 0) {
            deviation = 0;
            isDeviated = false;
        } else {
            if (marketPrice > referencePrice) {
                deviation = ((marketPrice - referencePrice) * 100) / referencePrice;
            } else {
                deviation = ((referencePrice - marketPrice) * 100) / referencePrice;
            }
            isDeviated = deviation > threshold;
        }
    }

    /**
     * @dev Get real-time carbon token price (in USDT)
     * @return Price (in USDT, 18 decimals)
     * @notice Calculated using AMM formula: Total USDT / Total Carbon Tokens
     */
    function getCarbonPrice() public view returns (uint256) {
        if (totalCarbonTokens == 0 || totalUsdtTokens == 0) {
            return 0;
        }
        return (totalUsdtTokens * 1e18) / totalCarbonTokens;
    }

    /**
     * @dev Get carbon token USD price (directly from oracle)
     * @return Price (in USD, 18 decimals)
     * @notice Directly use carbon price oracle USD price, no USDT conversion needed
     */
    function getCarbonPriceUSD() public view returns (uint256) {
        return getOracleReferencePrice();
    }

    /**
     * @dev Calculate user's claimable fee rewards
     * @param _user User address
     * @return carbonFees Claimable carbon token fees
     * @return usdtFees Claimable USDT fees
     */
    function calculateUserFees(address _user) public view returns (uint256 carbonFees, uint256 usdtFees) {
        uint256 userLP = userLPTokens[_user];
        if (userLP == 0 || totalLPTokens == 0) {
            return (0, 0);
        }
        
        // Calculate user's carbon token fees
        uint256 userCarbonFees = (userLP * totalLpFeesCarbon) / totalLPTokens;
        carbonFees = userCarbonFees > userClaimedCarbonFees[_user] ? 
                    userCarbonFees - userClaimedCarbonFees[_user] : 0;
        
        // Calculate user's USDT fees
        uint256 userUsdtFees = (userLP * totalLpFeesUsdt) / totalLPTokens;
        usdtFees = userUsdtFees > userClaimedUsdtFees[_user] ? 
                  userUsdtFees - userClaimedUsdtFees[_user] : 0;
        
        return (carbonFees, usdtFees);
    }

    /**
     * @dev User claims accumulated fee rewards
     * @return carbonFees Claimed carbon token fees
     * @return usdtFees Claimed USDT fees
     */
    function claimFees() external returns (uint256 carbonFees, uint256 usdtFees) {
        (carbonFees, usdtFees) = calculateUserFees(msg.sender);
        
        require(carbonFees > 0 || usdtFees > 0, "No fees to claim");
        
        // Update claimed records
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
     * @dev Add liquidity
     * @param carbonAmount Carbon token amount
     * @param usdtAmount USDT amount
     * @return lpTokens LP tokens received
     */
    function addLiquidity(uint256 carbonAmount, uint256 usdtAmount) external whenNotPaused returns (uint256 lpTokens) {
        require(carbonAmount > 0 && usdtAmount > 0, "Amounts must be greater than 0");
        
        // Transfer tokens to contract
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        
        // Calculate LP token amount
        if (totalLPTokens == 0) {
            lpTokens = sqrt(carbonAmount * usdtAmount);
            totalLiquidityProviders++;
        } else {
            uint256 carbonShare = (carbonAmount * totalLPTokens) / totalCarbonTokens;
            uint256 usdtShare = (usdtAmount * totalLPTokens) / totalUsdtTokens;
            lpTokens = carbonShare < usdtShare ? carbonShare : usdtShare;
            
            // If new user, increment provider count
            if (userLPTokens[msg.sender] == 0) {
                totalLiquidityProviders++;
            }
        }
        
        // Update state
        totalCarbonTokens += carbonAmount;
        totalUsdtTokens += usdtAmount;
        totalLPTokens += lpTokens;
        userLPTokens[msg.sender] += lpTokens;
        
        emit LiquidityAdded(msg.sender, carbonAmount, usdtAmount, lpTokens);
        return lpTokens;
    }

    /**
     * @dev Remove liquidity
     * @param lpTokens LP token amount
     * @return carbonAmount Carbon tokens returned
     * @return usdtAmount USDT returned
     */
    function removeLiquidity(uint256 lpTokens) external whenNotPaused returns (uint256 carbonAmount, uint256 usdtAmount) {
        require(lpTokens > 0, "Amount must be greater than 0");
        require(userLPTokens[msg.sender] >= lpTokens, "Insufficient LP tokens");
        
        // Calculate return amounts
        carbonAmount = (lpTokens * totalCarbonTokens) / totalLPTokens;
        usdtAmount = (lpTokens * totalUsdtTokens) / totalLPTokens;
        
        // Update state
        totalCarbonTokens -= carbonAmount;
        totalUsdtTokens -= usdtAmount;
        totalLPTokens -= lpTokens;
        userLPTokens[msg.sender] -= lpTokens;
        
        // If user removes all LP tokens, decrement provider count
        if (userLPTokens[msg.sender] == 0) {
            totalLiquidityProviders--;
        }
        
        // Transfer tokens
        carbonToken.safeTransfer(msg.sender, carbonAmount);
        usdtToken.safeTransfer(msg.sender, usdtAmount);
        
        emit LiquidityRemoved(msg.sender, carbonAmount, usdtAmount, lpTokens);
        return (carbonAmount, usdtAmount);
    }

    /**
     * @dev Swap carbon tokens for USDT
     * @param carbonAmount Carbon token amount
     * @return usdtAmount USDT amount received
     */
    function swapCarbonToUsdt(uint256 carbonAmount) external whenNotPaused returns (uint256 usdtAmount) {
        require(carbonAmount > 0, "Amount must be greater than 0");
        
        // Check price deviation - use current pool price for check
        uint256 currentPrice = getCarbonPrice();
        (uint256 referencePrice, , uint256 deviation, , bool isDeviated) = getPriceDeviationDetails();
        
        // Emit price deviation check event
        emit PriceDeviationChecked(referencePrice, currentPrice, deviation, isDeviated);
        
        if (isDeviated) {
            emit SwapBlockedByPriceDeviation(referencePrice, currentPrice, deviation);
            revert("Price deviation too large");
        }
        
        // Calculate swap amount (considering fees)
        usdtAmount = (carbonAmount * totalUsdtTokens) / totalCarbonTokens;
        uint256 totalFee = (usdtAmount * feeRate) / BASE_RATE;
        usdtAmount -= totalFee;
        
        // Distribute fees
        uint256 platformFee = (totalFee * platformFeeShare) / 10000;  // 70% platform fee
        uint256 lpFee = (totalFee * lpFeeShare) / 10000;              // 30% liquidity provider fee
        
        // Transfer tokens
        carbonToken.safeTransferFrom(msg.sender, address(this), carbonAmount);
        usdtToken.safeTransfer(msg.sender, usdtAmount);
        
        // Update state
        totalCarbonTokens += carbonAmount;
        totalUsdtTokens -= usdtAmount;
        
        // Accumulate fees
        platformFeesUsdt += platformFee;
        totalLpFeesUsdt += lpFee;
        
        // Update statistics
        totalSwaps++;
        totalVolumeTraded += carbonAmount;
        totalFeesCollected += totalFee;
        
        emit TokensSwapped(msg.sender, address(carbonToken), address(usdtToken), carbonAmount, usdtAmount);
        return usdtAmount;
    }

    /**
     * @dev Swap USDT for carbon tokens
     * @param usdtAmount USDT amount
     * @return carbonAmount Carbon tokens received
     */
    function swapUsdtToCarbon(uint256 usdtAmount) external whenNotPaused returns (uint256 carbonAmount) {
        require(usdtAmount > 0, "Amount must be greater than 0");
        
        // Check price deviation - use current pool price for check
        uint256 currentPrice = getCarbonPrice();
        (uint256 referencePrice, , uint256 deviation, , bool isDeviated) = getPriceDeviationDetails();
        
        // Emit price deviation check event
        emit PriceDeviationChecked(referencePrice, currentPrice, deviation, isDeviated);
        
        if (isDeviated) {
            emit SwapBlockedByPriceDeviation(referencePrice, currentPrice, deviation);
            revert("Price deviation too large");
        }
        
        // Calculate swap amount (considering fees)
        carbonAmount = (usdtAmount * totalCarbonTokens) / totalUsdtTokens;
        uint256 totalFee = (carbonAmount * feeRate) / BASE_RATE;
        carbonAmount -= totalFee;
        
        // Distribute fees
        uint256 platformFee = (totalFee * platformFeeShare) / 10000;  // 70% platform fee
        uint256 lpFee = (totalFee * lpFeeShare) / 10000;              // 30% liquidity provider fee
        
        // Transfer tokens
        usdtToken.safeTransferFrom(msg.sender, address(this), usdtAmount);
        carbonToken.safeTransfer(msg.sender, carbonAmount);
        
        // Update state
        totalUsdtTokens += usdtAmount;
        totalCarbonTokens -= carbonAmount;
        
        // Accumulate fees
        platformFeesCarbon += platformFee;
        totalLpFeesCarbon += lpFee;
        
        // Update statistics
        totalSwaps++;
        totalVolumeTraded += usdtAmount;
        totalFeesCollected += totalFee;
        
        emit TokensSwapped(msg.sender, address(usdtToken), address(carbonToken), usdtAmount, carbonAmount);
        return carbonAmount;
    }

    /**
     * @dev Calculate square root
     * @param x Input number
     * @return Square root
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
     * @dev Withdraw platform accumulated fees
     * @param token Token address to withdraw (carbon token or USDT)
     * @param amount Withdrawal amount
     * @notice Only contract owner can call this function
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
     * @dev Get token balances in contract
     * @return carbonBalance Carbon token balance
     * @return usdtBalance USDT balance
     */
    function getContractBalances() external view returns (uint256 carbonBalance, uint256 usdtBalance) {
        carbonBalance = carbonToken.balanceOf(address(this));
        usdtBalance = usdtToken.balanceOf(address(this));
        return (carbonBalance, usdtBalance);
    }

    /**
     * @dev Get fee statistics
     * @return platformCarbonFees Platform carbon token fees
     * @return platformUsdtFees Platform USDT fees
     * @return totalLpCarbonFees Liquidity providers carbon token fees
     * @return totalLpUsdtFees Liquidity providers USDT fees
     */
    function getFeeStats() external view returns (
        uint256 platformCarbonFees,
        uint256 platformUsdtFees,
        uint256 totalLpCarbonFees,
        uint256 totalLpUsdtFees
    ) {
        return (platformFeesCarbon, platformFeesUsdt, totalLpFeesCarbon, totalLpFeesUsdt);
    }

    // Emergency pause functionality
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender, true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyPaused(msg.sender, false);
    }

    // Statistics update
    function updatePoolStats() external onlyOwner {
        uint256 currentPrice = getCarbonPrice();
        emit PoolStatsUpdated(totalCarbonTokens, totalUsdtTokens, totalLPTokens, currentPrice);
    }

    /**
     * @dev Emergency pause modifier
     * @notice When contract is paused, only owner can execute critical operations
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev Emergency withdraw tokens
     * @param _token Token address
     * @param _to Recipient address
     * @param _amount Withdrawal amount
     * @notice Only contract owner can call this function
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
     * @dev Get pool statistics
     * @return totalCarbon Total carbon tokens in pool
     * @return totalUsdt Total USDT in pool
     * @return totalLP Total LP tokens
     * @return currentPrice Current price
     * @return swapCount Total swap count
     * @return totalVolume Total trading volume
     * @return totalFees Total fees
     * @return totalProviders Number of liquidity providers
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
     * @dev Get liquidity provider information
     * @param _user User address
     * @return lpTokens LP token amount
     * @return carbonShare Carbon token share
     * @return usdtShare USDT share
     * @return sharePercentage Share percentage
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
        sharePercentage = (lpTokens * 10000) / totalLPTokens; // Basis points
        
        return (lpTokens, carbonShare, usdtShare, sharePercentage);
    }

    /**
     * @dev Get swap estimate information
     * @param _amountIn Input amount
     * @param _isCarbonToUsdt Whether it's carbon token to USDT swap
     * @return amountOut Output amount
     * @return fee Fee
     * @return priceImpact Price impact
     */
    function getSwapEstimate(uint256 _amountIn, bool _isCarbonToUsdt) external view returns (
        uint256 amountOut,
        uint256 fee,
        uint256 priceImpact
    ) {
        require(_amountIn > 0, "Amount must be greater than 0");
        
        if (_isCarbonToUsdt) {
            // Carbon token to USDT swap
            amountOut = (_amountIn * totalUsdtTokens) / totalCarbonTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // Calculate price impact
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
            // USDT to carbon token swap
            amountOut = (_amountIn * totalCarbonTokens) / totalUsdtTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // Calculate price impact
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
     * @dev Get liquidity addition estimate
     * @param _carbonAmount Carbon token amount
     * @param _usdtAmount USDT amount
     * @return lpTokens LP token amount
     * @return carbonShare Carbon token share
     * @return usdtShare USDT share
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
     * @dev Get liquidity removal estimate
     * @param _lpTokens LP token amount
     * @return carbonAmount Carbon tokens returned
     * @return usdtAmount USDT returned
     * @return sharePercentage Share percentage
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
        sharePercentage = (_lpTokens * 10000) / totalLPTokens; // Basis points
        
        return (carbonAmount, usdtAmount, sharePercentage);
    }

    /**
     * @dev Get detailed pool information (including price information)
     * @return totalCarbon Total carbon tokens in pool
     * @return totalUsdt Total USDT in pool
     * @return totalLP Total LP tokens
     * @return currentPrice Current price
     * @return oraclePrice Oracle price
     * @return priceDeviated Whether price is deviated
     * @return deviationPercent Deviation percentage
     * @return currentFeeRate Current fee rate
     * @return isPaused Whether paused
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
        
        // Calculate deviation percentage
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
     * @dev Get swap history statistics
     * @return totalCarbonSwapped Total carbon token swap volume
     * @return totalUsdtSwapped Total USDT swap volume
     * @return averageSwapSize Average swap size
     * @return largestSwap Largest single swap
     */
    function getSwapHistory() external view returns (
        uint256 totalCarbonSwapped,
        uint256 totalUsdtSwapped,
        uint256 averageSwapSize,
        uint256 largestSwap
    ) {
        // Return basic statistics here
        // Actual implementation may need to store more detailed historical data
        totalCarbonSwapped = totalVolumeTraded; // Simplified processing
        totalUsdtSwapped = totalVolumeTraded;   // Simplified processing
        averageSwapSize = totalSwaps > 0 ? totalVolumeTraded / totalSwaps : 0;
        largestSwap = 0; // Need additional storage
        
        return (totalCarbonSwapped, totalUsdtSwapped, averageSwapSize, largestSwap);
    }

    /**
     * @dev Get price impact estimate (more precise version)
     * @param _amountIn Input amount
     * @param _isCarbonToUsdt Whether it's carbon token to USDT swap
     * @return amountOut Output amount
     * @return fee Fee
     * @return priceImpact Price impact (basis points)
     * @return newPrice New price after trade
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
            // Carbon token to USDT swap
            amountOut = (_amountIn * totalUsdtTokens) / totalCarbonTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // Calculate new price
            uint256 newCarbonTotal = totalCarbonTokens + _amountIn;
            uint256 newUsdtTotal = totalUsdtTokens - amountOut;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        } else {
            // USDT to carbon token swap
            amountOut = (_amountIn * totalCarbonTokens) / totalUsdtTokens;
            fee = (amountOut * feeRate) / BASE_RATE;
            amountOut -= fee;
            
            // Calculate new price
            uint256 newUsdtTotal = totalUsdtTokens + _amountIn;
            uint256 newCarbonTotal = totalCarbonTokens - amountOut;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        }
        
        // Calculate price impact (basis points)
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
     * @dev Get precise liquidity addition estimate
     * @param _carbonAmount Carbon token amount
     * @param _usdtAmount USDT amount
     * @return lpTokens LP token amount
     * @return carbonShare Carbon token share
     * @return usdtShare USDT share
     * @return priceImpact Price impact
     * @return newPrice New price after adding liquidity
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
            
            // Calculate new price
            uint256 newCarbonTotal = totalCarbonTokens + _carbonAmount;
            uint256 newUsdtTotal = totalUsdtTokens + _usdtAmount;
            newPrice = (newUsdtTotal * 1e18) / newCarbonTotal;
        }
        
        // Calculate price impact
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
     * @dev Check if user has sufficient liquidity
     * @param _user User address
     * @param _lpTokens LP token amount
     * @return hasEnough Whether has sufficient liquidity
     * @return currentLP Current LP token amount
     * @return requiredLP Required LP token amount
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