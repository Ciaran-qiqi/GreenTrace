// SPDX-License-Identifier: MIT
// https://ackee.xyz/wake/docs/4.19.0/static-analysis/using-detectors/#ignoring-detections
// 忽略wake检测
// https://ackee.xyz/wake/docs/4.19.0/static-analysis/detectors/unsafe-erc20-call/
// wake-disable unsafe-erc20-call unused-import

pragma solidity ^0.8.19;

import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/interfaces/IFunctionsRouter.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./interfaces/ICarbonPriceOracle.sol";

/**
 * @title CarbonPriceOracle
 * @dev 碳价预言机合约，使用Chainlink Functions获取API碳价并转换为美元价格
 * @notice 通过Chainlink Functions调用API获取碳价(欧元计价)，并通过EUR/USD价格预言机转换为美元价格
 */
contract CarbonPriceOracle is FunctionsClient, ICarbonPriceOracle, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;
    
    // 状态变量
    uint256 public carbonPriceEUR;      // 欧元碳价
    uint256 public carbonPriceUSD;      // 美元碳价
    
    // Chainlink Functions 配置
    bytes32 public donId;               // DON ID
    uint64 public subscriptionId;       // 订阅ID
    uint32 public gasLimit;             // Gas限制
    bytes32 public secretsLocation;     // 密钥位置
    
    // EUR/USD 价格预言机
    AggregatorV3Interface public eurUsdPriceFeed;
    
    // 授权操作员映射
    mapping(address => bool) public authorizedOperators;
    
    // LINK代币地址
    IERC20 public linkToken;
    
    // 事件
    event PriceUpdated(uint256 eurPrice, uint256 usdPrice, uint256 timestamp);
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    event FunctionsRequestSent(bytes32 indexed requestId, string source);
    
    /**
     * @dev 构造函数
     * @param router Chainlink Functions Router地址
     * @param _donId DON ID
     * @param _eurUsdPriceFeed EUR/USD价格预言机地址
     * @param _linkToken LINK代币地址
     */
    constructor(
        address router,
        bytes32 _donId,
        address _eurUsdPriceFeed,
        address _linkToken
    ) FunctionsClient(router) Ownable() {
        donId = _donId;
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        gasLimit = 300000; // 设置合理的gas限制
        linkToken = IERC20(_linkToken);
    }
    
    /**
     * @dev 设置订阅ID-订阅ID关联了你的付费账户
     * @param _subscriptionId 订阅ID
     * @notice 只有合约所有者可以调用此函数
     */
    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }
    
    /**
     * @dev 添加授权操作员-操作员可以调用requestCarbonPrice函数
     * @param _operator 操作员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator address");
        authorizedOperators[_operator] = true;
        emit OperatorAdded(_operator);
    }
    
    /**
     * @dev 移除授权操作员
     * @param _operator 操作员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function removeOperator(address _operator) external onlyOwner {
        authorizedOperators[_operator] = false;
        emit OperatorRemoved(_operator);
    }
    
    /**
     * @dev 权限检查修饰器
     * @notice 只有合约所有者或授权操作员可以调用
     */
    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorizedOperators[msg.sender], "Not authorized");
        _;
    }
    
    /**
     * @dev 请求更新碳价
     * @notice 使用Chainlink Functions调用API获取最新碳价
     * @notice 需要确保有足够的订阅余额支付费用
     * @notice 只有合约所有者或授权操作员可以调用此函数
     */
    function requestCarbonPrice() public onlyAuthorized {
        require(subscriptionId != 0, "Subscription ID not set");
        
        // 构建JavaScript源代码
        string memory source = "const response = await Functions.makeHttpRequest({"
            "url: 'https://greentrace-api.onrender.com/api/carbon-price',"
            "method: 'GET'"
            "});"
            "if (response.error) {"
            "  throw Error('Request failed');"
            "}"
            "const data = response.data;"
            "if (!data || !data.price) {"
            "  throw Error('Invalid response format');"
            "}"
            "return Functions.encodeUint256(Math.round(data.price * 1e18));";
        
        // 构建请求
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        // 发送请求
        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );
        
        emit FunctionsRequestSent(requestId, source);
    }
    
    /**
     * @dev fulfillRequest：Chainlink Functions回调处理（EUR-USD价格预言机）
     * @param requestId 请求ID
     * @param response 响应数据
     * @param err 错误信息
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (err.length > 0) {
            // 处理错误
            return;
        }
        uint256 priceEUR = abi.decode(response, (uint256));
        carbonPriceEUR = priceEUR;
        // 获取EUR/USD价格
        (, int256 eurUsdPrice,,,) = eurUsdPriceFeed.latestRoundData();
        carbonPriceUSD = (priceEUR * uint256(eurUsdPrice)) / 1e8;
        emit PriceUpdated(carbonPriceEUR, carbonPriceUSD, block.timestamp);
    }
    
    /**
     * @dev 提取合约中的LINK代币（管理合约中link币数量）
     * @param _to 接收地址
     * @param _amount 提取数量
     * @notice 只有合约所有者可以调用此函数
     */
    function withdrawLink(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 contractBalance = linkToken.balanceOf(address(this));
        require(_amount <= contractBalance, "Insufficient LINK balance");
        require(linkToken.transfer(_to, _amount), "LINK transfer failed");
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
} 