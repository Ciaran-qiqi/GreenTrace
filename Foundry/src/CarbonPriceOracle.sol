// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call

pragma solidity ^0.8.19;

import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "lib/chainlink-brownie-contracts/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
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
    
    // ============ 状态变量 ============
    uint256 public carbonPriceEUR;      // 欧元碳价（8位精度，例如：500000000 = 5.00 EUR）
    uint256 public carbonPriceUSD;      // 美元碳价（8位精度，例如：550000000 = 5.50 USD）
    
    // ============ Chainlink Functions 配置 ============
    bytes32 public donId;               // DON ID：指定使用哪个去中心化预言机网络
    uint64 public subscriptionId;       // 订阅ID：关联付费账户，用于支付Functions调用费用
    uint32 public gasLimit;             // Gas限制：限制JavaScript代码执行的最大gas消耗
    bytes32 public secretsLocation;     // 密钥位置：用于存储API密钥等敏感信息（当前未使用）
    
    // ============ 外部依赖 ============
    AggregatorV3Interface public eurUsdPriceFeed;  // EUR/USD价格预言机合约地址
    IERC20 public linkToken;                       // LINK代币合约地址，用于支付Functions费用
    
    // ============ 权限管理 ============
    mapping(address => bool) public authorizedOperators;  // 授权操作员映射，允许非所有者调用requestCarbonPrice
    
    // ============ 事件定义 ============
    // 价格更新事件
    event PriceUpdated(uint256 eurPrice, uint256 usdPrice, uint256 timestamp);
    
    // 操作员管理事件
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    
    // Functions请求相关事件
    event FunctionsRequestSent(bytes32 indexed requestId, string source);
    event RequestProcessed(bytes32 indexed requestId, bool success, string errorMessage);
    event RequestInitiated(address indexed caller, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    event RequestValidationFailed(string reason);
    event RequestSent(bytes32 indexed requestId, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    
    // JavaScript代码构建事件
    event JavaScriptSourceBuilt(string source);
    event RequestObjectCreated();
    event RequestEncoded(bytes encodedRequest);
    
    // 回调处理事件
    event FulfillRequestStarted(bytes32 indexed requestId, uint256 responseLength, uint256 errorLength);
    event ResponseDecoded(uint256 priceEUR);
    event EurUsdPriceFetched(int256 eurUsdPrice);
    event UsdPriceCalculated(uint256 usdPrice);
    event FulfillRequestCompleted(bytes32 indexed requestId);
    
    // 价格计算事件
    event PriceCalculation(uint256 eurPrice, uint256 eurUsdRate, uint256 usdPrice);
    
    /**
     * @dev 构造函数 - 初始化预言机合约
     * @param router Chainlink Functions Router地址 - 负责路由Functions请求到正确的DON
     * @param _donId DON ID - 指定使用哪个去中心化预言机网络（例如：fun-ethereum-sepolia-1）
     * @param _eurUsdPriceFeed EUR/USD价格预言机地址 - 用于获取实时汇率
     * @param _linkToken LINK代币地址 - 用于支付Functions调用费用
     * 
     * 初始化说明：
     * - 继承FunctionsClient以获取Functions调用能力
     * - 继承Ownable以获取权限管理功能
     * - 设置初始gas限制为1,000,000（足够执行复杂的JavaScript代码）
     * - 验证所有地址参数的有效性
     * 
     * 技术细节：
     * - gasLimit设置为1,000,000确保JavaScript代码有足够gas执行
     * - 使用AggregatorV3Interface接口与Chainlink价格预言机交互
     * - 初始化LINK代币合约引用用于费用支付
     */
    constructor(
        address router,
        bytes32 _donId,
        address _eurUsdPriceFeed,
        address _linkToken
    ) FunctionsClient(router) Ownable() {
        donId = _donId;
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        gasLimit = 1000000; // 设置更高的初始gas限制
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
     * @dev 设置Gas限制
     * @param _gasLimit Gas限制
     * @notice 只有合约所有者可以调用此函数
     */
    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
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
     * @dev 请求更新碳价 - 核心功能函数
     * @notice 使用Chainlink Functions调用API获取最新碳价
     * @notice 需要确保有足够的订阅余额支付费用
     * @notice 只有合约所有者或授权操作员可以调用此函数
     * 
     * 执行流程：
     * 1. 验证配置参数（订阅ID、gas限制、DON ID）
     * 2. 构建JavaScript源代码（调用API并返回8位精度价格）
     * 3. 创建FunctionsRequest对象并编码为CBOR格式
     * 4. 发送请求到Chainlink Functions网络
     * 5. 记录请求ID和相关信息
     * 
     * JavaScript代码说明：
     * - 调用https://greentrace-api.onrender.com/api/carbon-price获取碳价
     * - 验证响应格式和数据类型
     * - 将价格乘以1e8转换为8位精度
     * - 使用Functions.encodeUint256编码返回数据
     * 
     * 安全考虑：
     * - 参数验证防止无效请求
     * - 权限检查确保只有授权用户可调用
     * - 完整的事件记录便于调试和监控
     */
    function requestCarbonPrice() public onlyAuthorized {
        // 验证订阅ID
        if (subscriptionId == 0) {
            emit RequestValidationFailed("Subscription ID not set");
            revert("Subscription ID not set");
        }
        
        // 验证gas限制
        if (gasLimit == 0) {
            emit RequestValidationFailed("Gas limit not set");
            revert("Gas limit not set");
        }
        
        // 验证DON ID
        if (donId == bytes32(0)) {
            emit RequestValidationFailed("DON ID not set");
            revert("DON ID not set");
        }
        
        // 记录请求开始
        emit RequestInitiated(msg.sender, subscriptionId, gasLimit, donId);
        
        // 构建JavaScript源代码
        string memory source = string(
            abi.encodePacked(
                "const response = await Functions.makeHttpRequest({",
                "url: 'https://greentrace-api.onrender.com/api/carbon-price',",
                "method: 'GET'",
                "});",
                "if (response.error) { throw Error('Request failed'); }",
                "const data = response.data;",
                "if (!data || typeof data.price !== 'number') { throw Error('Invalid response format'); }",
                "return Functions.encodeUint256(Math.round(data.price * 1e8));"
            )
        );
        
        // 记录JavaScript源代码构建完成
        emit JavaScriptSourceBuilt(source);
        
        // 构建请求
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        // 记录请求对象创建完成
        emit RequestObjectCreated();
        
        // 编码请求
        bytes memory encodedRequest = req.encodeCBOR();
        emit RequestEncoded(encodedRequest);
        
        // 发送请求
        bytes32 requestId = _sendRequest(
            encodedRequest,
            subscriptionId,
            gasLimit,
            donId
        );
        
        // 记录请求发送完成
        emit RequestSent(requestId, subscriptionId, gasLimit, donId);
        emit FunctionsRequestSent(requestId, source);
    }
    
    /**
     * @dev fulfillRequest - Chainlink Functions回调处理函数
     * @param requestId 请求ID - 用于标识特定的Functions请求
     * @param response 响应数据 - JavaScript代码返回的编码数据
     * @param err 错误信息 - 如果JavaScript执行失败，包含错误详情
     * 
     * 处理流程：
     * 1. 检查是否有错误发生
     * 2. 解码JavaScript返回的欧元价格（8位精度）
     * 3. 从EUR/USD价格预言机获取实时汇率
     * 4. 计算美元价格：USD = EUR * (EUR/USD汇率)
     * 5. 更新状态变量并发出事件
     * 
     * 精度处理：
     * - 欧元价格：8位精度（例如：500000000 = 5.00 EUR）
     * - EUR/USD汇率：8位精度（例如：110000000 = 1.10）
     * - 美元价格：8位精度（例如：550000000 = 5.50 USD）
     * - 计算公式：(eurPrice * eurUsdRate) / 1e8
     * 
     * 安全验证：
     * - 检查响应数据不为空
     * - 验证EUR/USD价格大于0
     * - 完整的错误处理和事件记录
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // 记录回调开始
        emit FulfillRequestStarted(requestId, response.length, err.length);
        
        if (err.length > 0) {
            // 处理错误 - 记录错误信息
            string memory errorMessage = string(err);
            emit RequestProcessed(requestId, false, errorMessage);
            return;
        }
        
        // 检查响应数据是否为空
        require(response.length > 0, "Empty response from Functions");
        
        // 解码价格数据
        uint256 priceEUR = abi.decode(response, (uint256)); // 8位精度
        carbonPriceEUR = priceEUR;
        
        // 记录价格解码完成
        emit ResponseDecoded(priceEUR);
        
        // 获取EUR/USD价格（8位精度）
        (, int256 eurUsdPrice,,,) = eurUsdPriceFeed.latestRoundData();
        require(eurUsdPrice > 0, "Invalid EUR/USD price");
        
        // 记录EUR/USD价格获取完成
        emit EurUsdPriceFetched(eurUsdPrice);
        
        // 计算USD价格：两个8位精度相乘，除以1e8得到8位精度结果
        carbonPriceUSD = (priceEUR * uint256(eurUsdPrice)) / 1e8;
        
        // 记录USD价格计算完成
        emit UsdPriceCalculated(carbonPriceUSD);
        
        // 发出价格计算事件
        emit PriceCalculation(priceEUR, uint256(eurUsdPrice), carbonPriceUSD);
        emit RequestProcessed(requestId, true, "");
        
        emit PriceUpdated(carbonPriceEUR, carbonPriceUSD, block.timestamp);
        
        // 记录回调完成
        emit FulfillRequestCompleted(requestId);
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
        
        // 检查提取后是否还有足够余额支付费用
        uint256 remainingBalance = contractBalance - _amount;
        require(remainingBalance >= 0.1 * 1e18, "Insufficient balance after withdrawal");
        
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
    
    /**
     * @dev 仅测试用：设置碳价（欧元）
     */
    function setTestCarbonPriceEUR(uint256 value) external {
        carbonPriceEUR = value;
    }
    /**
     * @dev 仅测试用：设置碳价（美元）
     */
    function setTestCarbonPriceUSD(uint256 value) external {
        carbonPriceUSD = value;
    }
} 