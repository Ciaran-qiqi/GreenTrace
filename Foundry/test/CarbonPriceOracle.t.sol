// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/CarbonPriceOracle.sol";
import "../src/interfaces/ICarbonPriceOracle.sol";

/**
 * @title CarbonPriceOracleTest
 * @dev 碳价预言机合约的测试套件
 * @notice 测试预言机的价格获取和更新功能
 */
contract CarbonPriceOracleTest is Test {
    // 测试合约实例
    CarbonPriceOracle public carbonPriceOracle;
    
    // 模拟合约地址
    address public mockLinkToken;
    address public mockEurUsdPriceFeed;
    
    // 测试常量
    uint256 public constant MOCK_EUR_PRICE = 100 * 1e18;  // 100 EUR
    
    function setUp() public {
        // 部署模拟合约
        mockLinkToken = address(new MockLinkToken());
        mockEurUsdPriceFeed = address(new MockPriceFeed());
        
        // 部署碳价预言机
        carbonPriceOracle = new CarbonPriceOracle(
            mockLinkToken,
            mockEurUsdPriceFeed
        );
        
        // 给预言机合约一些LINK代币
        MockLinkToken(mockLinkToken).mint(address(carbonPriceOracle), 1 * 1e18);
    }
    
    /**
     * @dev 测试请求碳价更新
     */
    function testRequestCarbonPrice() public {
        // 模拟Chainlink回调
        bytes32 requestId = bytes32("test_request_id");
        uint256 mockPrice = 100 * 1e18; // 100 EUR
        
        // 调用回调函数
        carbonPriceOracle.fulfillCarbonPrice(requestId, mockPrice);
        
        // 验证价格更新
        assertEq(carbonPriceOracle.carbonPriceEUR(), mockPrice, "EUR price should be updated");
        assertEq(
            carbonPriceOracle.carbonPriceUSD(),
            mockPrice * uint256(MockPriceFeed(mockEurUsdPriceFeed).MOCK_RATE()) / 1e8,
            "USD price should be calculated correctly"
        );
    }
    
    /**
     * @dev 测试获取最新碳价
     */
    function testGetLatestCarbonPrice() public {
        // 设置初始价格
        bytes32 requestId = bytes32("test_request_id");
        uint256 mockPrice = 100 * 1e18;
        carbonPriceOracle.fulfillCarbonPrice(requestId, mockPrice);
        
        // 测试获取价格
        uint256 usdPrice = carbonPriceOracle.getLatestCarbonPriceUSD();
        uint256 eurPrice = carbonPriceOracle.getLatestCarbonPriceEUR();
        
        assertEq(eurPrice, mockPrice, "Should return correct EUR price");
        assertEq(
            usdPrice,
            mockPrice * uint256(MockPriceFeed(mockEurUsdPriceFeed).MOCK_RATE()) / 1e8,
            "Should return correct USD price"
        );
    }
    
    /**
     * @dev 测试提取LINK代币
     */
    function testWithdrawLink() public {
        uint256 withdrawAmount = 0.5 * 1e18;
        address recipient = address(0x1);
        
        // 提取LINK
        carbonPriceOracle.withdrawLink(recipient, withdrawAmount);
        
        // 验证余额
        assertEq(
            MockLinkToken(mockLinkToken).balanceOf(recipient),
            withdrawAmount,
            "Recipient should receive LINK tokens"
        );
    }
}

/**
 * @title MockLinkToken
 * @dev 用于测试的LINK代币模拟合约
 */
contract MockLinkToken {
    mapping(address => uint256) public balanceOf;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/**
 * @title MockPriceFeed
 * @dev 用于测试的价格预言机模拟合约
 */
contract MockPriceFeed {
    uint256 public constant MOCK_RATE = 1.1 * 1e8; // 1.1 USD per EUR
    
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (0, int256(MOCK_RATE), 0, block.timestamp, 0);
    }
} 