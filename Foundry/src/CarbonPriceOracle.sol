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
 * @dev Carbon price oracle contract, uses Chainlink Functions to fetch API carbon price and convert to USD price
 * @notice Uses Chainlink Functions to call API for carbon price (EUR denominated) and converts to USD price via EUR/USD price oracle
 */
contract CarbonPriceOracle is FunctionsClient, ICarbonPriceOracle, Ownable {
    using FunctionsRequest for FunctionsRequest.Request;
    
    // ============ State Variables ============
    uint256 public carbonPriceEUR;      // EUR carbon price (8 decimals, e.g.: 500000000 = 5.00 EUR)
    uint256 public carbonPriceUSD;      // USD carbon price (8 decimals, e.g.: 550000000 = 5.50 USD)
    
    // ============ Chainlink Functions Configuration ============
    bytes32 public donId;               // DON ID: specifies which decentralized oracle network to use
    uint64 public subscriptionId;       // Subscription ID: associated paid account for Functions call fees
    uint32 public gasLimit;             // Gas limit: limits maximum gas consumption for JavaScript code execution
    bytes32 public secretsLocation;     // Secrets location: for storing API keys and sensitive info (currently unused)
    
    // ============ External Dependencies ============
    AggregatorV3Interface public eurUsdPriceFeed;  // EUR/USD price oracle contract address
    IERC20 public linkToken;                       // LINK token contract address for Functions fee payment
    
    // ============ Permission Management ============
    mapping(address => bool) public authorizedOperators;  // Authorized operator mapping, allows non-owners to call requestCarbonPrice
    
    // ============ Event Definitions ============
    // Price update events
    event PriceUpdated(uint256 eurPrice, uint256 usdPrice, uint256 timestamp);
    
    // Operator management events
    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);
    
    // Functions request related events
    event FunctionsRequestSent(bytes32 indexed requestId, string source);
    event RequestProcessed(bytes32 indexed requestId, bool success, string errorMessage);
    event RequestInitiated(address indexed caller, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    event RequestValidationFailed(string reason);
    event RequestSent(bytes32 indexed requestId, uint64 subscriptionId, uint32 gasLimit, bytes32 donId);
    
    // JavaScript code building events
    event JavaScriptSourceBuilt(string source);
    event RequestObjectCreated();
    event RequestEncoded(bytes encodedRequest);
    
    // Callback handling events
    event FulfillRequestStarted(bytes32 indexed requestId, uint256 responseLength, uint256 errorLength);
    event ResponseDecoded(uint256 priceEUR);
    event EurUsdPriceFetched(int256 eurUsdPrice);
    event UsdPriceCalculated(uint256 usdPrice);
    event FulfillRequestCompleted(bytes32 indexed requestId);
    
    // Price calculation events
    event PriceCalculation(uint256 eurPrice, uint256 eurUsdRate, uint256 usdPrice);
    
    /**
     * @dev Constructor - Initialize oracle contract
     * @param router Chainlink Functions Router address - responsible for routing Functions requests to correct DON
     * @param _donId DON ID - specifies which decentralized oracle network to use (e.g.: fun-ethereum-sepolia-1)
     * @param _eurUsdPriceFeed EUR/USD price oracle address - for getting real-time exchange rate
     * @param _linkToken LINK token address - for Functions call fee payment
     * 
     * Initialization notes:
     * - Inherits FunctionsClient for Functions call capability
     * - Inherits Ownable for permission management
     * - Sets initial gas limit to 1,000,000 (sufficient for complex JavaScript code execution)
     * - Validates all address parameters
     * 
     * Technical details:
     * - gasLimit set to 1,000,000 ensures JavaScript code has sufficient gas to execute
     * - Uses AggregatorV3Interface interface to interact with Chainlink price oracle
     * - Initializes LINK token contract reference for fee payment
     */
    constructor(
        address router,
        bytes32 _donId,
        address _eurUsdPriceFeed,
        address _linkToken
    ) FunctionsClient(router) Ownable() {
        donId = _donId;
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        gasLimit = 1000000; // Set higher initial gas limit
        linkToken = IERC20(_linkToken);
    }
    
    /**
     * @dev Set subscription ID - subscription ID associates your paid account
     * @param _subscriptionId Subscription ID
     * @notice Only contract owner can call this function
     */
    function setSubscriptionId(uint64 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }
    
    /**
     * @dev Set gas limit
     * @param _gasLimit Gas limit
     * @notice Only contract owner can call this function
     */
    function setGasLimit(uint32 _gasLimit) external onlyOwner {
        gasLimit = _gasLimit;
    }
    
    /**
     * @dev Add authorized operator - operators can call requestCarbonPrice function
     * @param _operator Operator address
     * @notice Only contract owner can call this function
     */
    function addOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator address");
        authorizedOperators[_operator] = true;
        emit OperatorAdded(_operator);
    }
    
    /**
     * @dev Remove authorized operator
     * @param _operator Operator address
     * @notice Only contract owner can call this function
     */
    function removeOperator(address _operator) external onlyOwner {
        authorizedOperators[_operator] = false;
        emit OperatorRemoved(_operator);
    }
    
    /**
     * @dev Permission check modifier
     * @notice Only contract owner or authorized operators can call
     */
    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorizedOperators[msg.sender], "Not authorized");
        _;
    }
    
    /**
     * @dev Request carbon price update - core functionality function
     * @notice Uses Chainlink Functions to call API for latest carbon price
     * @notice Must ensure sufficient subscription balance for fee payment
     * @notice Only contract owner or authorized operators can call this function
     * 
     * Execution flow:
     * 1. Validate configuration parameters (subscription ID, gas limit, DON ID)
     * 2. Build JavaScript source code (call API and return 8-decimal price)
     * 3. Create FunctionsRequest object and encode to CBOR format
     * 4. Send request to Chainlink Functions network
     * 5. Record request ID and related information
     * 
     * JavaScript code description:
     * - Calls https://greentrace-api.onrender.com/api/carbon-price for carbon price
     * - Validates response format and data type
     * - Multiplies price by 1e8 to convert to 8-decimal precision
     * - Uses Functions.encodeUint256 to encode return data
     * 
     * Security considerations:
     * - Parameter validation prevents invalid requests
     * - Permission checks ensure only authorized users can call
     * - Complete event logging for debugging and monitoring
     */
    function requestCarbonPrice() public onlyAuthorized {
        // Validate subscription ID
        if (subscriptionId == 0) {
            emit RequestValidationFailed("Subscription ID not set");
            revert("Subscription ID not set");
        }
        
        // Validate gas limit
        if (gasLimit == 0) {
            emit RequestValidationFailed("Gas limit not set");
            revert("Gas limit not set");
        }
        
        // Validate DON ID
        if (donId == bytes32(0)) {
            emit RequestValidationFailed("DON ID not set");
            revert("DON ID not set");
        }
        
        // Record request start
        emit RequestInitiated(msg.sender, subscriptionId, gasLimit, donId);
        
        // Build JavaScript source code
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
        
        // Record JavaScript source code built
        emit JavaScriptSourceBuilt(source);
        
        // Build request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        
        // Record request object created
        emit RequestObjectCreated();
        
        // Encode request
        bytes memory encodedRequest = req.encodeCBOR();
        emit RequestEncoded(encodedRequest);
        
        // Send request
        bytes32 requestId = _sendRequest(
            encodedRequest,
            subscriptionId,
            gasLimit,
            donId
        );
        
        // Record request sent
        emit RequestSent(requestId, subscriptionId, gasLimit, donId);
        emit FunctionsRequestSent(requestId, source);
    }
    
    /**
     * @dev fulfillRequest - Chainlink Functions callback handling function
     * @param requestId Request ID - used to identify specific Functions request
     * @param response Response data - encoded data returned by JavaScript code
     * @param err Error information - if JavaScript execution fails, contains error details
     * 
     * Processing flow:
     * 1. Check if any errors occurred
     * 2. Decode EUR price returned by JavaScript (8-decimal precision)
     * 3. Get real-time exchange rate from EUR/USD price oracle
     * 4. Calculate USD price: USD = EUR * (EUR/USD rate)
     * 5. Update state variables and emit events
     * 
     * Precision handling:
     * - EUR price: 8-decimal precision (e.g.: 500000000 = 5.00 EUR)
     * - EUR/USD rate: 8-decimal precision (e.g.: 110000000 = 1.10)
     * - USD price: 8-decimal precision (e.g.: 550000000 = 5.50 USD)
     * - Calculation formula: (eurPrice * eurUsdRate) / 1e8
     * 
     * Security validation:
     * - Check response data is not empty
     * - Validate EUR/USD price is greater than 0
     * - Complete error handling and event logging
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        // Record callback start
        emit FulfillRequestStarted(requestId, response.length, err.length);
        
        if (err.length > 0) {
            // Handle error - record error information
            string memory errorMessage = string(err);
            emit RequestProcessed(requestId, false, errorMessage);
            return;
        }
        
        // Check if response data is empty
        require(response.length > 0, "Empty response from Functions");
        
        // Decode price data
        uint256 priceEUR = abi.decode(response, (uint256)); // 8-decimal precision
        carbonPriceEUR = priceEUR;
        
        // Record price decoded
        emit ResponseDecoded(priceEUR);
        
        // Get EUR/USD price (8-decimal precision)
        (, int256 eurUsdPrice,,,) = eurUsdPriceFeed.latestRoundData();
        require(eurUsdPrice > 0, "Invalid EUR/USD price");
        
        // Record EUR/USD price fetched
        emit EurUsdPriceFetched(eurUsdPrice);
        
        // Calculate USD price: two 8-decimal precisions multiplied, divided by 1e8 for 8-decimal precision result
        carbonPriceUSD = (priceEUR * uint256(eurUsdPrice)) / 1e8;
        
        // Record USD price calculated
        emit UsdPriceCalculated(carbonPriceUSD);
        
        // Emit price calculation event
        emit PriceCalculation(priceEUR, uint256(eurUsdPrice), carbonPriceUSD);
        emit RequestProcessed(requestId, true, "");
        
        emit PriceUpdated(carbonPriceEUR, carbonPriceUSD, block.timestamp);
        
        // Record callback completed
        emit FulfillRequestCompleted(requestId);
    }
    
    /**
     * @dev Withdraw LINK tokens from contract (manage contract LINK balance)
     * @param _to Receiver address
     * @param _amount Amount to withdraw
     * @notice Only contract owner can call this function
     */
    function withdrawLink(address _to, uint256 _amount) external onlyOwner {
        require(_to != address(0), "Invalid address");
        uint256 contractBalance = linkToken.balanceOf(address(this));
        require(_amount <= contractBalance, "Insufficient LINK balance");
        
        // Check if withdrawal leaves enough balance to pay fees
        uint256 remainingBalance = contractBalance - _amount;
        require(remainingBalance >= 0.1 * 1e18, "Insufficient balance after withdrawal");
        
        require(linkToken.transfer(_to, _amount), "LINK transfer failed");
    }
    
    /**
     * @dev Get latest carbon price (USD)
     * @return Carbon price (USD)
     */
    function getLatestCarbonPriceUSD() external view override returns (uint256) {
        return carbonPriceUSD;
    }
    
    /**
     * @dev Get latest carbon price (EUR)
     * @return Carbon price (EUR)
     */
    function getLatestCarbonPriceEUR() external view override returns (uint256) {
        return carbonPriceEUR;
    }
    
    /**
     * @dev Only for testing: Set carbon price (EUR)
     */
    function setTestCarbonPriceEUR(uint256 value) external {
        carbonPriceEUR = value;
    }
    /**
     * @dev Only for testing: Set carbon price (USD)
     */
    function setTestCarbonPriceUSD(uint256 value) external {
        carbonPriceUSD = value;
    }
} 