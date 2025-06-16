// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "lib/chainlink-brownie-contracts/contracts/src/v0.8/ChainlinkClient.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/Chainlink.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "./interfaces/ICarbonPriceOracle.sol";


/**
 * @title CarbonPriceOracle
 * @dev 碳价预言机合约，用于获取API碳价并转换为美元价格
 * @notice 通过Chainlink获取API碳价，并通过EUR/USD价格预言机转换为美元价格
 */
contract CarbonPriceOracle is ChainlinkClient, ICarbonPriceOracle {
    using Chainlink for Chainlink.Request;
    
    // 状态变量
    uint256 public carbonPriceEUR;      // 欧元碳价
    uint256 public carbonPriceUSD;      // 美元碳价
    bytes32 private jobId;              // Chainlink job ID
    uint256 private fee;                // Chainlink 费用
    
    // EUR/USD 价格预言机
    AggregatorV3Interface public eurUsdPriceFeed;
    
    // 事件
    event PriceUpdated(uint256 eurPrice, uint256 usdPrice, uint256 timestamp);
    
    /**
     * @dev 构造函数
     * @param _chainlinkToken Chainlink token地址
     * @param _eurUsdPriceFeed EUR/USD价格预言机地址
     */
    constructor(
        address _chainlinkToken,
        address _eurUsdPriceFeed
    ) ChainlinkClient() {
        _setChainlinkToken(_chainlinkToken);
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        jobId = "7d80a6386ef543a3abb52817f6707e3b";  // Sepolia测试网 HTTP GET > Uint256 job
        fee = 0.1 * 10 ** 18;   // 0.1 LINK (测试网费用)
    }
    
    /**
     * @dev 请求更新碳价
     * @notice 调用Chainlink获取最新碳价
     * @notice 需要确保合约有足够的LINK代币支付费用
     */
    function requestCarbonPrice() public {
        // 检查合约LINK余额
        require(
            LinkTokenInterface(_chainlinkTokenAddress()).balanceOf(address(this)) >= fee,
            "Insufficient LINK balance"
        );

        Chainlink.Request memory req = _buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillCarbonPrice.selector
        );
        
        req._add("get", "https://greentrace-api.onrender.com/api/carbon-price");
        req._add("path", "price");
        
        _sendChainlinkRequest(req, fee);
    }
    
    /**
     * @dev 处理碳价回调
     * @param _requestId 请求ID
     * @param _price 碳价（欧元）
     */
    function fulfillCarbonPrice(bytes32 _requestId, uint256 _price) public {
        carbonPriceEUR = _price;
        
        // 获取EUR/USD价格
        (, int256 eurUsdPrice,,,) = eurUsdPriceFeed.latestRoundData();
        
        // 计算美元价格（考虑精度）
        carbonPriceUSD = (_price * uint256(eurUsdPrice)) / 1e8;
        
        emit PriceUpdated(carbonPriceEUR, carbonPriceUSD, block.timestamp);
    }
    
    /**
     * @dev 获取最新碳价（美元）
     * @return 碳价（美元）
     */
    function getLatestCarbonPriceUSD() external view override returns (uint256) {
        return carbonPriceUSD;
    }
    
    /**
     * @dev 获取最新碳价（欧元）
     * @return 碳价（欧元）
     */
    function getLatestCarbonPriceEUR() external view override returns (uint256) {
        return carbonPriceEUR;
    }

    /**
     * @dev 提取合约中的LINK代币
     * @param _to 接收地址
     * @param _amount 提取数量
     */
    function withdrawLink(address _to, uint256 _amount) external {
        require(_to != address(0), "Invalid address");
        require(
            LinkTokenInterface(_chainlinkTokenAddress()).transfer(_to, _amount),
            "LINK transfer failed"
        );
    }
} 