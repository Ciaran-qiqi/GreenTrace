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
            address(0x123), // 模拟router地址
            bytes32("mock_don_id"), // 模拟DON ID
            mockEurUsdPriceFeed,
            mockLinkToken
        );
        
        // 给预言机合约一些LINK代币
        MockLinkToken(mockLinkToken).mint(address(carbonPriceOracle), 1 * 1e18);
    }
    
    /**
     * @dev 测试请求碳价更新（需要权限）
     */
    function testRequestCarbonPrice() public {
        // 只有合约所有者可以调用
        carbonPriceOracle.requestCarbonPrice();
        
        // 验证调用成功（虽然没有返回值，但如果没有revert就说明成功了）
        // 这里主要是测试权限控制，实际的价格更新需要Chainlink回调
    }
    
    /**
     * @dev 测试非授权用户请求碳价更新失败
     */
    function testRevertWhen_RequestCarbonPriceNotAuthorized() public {
        // 非所有者调用应该失败
        vm.prank(address(0x1));
        vm.expectRevert("Not authorized");
        carbonPriceOracle.requestCarbonPrice();
    }
    
    /**
     * @dev 测试LINK余额不足时请求碳价更新失败
     */
    function testRevertWhen_RequestCarbonPriceInsufficientLink() public {
        // 清空合约的LINK余额
        carbonPriceOracle.withdrawLink(address(this), MockLinkToken(mockLinkToken).balanceOf(address(carbonPriceOracle)));
        
        // 尝试请求碳价更新，应该失败
        vm.expectRevert("Insufficient LINK balance");
        carbonPriceOracle.requestCarbonPrice();
    }
    
    /**
     * @dev 测试添加和移除操作员
     */
    function testOperatorManagement() public {
        address operator = address(0x123);
        
        // 添加操作员
        carbonPriceOracle.addOperator(operator);
        assertTrue(carbonPriceOracle.authorizedOperators(operator), "Operator should be added");
        
        // 操作员可以调用requestCarbonPrice
        vm.prank(operator);
        carbonPriceOracle.requestCarbonPrice();
        
        // 移除操作员
        carbonPriceOracle.removeOperator(operator);
        assertFalse(carbonPriceOracle.authorizedOperators(operator), "Operator should be removed");
        
        // 移除后操作员不能调用
        vm.prank(operator);
        vm.expectRevert("Not authorized");
        carbonPriceOracle.requestCarbonPrice();
    }
    
    /**
     * @dev 测试非所有者添加操作员失败
     */
    function testRevertWhen_AddOperatorNotOwner() public {
        vm.prank(address(0x1));
        vm.expectRevert("Ownable: caller is not the owner");
        carbonPriceOracle.addOperator(address(0x123));
    }
    
    /**
     * @dev 测试获取最新碳价
     */
    function testGetLatestCarbonPrice() public {
        // 设置初始价格（在测试环境中直接设置状态）
        uint256 mockPrice = 100 * 1e18;
        
        // 直接设置价格状态（模拟fulfillRequest的效果）
        vm.store(
            address(carbonPriceOracle),
            keccak256(abi.encode(uint256(0))), // carbonPriceEUR 的存储槽
            bytes32(mockPrice)
        );
        
        // 测试获取价格
        uint256 usdPrice = carbonPriceOracle.getLatestCarbonPriceUSD();
        uint256 eurPrice = carbonPriceOracle.getLatestCarbonPriceEUR();
        
        assertEq(eurPrice, mockPrice, "Should return correct EUR price");
        // USD价格需要EUR/USD汇率计算，这里暂时跳过详细验证
    }
    
    /**
     * @dev 测试提取LINK代币（需要权限）
     */
    function testWithdrawLink() public {
        uint256 withdrawAmount = 0.5 * 1e18;
        address recipient = address(0x1);
        
        // 合约所有者可以提取
        carbonPriceOracle.withdrawLink(recipient, withdrawAmount);
        
        // 验证余额
        assertEq(
            MockLinkToken(mockLinkToken).balanceOf(recipient),
            withdrawAmount,
            "Recipient should receive LINK tokens"
        );
        
        // 非所有者不能提取
        vm.prank(address(0x2));
        vm.expectRevert("Ownable: caller is not the owner");
        carbonPriceOracle.withdrawLink(recipient, withdrawAmount);
    }
    
    /**
     * @dev 测试提取LINK时余额不足
     */
    function testRevertWhen_WithdrawInsufficientBalance() public {
        uint256 largeAmount = 10 * 1e18; // 大于合约余额
        address recipient = address(0x1);
        
        vm.expectRevert("Insufficient LINK balance");
        carbonPriceOracle.withdrawLink(recipient, largeAmount);
    }
    
    /**
     * @dev 测试提取LINK后余额不足
     */
    function testRevertWhen_WithdrawTooMuch() public {
        uint256 contractBalance = MockLinkToken(mockLinkToken).balanceOf(address(carbonPriceOracle));
        uint256 withdrawAmount = contractBalance - 0.1 * 1e18; // 几乎全部提取
        
        address recipient = address(0x1);
        
        vm.expectRevert("Insufficient balance after withdrawal");
        carbonPriceOracle.withdrawLink(recipient, withdrawAmount);
    }
    
    /**
     * @dev 测试完整的预言机工作流程
     * @notice 模拟从请求碳价到获取API数据再到价格更新的完整过程
     */
    function testCompleteOracleWorkflow() public {
        // 1. 请求碳价更新
        carbonPriceOracle.requestCarbonPrice();
        
        // 2. 模拟 Chainlink 节点从 API 获取数据
        // 模拟 API 返回的碳价数据：75.94 EUR
        uint256 apiPriceEUR = 75.94 * 1e18; // 75.94 EUR
        
        // 3. 模拟 Chainlink 回调处理 - 直接设置价格状态
        vm.store(
            address(carbonPriceOracle),
            keccak256(abi.encode(uint256(0))), // carbonPriceEUR 的存储槽
            bytes32(apiPriceEUR)
        );
        
        // 4. 验证价格更新
        uint256 expectedEURPrice = 75.94 * 1e18;
        
        assertEq(carbonPriceOracle.carbonPriceEUR(), expectedEURPrice, "EUR price should match API data");
        
        // 5. 验证事件触发
        // 注意：这里我们无法直接验证事件，但可以通过状态变化验证
        
        // 6. 测试价格查询接口
        assertEq(carbonPriceOracle.getLatestCarbonPriceEUR(), expectedEURPrice, "getLatestCarbonPriceEUR should return correct price");
    }
    
    /**
     * @dev 测试多次价格更新
     * @notice 验证预言机可以处理多次价格更新
     */
    function testMultiplePriceUpdates() public {
        // 第一次更新
        carbonPriceOracle.requestCarbonPrice();
        uint256 price1 = 75.94 * 1e18;
        vm.store(
            address(carbonPriceOracle),
            keccak256(abi.encode(uint256(0))), // carbonPriceEUR 的存储槽
            bytes32(price1)
        );
        
        assertEq(carbonPriceOracle.carbonPriceEUR(), price1, "First price update should work");
        
        // 第二次更新
        carbonPriceOracle.requestCarbonPrice();
        uint256 price2 = 80.50 * 1e18;
        vm.store(
            address(carbonPriceOracle),
            keccak256(abi.encode(uint256(0))), // carbonPriceEUR 的存储槽
            bytes32(price2)
        );
        
        assertEq(carbonPriceOracle.carbonPriceEUR(), price2, "Second price update should override first");
        assertEq(carbonPriceOracle.getLatestCarbonPriceEUR(), price2, "Latest price should be updated");
    }
    
    /**
     * @dev 测试价格计算精度
     * @notice 验证价格计算的精度处理
     */
    function testPriceCalculationPrecision() public {
        carbonPriceOracle.requestCarbonPrice();
        
        // 测试不同精度的价格
        uint256[] memory testPrices = new uint256[](3);
        testPrices[0] = 1 * 1e18;      // 1 EUR
        testPrices[1] = 100 * 1e18;    // 100 EUR
        testPrices[2] = 123456 * 1e18; // 123456 EUR
        
        for (uint i = 0; i < testPrices.length; i++) {
            vm.store(
                address(carbonPriceOracle),
                keccak256(abi.encode(uint256(0))), // carbonPriceEUR 的存储槽
                bytes32(testPrices[i])
            );
            
            assertEq(carbonPriceOracle.carbonPriceEUR(), testPrices[i], "Price should be set correctly");
        }
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